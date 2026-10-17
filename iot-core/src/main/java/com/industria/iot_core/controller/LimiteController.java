package com.industria.iot_core.controller;

import com.industria.iot_core.model.Alerta;
import com.industria.iot_core.model.LimiteMaquina;
import com.industria.iot_core.service.LimiteService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** Limites de alerta: o padrão da API e os que foram definidos para cada máquina. */
@RestController
@RequestMapping("/api/limites")
public class LimiteController {

    private static final Pattern MAQUINA_VALIDA = Pattern.compile("[A-Za-z0-9_-]{1,50}");

    public record LimiteRequest(
            @NotNull(message = "limite é obrigatório")
            @DecimalMin(value = "0.1", message = "limite deve ser pelo menos 0,1")
            @DecimalMax(value = "10000", message = "limite deve ser no máximo 10000")
            Double limite) {}

    public record LimiteDaMaquina(String idMaquina, Alerta.Tipo tipo, Double limite) {
        static LimiteDaMaquina de(LimiteMaquina l) {
            return new LimiteDaMaquina(l.getIdMaquina(), l.getTipo(), l.getLimite());
        }
    }

    public record Limites(Map<Alerta.Tipo, Double> padrao, List<LimiteDaMaquina> maquinas) {}

    private final LimiteService limites;

    public LimiteController(LimiteService limites) {
        this.limites = limites;
    }

    @GetMapping
    public Limites listar() {
        return new Limites(limites.padrao(), limites.listarProprios().stream().map(LimiteDaMaquina::de).toList());
    }

    /** Define o limite de uma máquina (cria ou troca). Vale a partir da próxima leitura recebida. */
    @PutMapping("/{maquina}/{tipo}")
    public LimiteDaMaquina definir(@PathVariable String maquina, @PathVariable Alerta.Tipo tipo, @Valid @RequestBody LimiteRequest pedido) {
        exigirMaquinaValida(maquina);
        return LimiteDaMaquina.de(limites.definir(maquina, tipo, pedido.limite()));
    }

    /** Volta ao limite padrão. */
    @DeleteMapping("/{maquina}/{tipo}")
    public ResponseEntity<Void> remover(@PathVariable String maquina, @PathVariable Alerta.Tipo tipo) {
        exigirMaquinaValida(maquina);
        return limites.remover(maquina, tipo) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    private static void exigirMaquinaValida(String maquina) {
        if (!MAQUINA_VALIDA.matcher(maquina).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome de máquina inválido");
        }
    }
}
