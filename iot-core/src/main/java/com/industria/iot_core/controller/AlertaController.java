package com.industria.iot_core.controller;

import com.industria.iot_core.model.Alerta;
import com.industria.iot_core.repository.AlertaRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/alertas")
public class AlertaController {

    private static final int PADRAO = 20;
    private static final int MAXIMO = 200;

    private final AlertaRepository repository;

    public AlertaController(AlertaRepository repository) {
        this.repository = repository;
    }

    /** Alertas mais recentes primeiro. `limite` escolhe quantos (de 1 a 200; padrão 20). */
    @GetMapping
    public ResponseEntity<List<Alerta>> listar(@RequestParam(required = false) Integer limite) {
        int tamanho = Math.min(Math.max(limite == null ? PADRAO : limite, 1), MAXIMO);
        return ResponseEntity.ok(repository.findAllByOrderByTimestampDescIdDesc(PageRequest.of(0, tamanho)));
    }
}
