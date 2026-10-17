package com.industria.iot_core.service;

import com.industria.iot_core.repository.AlertaRepository;
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
 * Apaga as leituras e os alertas mais antigos que RETENCAO_HORAS, para o banco (grátis, com limite de espaço) não encher.
 * Desligada por padrão: só roda se RETENCAO_HORAS for maior que zero.
 */
@Component
@ConditionalOnExpression("${demo.retencao-horas:0} > 0")
public class LimpezaDeLeituras {

    private static final Logger log = LoggerFactory.getLogger(LimpezaDeLeituras.class);

    private final RegistroSensorRepository repository;
    private final AlertaRepository alertas;
    private final long retencaoHoras;

    public LimpezaDeLeituras(RegistroSensorRepository repository, AlertaRepository alertas,
                             @Value("${demo.retencao-horas:0}") long retencaoHoras) {
        this.repository = repository;
        this.alertas = alertas;
        this.retencaoHoras = retencaoHoras;
    }

    @Scheduled(cron = "0 */10 * * * *") // a cada 10 minutos
    @Transactional
    public void apagarAntigas() {
        long limite = Instant.now().getEpochSecond() - retencaoHoras * 3600;
        long apagadas = repository.deleteByTimestampLessThan(limite);
        long alertasApagados = alertas.deleteByTimestampLessThan(limite);
        if (apagadas > 0 || alertasApagados > 0) {
            log.info("Limpeza: {} leituras e {} alertas com mais de {} h apagados.", apagadas, alertasApagados, retencaoHoras);
        }
    }
}
