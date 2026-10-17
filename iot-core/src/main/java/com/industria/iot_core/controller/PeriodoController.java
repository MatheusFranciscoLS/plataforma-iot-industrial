package com.industria.iot_core.controller;

import com.industria.iot_core.service.Periodo;
import com.industria.iot_core.service.SerieService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Séries e resumos por período (1h, 6h ou 24h), agrupados no servidor. Qualquer perfil pode consultar. */
@Tag(name = "Períodos", description = "Média das leituras por faixa de tempo e resumo por máquina")
@RestController
@RequestMapping("/api/sensores")
public class PeriodoController {

    private final SerieService series;

    public PeriodoController(SerieService series) {
        this.series = series;
    }

    @Operation(summary = "Série de um período: média e máximo por faixa de tempo",
            description = "periodo: 1h (faixas de 1 min), 6h (5 min) ou 24h (15 min). maquina é opcional (padrão: todas). "
                    + "Só aparecem leituras que ainda existem no banco (a limpeza do modo demonstração apaga as de mais de 24 h).")
    @GetMapping("/serie")
    public SerieService.Serie serie(@RequestParam(defaultValue = "1h") String periodo, @RequestParam(required = false) String maquina) {
        return series.serie(exigir(periodo), maquina);
    }

    @Operation(summary = "Resumo por máquina em um período: leituras, média, máximo, mínimo e alertas",
            description = "periodo: 1h, 6h ou 24h.")
    @GetMapping("/resumo")
    public SerieService.Resumo resumo(@RequestParam(defaultValue = "1h") String periodo) {
        return series.resumo(exigir(periodo));
    }

    private static Periodo exigir(String texto) {
        return Periodo.deTexto(texto)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "periodo deve ser 1h, 6h ou 24h"));
    }
}
