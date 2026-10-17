package com.industria.iot_core.controller;

import com.industria.iot_core.service.SimuladorDemo;
import com.industria.iot_core.service.TipoDeFalha;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * Rotas do modo demonstração: só existem quando SIMULADOR_ATIVO=true (sem ele, respondem 404, e é assim que o
 * painel sabe que deve esconder o botão "Simular falha"). Provocar falha: ADMIN e OPERADOR.
 */
@Tag(name = "Demonstração", description = "Só existe quando o modo demonstração está ligado")
@RestController
@RequestMapping("/api/demo")
@ConditionalOnProperty(name = "demo.simulador.ativo", havingValue = "true")
public class DemoController {

    public record Estado(boolean simulador, List<String> maquinas, long esperaEntreFalhasSegundos) {}

    public record PedidoDeFalha(TipoDeFalha tipo) {}

    public record FalhaProvocada(String maquina, TipoDeFalha tipo, long duracaoSegundos) {}

    private final SimuladorDemo simulador;

    public DemoController(SimuladorDemo simulador) {
        this.simulador = simulador;
    }

    @Operation(summary = "O modo demonstração está ligado e quais máquinas ele simula")
    @GetMapping("/estado")
    public Estado estado() {
        return new Estado(true, simulador.maquinas(), simulador.esperaEntreFalhasSegundos());
    }

    @Operation(summary = "Provoca uma falha numa máquina simulada",
            description = "ADMIN ou OPERADOR. A máquina passa dos limites por cerca de 1 minuto e volta ao normal. "
                    + "tipo: TEMPERATURA, VIBRACAO ou AMBAS (padrão). 429 se a máquina falhou há pouco (cabeçalho Retry-After).")
    @PostMapping("/falha/{maquina}")
    public ResponseEntity<FalhaProvocada> provocarFalha(@PathVariable String maquina, @RequestBody(required = false) PedidoDeFalha pedido) {
        TipoDeFalha tipo = pedido == null || pedido.tipo() == null ? TipoDeFalha.AMBAS : pedido.tipo();
        SimuladorDemo.ResultadoDaFalha resultado;
        try {
            resultado = simulador.provocarFalha(maquina, tipo);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Máquina não encontrada");
        }
        if (!resultado.aceita()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(resultado.esperarSegundos())).build();
        }
        return ResponseEntity.accepted().body(new FalhaProvocada(maquina, tipo, resultado.duracaoSegundos()));
    }
}
