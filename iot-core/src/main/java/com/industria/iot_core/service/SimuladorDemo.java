package com.industria.iot_core.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Modo demonstração: gera leituras de teste das três máquinas dentro da própria API, para o painel publicado
 * funcionar sem um simulador rodando em outro lugar. Fica desligado; ligue com SIMULADOR_ATIVO=true.
 * Os valores variam devagar em torno do normal de cada máquina, e de tempos em tempos uma delas passa dos
 * limites por algumas dezenas de segundos (veja {@link ModeloDeMaquina}), então o painel mostra os dois estados.
 * O botão "Simular falha" do painel provoca esse episódio na hora ({@link #provocarFalha}).
 */
@Component
@ConditionalOnProperty(name = "demo.simulador.ativo", havingValue = "true")
public class SimuladorDemo {

    private static final Logger log = LoggerFactory.getLogger(SimuladorDemo.class);

    static final List<String> MAQUINAS = List.of("MAQ-01", "MAQ-02", "MAQ-03");

    /** Duração de uma falha provocada, em leituras (~1 minuto com leituras de 2 s). */
    static final int LEITURAS_DA_FALHA = 30;

    /** Resultado de um pedido de falha: aceito, ou quantos segundos esperar até poder pedir de novo. */
    public record ResultadoDaFalha(boolean aceita, long esperarSegundos, long duracaoSegundos) {}

    private final RegistroSensorService service;
    private final Clock relogio;
    private final long intervaloMs;
    private final long esperaEntreFalhasMs;
    private final Random random = new Random();
    private final Map<String, ModeloDeMaquina> modelos = modelosDasMaquinas();
    private final Map<String, Long> ultimaFalhaEmMs = new ConcurrentHashMap<>();

    public SimuladorDemo(RegistroSensorService service, Clock relogio,
                         @Value("${demo.simulador.intervalo-ms:2000}") long intervaloMs,
                         @Value("${demo.simulador.espera-falha-segundos:30}") long esperaEntreFalhasSegundos) {
        this.service = service;
        this.relogio = relogio;
        this.intervaloMs = intervaloMs;
        this.esperaEntreFalhasMs = esperaEntreFalhasSegundos * 1000;
        log.info("Modo demonstração ligado: a API vai gerar leituras de teste das máquinas {}.", MAQUINAS);
    }

    /** Cada máquina tem o seu normal: a MAQ-03 trabalha mais quente e girando mais rápido que a MAQ-01. */
    static Map<String, ModeloDeMaquina> modelosDasMaquinas() {
        return Map.of(
                "MAQ-01", new ModeloDeMaquina("MAQ-01", 72.0, 1.8, 1800),
                "MAQ-02", new ModeloDeMaquina("MAQ-02", 78.0, 2.2, 2200),
                "MAQ-03", new ModeloDeMaquina("MAQ-03", 84.0, 2.6, 2600));
    }

    public List<String> maquinas() {
        return MAQUINAS;
    }

    public long esperaEntreFalhasSegundos() {
        return esperaEntreFalhasMs / 1000;
    }

    /**
     * Provoca uma falha na máquina: ela passa dos limites por cerca de um minuto e volta ao normal sozinha.
     * Cada máquina só aceita um novo pedido depois de uma espera (para ninguém ficar apertando o botão sem parar).
     *
     * @throws IllegalArgumentException se a máquina não existe
     */
    public ResultadoDaFalha provocarFalha(String maquina, TipoDeFalha tipo) {
        ModeloDeMaquina modelo = modelos.get(maquina);
        if (modelo == null) throw new IllegalArgumentException("Máquina desconhecida: " + maquina);

        long agora = relogio.millis();
        long duracao = LEITURAS_DA_FALHA * intervaloMs / 1000;
        // merge atômico: dois pedidos ao mesmo tempo não passam os dois
        boolean[] aceita = {false};
        long[] restanteMs = {0};
        ultimaFalhaEmMs.compute(maquina, (m, ultima) -> {
            if (ultima != null && agora - ultima < esperaEntreFalhasMs) {
                restanteMs[0] = esperaEntreFalhasMs - (agora - ultima);
                return ultima;
            }
            aceita[0] = true;
            return agora;
        });

        if (!aceita[0]) {
            return new ResultadoDaFalha(false, (restanteMs[0] + 999) / 1000, duracao);
        }
        modelo.forcarEpisodio(tipo, LEITURAS_DA_FALHA);
        log.info("Falha simulada em {} ({}) a pedido do painel.", maquina, tipo);
        return new ResultadoDaFalha(true, 0, duracao);
    }

    @Scheduled(fixedDelayString = "${demo.simulador.intervalo-ms:2000}")
    public void gerarLeituras() {
        long agora = Instant.now().getEpochSecond();
        for (String maquina : MAQUINAS) {
            try {
                service.registrar(modelos.get(maquina).proxima(agora, random));
            } catch (Exception e) {
                // Um erro no banco não pode derrubar o agendador: a próxima rodada tenta de novo.
                log.warn("Não foi possível gerar a leitura de {}: {}", maquina, e.getMessage());
            }
        }
    }
}
