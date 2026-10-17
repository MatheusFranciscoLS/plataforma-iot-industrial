package com.industria.iot_core.controller;

import com.industria.iot_core.model.Alerta;
import com.industria.iot_core.repository.AlertaRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Tag(name = "Alertas", description = "Avisos de máquina acima do limite, guardados no servidor")
@RestController
@RequestMapping("/api/alertas")
public class AlertaController {

    private static final int PADRAO = 20;
    private static final int MAXIMO = 200;

    private final AlertaRepository repository;

    public AlertaController(AlertaRepository repository) {
        this.repository = repository;
    }

    /**
     * Alertas mais recentes primeiro. `limite` escolhe quantos (de 1 a 200; padrão 20).
     * Filtros opcionais: `maquina`, `tipo` (TEMPERATURA ou VIBRACAO) e `reconhecido` (true ou false).
     */
    @Operation(summary = "Lista os alertas, do mais novo para o mais antigo", description = "Qualquer perfil. limite vai de 1 a 200 (padrão 20).")
    @GetMapping
    public ResponseEntity<List<Alerta>> listar(@RequestParam(required = false) Integer limite,
                                               @RequestParam(required = false) String maquina,
                                               @RequestParam(required = false) Alerta.Tipo tipo,
                                               @RequestParam(required = false) Boolean reconhecido) {
        int tamanho = Math.min(Math.max(limite == null ? PADRAO : limite, 1), MAXIMO);

        Specification<Alerta> filtros = (raiz, consulta, cb) -> {
            List<Predicate> condicoes = new ArrayList<>();
            if (maquina != null && !maquina.isBlank()) condicoes.add(cb.equal(raiz.get("idMaquina"), maquina));
            if (tipo != null) condicoes.add(cb.equal(raiz.get("tipo"), tipo));
            if (reconhecido != null) {
                condicoes.add(reconhecido ? cb.isNotNull(raiz.get("reconhecidoPor")) : cb.isNull(raiz.get("reconhecidoPor")));
            }
            return cb.and(condicoes.toArray(new Predicate[0]));
        };

        var ordem = Sort.by(Sort.Direction.DESC, "timestamp").and(Sort.by(Sort.Direction.DESC, "id"));
        return ResponseEntity.ok(repository.findAll(filtros, PageRequest.of(0, tamanho, ordem)).getContent());
    }

    /** Quantos alertas ainda não foram reconhecidos por ninguém. */
    @Operation(summary = "Conta os alertas que ninguém reconheceu")
    @GetMapping("/pendentes")
    public Map<String, Long> pendentes() {
        return Map.of("quantidade", repository.countByReconhecidoPorIsNull());
    }

    /** Marca o alerta como visto pelo usuário logado. Reconhecer de novo não muda quem reconheceu primeiro. */
    @Operation(summary = "Reconhece um alerta", description = "ADMIN ou OPERADOR. Guarda quem reconheceu primeiro; reconhecer de novo não muda nada.")
    @PostMapping("/{id}/reconhecer")
    @Transactional
    public Alerta reconhecer(@PathVariable Long id, Authentication autenticacao) {
        Alerta alerta = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alerta não encontrado"));
        alerta.reconhecer(autenticacao.getName());
        return repository.save(alerta);
    }
}
