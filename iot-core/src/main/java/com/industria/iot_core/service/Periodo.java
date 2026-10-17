package com.industria.iot_core.service;

import java.util.Arrays;
import java.util.Optional;

/**
 * Janelas de tempo do gráfico e da comparação. Cada uma agrupa as leituras em faixas de tamanho fixo
 * (a média de cada faixa vira um ponto), para o gráfico ter no máximo ~100 pontos por máquina.
 */
public enum Periodo {

    UMA_HORA("1h", 3600, 60),
    SEIS_HORAS("6h", 6 * 3600, 300),
    VINTE_E_QUATRO_HORAS("24h", 24 * 3600, 900);

    private final String texto;
    private final long duracaoSegundos;
    private final int faixaSegundos;

    Periodo(String texto, long duracaoSegundos, int faixaSegundos) {
        this.texto = texto;
        this.duracaoSegundos = duracaoSegundos;
        this.faixaSegundos = faixaSegundos;
    }

    /** O texto da URL: 1h, 6h ou 24h. */
    public String texto() { return texto; }
    public long duracaoSegundos() { return duracaoSegundos; }
    public int faixaSegundos() { return faixaSegundos; }

    public static Optional<Periodo> deTexto(String texto) {
        return Arrays.stream(values()).filter(p -> p.texto.equalsIgnoreCase(texto)).findFirst();
    }
}
