package com.industria.iot_core.service;

import com.industria.iot_core.repository.RegistroSensorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Apaga as leituras mais antigas que RETENCAO_HORAS, para o banco (grátis, com limite de espaço) não encher.
 * Desligada por padrão: só roda se RETENCAO_HORAS for maior que zero.
 */
@Component
@ConditionalOnExpression("${demo.retencao-horas:0} > 0")
public class LimpezaDeLeituras {

    private static final Logger log = LoggerFactory.getLogger(LimpezaDeLeituras.class);

    private final RegistroSensorRepository repository;
    private final long retencaoHoras;

    public LimpezaDeLeituras(RegistroSensorRepository repository, @Value("${demo.retencao-horas:0}") long retencaoHoras) {
        this.repository = repository;
        this.retencaoHoras = retencaoHoras;
    }

    @Scheduled(cron = "0 */10 * * * *") // a cada 10 minutos
    @Transactional
    public void apagarAntigas() {
        long limite = Instant.now().getEpochSecond() - retencaoHoras * 3600;
        long apagadas = repository.deleteByTimestampLessThan(limite);
        if (apagadas > 0) {
            log.info("Limpeza: {} leituras com mais de {} h apagadas.", apagadas, retencaoHoras);
        }
    }
}
