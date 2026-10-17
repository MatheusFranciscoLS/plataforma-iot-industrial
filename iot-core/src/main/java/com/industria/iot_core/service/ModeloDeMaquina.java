package com.industria.iot_core.service;

import com.industria.iot_core.dto.LeituraRequest;

import java.util.Random;

/**
 * Uma máquina simulada do modo demonstração. Em vez de sortear cada leitura do zero (o que faz a temperatura
 * pular de 60 para 105 °C de uma leitura para a outra), os valores variam devagar em torno de um valor normal,
 * como numa máquina de verdade. De vez em quando começa um "episódio": a temperatura, a vibração ou as duas
 * sobem acima do limite por algumas dezenas de segundos e depois voltam ao normal. É isso que gera os alertas.
 */
class ModeloDeMaquina {

    // Quanto o valor volta ao normal a cada leitura (0 = não volta, 1 = volta de uma vez)
    private static final double REVERSAO_TEMPERATURA = 0.15;
    private static final double REVERSAO_VIBRACAO = 0.20;
    private static final double REVERSAO_RPM = 0.10;

    private static final double RUIDO_TEMPERATURA = 1.2; // °C por leitura
    private static final double RUIDO_VIBRACAO = 0.12;   // mm/s por leitura
    private static final double RUIDO_RPM = 18.0;        // rpm por leitura

    // Valores de um episódio (acima dos limites padrão de 95 °C e 5,0 mm/s)
    private static final double TEMPERATURA_NO_EPISODIO = 103.0;
    private static final double VIBRACAO_NO_EPISODIO = 5.8;

    /** Chance de começar um episódio a cada leitura (1 em 450 = um a cada ~15 minutos por máquina, com leituras de 2 s). */
    static final double CHANCE_DE_EPISODIO = 1.0 / 450.0;
    private static final int EPISODIO_MIN = 20; // leituras
    private static final int EPISODIO_MAX = 45;

    private final String idMaquina;
    private final double temperaturaNormal;
    private final double vibracaoNormal;
    private final double rpmNormal;

    private double temperatura;
    private double vibracao;
    private double rpm;

    private int leiturasRestantesDoEpisodio = 0;
    private boolean episodioEsquenta;
    private boolean episodioVibra;

    ModeloDeMaquina(String idMaquina, double temperaturaNormal, double vibracaoNormal, double rpmNormal) {
        this.idMaquina = idMaquina;
        this.temperaturaNormal = temperaturaNormal;
        this.vibracaoNormal = vibracaoNormal;
        this.rpmNormal = rpmNormal;
        this.temperatura = temperaturaNormal;
        this.vibracao = vibracaoNormal;
        this.rpm = rpmNormal;
    }

    boolean emEpisodio() {
        return leiturasRestantesDoEpisodio > 0;
    }

    /** Avança uma leitura e devolve os valores novos. */
    LeituraRequest proxima(long timestampSegundos, Random random) {
        if (leiturasRestantesDoEpisodio > 0) {
            leiturasRestantesDoEpisodio--;
        } else if (random.nextDouble() < CHANCE_DE_EPISODIO) {
            leiturasRestantesDoEpisodio = EPISODIO_MIN + random.nextInt(EPISODIO_MAX - EPISODIO_MIN + 1);
            double sorteio = random.nextDouble();
            episodioEsquenta = sorteio < 0.8;            // 50% só temperatura, 30% as duas (0,0 a 0,8)...
            episodioVibra = sorteio >= 0.5;              // ...e 20% só vibração (0,5 a 1,0)
        }

        boolean esquentando = emEpisodio() && episodioEsquenta;
        boolean vibrando = emEpisodio() && episodioVibra;

        double alvoTemperatura = esquentando ? TEMPERATURA_NO_EPISODIO : temperaturaNormal;
        double alvoVibracao = vibrando ? VIBRACAO_NO_EPISODIO : vibracaoNormal;
        double alvoRpm = emEpisodio() ? rpmNormal * 1.08 : rpmNormal; // máquina sob esforço gira um pouco mais

        temperatura += (alvoTemperatura - temperatura) * REVERSAO_TEMPERATURA + random.nextGaussian() * RUIDO_TEMPERATURA;
        vibracao += (alvoVibracao - vibracao) * REVERSAO_VIBRACAO + random.nextGaussian() * RUIDO_VIBRACAO;
        rpm += (alvoRpm - rpm) * REVERSAO_RPM + random.nextGaussian() * RUIDO_RPM;

        // Limites físicos, só para nunca sair do que o painel e a API aceitam como leitura razoável
        temperatura = Math.min(Math.max(temperatura, 40.0), 125.0);
        vibracao = Math.min(Math.max(vibracao, 0.2), 9.0);
        rpm = Math.min(Math.max(rpm, 1000.0), 3600.0);

        return new LeituraRequest(idMaquina, timestampSegundos, arredondar(temperatura), arredondar(vibracao), (int) Math.round(rpm));
    }

    private static double arredondar(double valor) {
        return Math.round(valor * 100.0) / 100.0;
    }
}
