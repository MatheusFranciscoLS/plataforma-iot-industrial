package com.industria.iot_core.service;

import com.industria.iot_core.dto.LeituraRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Random;

/**
 * Modo demonstração: gera leituras de teste das três máquinas dentro da própria API, para o painel publicado
 * funcionar sem um simulador rodando em outro lugar. Fica desligado; ligue com SIMULADOR_ATIVO=true.
 * As faixas são as mesmas do simulador Python (`simulador-python/simulador.py`).
 */
@Component
@ConditionalOnProperty(name = "demo.simulador.ativo", havingValue = "true")
public class SimuladorDemo {

    private static final Logger log = LoggerFactory.getLogger(SimuladorDemo.class);

    static final List<String> MAQUINAS = List.of("MAQ-01", "MAQ-02", "MAQ-03");

    private final RegistroSensorService service;
    private final Random random = new Random();

    public SimuladorDemo(RegistroSensorService service) {
        this.service = service;
        log.info("Modo demonstração ligado: a API vai gerar leituras de teste das máquinas {}.", MAQUINAS);
    }

    @Scheduled(fixedDelayString = "${demo.simulador.intervalo-ms:2000}")
    public void gerarLeituras() {
        long agora = Instant.now().getEpochSecond();
        for (String maquina : MAQUINAS) {
            try {
                service.registrar(gerarLeitura(maquina, agora, random));
            } catch (Exception e) {
                // Um erro no banco não pode derrubar o agendador: a próxima rodada tenta de novo.
                log.warn("Não foi possível gerar a leitura de {}: {}", maquina, e.getMessage());
            }
        }
    }

    static LeituraRequest gerarLeitura(String maquina, long timestampSegundos, Random random) {
        return new LeituraRequest(
                maquina,
                timestampSegundos,
                arredondar(60.0 + random.nextDouble() * 45.0), // 60 a 105 °C
                arredondar(0.5 + random.nextDouble() * 5.5),   // 0,5 a 6,0 mm/s
                1200 + random.nextInt(2301));                  // 1200 a 3500 rpm
    }

    private static double arredondar(double valor) {
        return Math.round(valor * 100.0) / 100.0;
    }
}
