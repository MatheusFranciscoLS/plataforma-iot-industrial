package com.industria.iot_core.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Modo demonstração: gera leituras de teste das três máquinas dentro da própria API, para o painel publicado
 * funcionar sem um simulador rodando em outro lugar. Fica desligado; ligue com SIMULADOR_ATIVO=true.
 * Os valores variam devagar em torno do normal de cada máquina, e de tempos em tempos uma delas passa dos
 * limites por algumas dezenas de segundos (veja {@link ModeloDeMaquina}), então o painel mostra os dois estados.
 */
@Component
@ConditionalOnProperty(name = "demo.simulador.ativo", havingValue = "true")
public class SimuladorDemo {

    private static final Logger log = LoggerFactory.getLogger(SimuladorDemo.class);

    static final List<String> MAQUINAS = List.of("MAQ-01", "MAQ-02", "MAQ-03");

    private final RegistroSensorService service;
    private final Random random = new Random();
    private final Map<String, ModeloDeMaquina> modelos = modelosDasMaquinas();

    public SimuladorDemo(RegistroSensorService service) {
        this.service = service;
        log.info("Modo demonstração ligado: a API vai gerar leituras de teste das máquinas {}.", MAQUINAS);
    }

    /** Cada máquina tem o seu normal: a MAQ-03 trabalha mais quente e girando mais rápido que a MAQ-01. */
    static Map<String, ModeloDeMaquina> modelosDasMaquinas() {
        return Map.of(
                "MAQ-01", new ModeloDeMaquina("MAQ-01", 72.0, 1.8, 1800),
                "MAQ-02", new ModeloDeMaquina("MAQ-02", 78.0, 2.2, 2200),
                "MAQ-03", new ModeloDeMaquina("MAQ-03", 84.0, 2.6, 2600));
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
