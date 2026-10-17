package com.industria.iot_core.service;

import com.industria.iot_core.model.Alerta;
import com.industria.iot_core.model.RegistroSensor;
import com.industria.iot_core.repository.AlertaRepository;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registra um alerta quando uma máquina passa de um limite. Só o momento em que ela passa conta:
 * enquanto continuar acima do limite, as leituras seguintes não geram alertas repetidos.
 * O limite vem do {@link LimiteService}: o da própria máquina, se foi definido, senão o padrão.
 * O estado "estava acima?" fica na memória; reiniciar a API faz a primeira leitura acima do limite alertar de novo.
 */
@Service
public class AlertaService {

    private static final Logger log = LoggerFactory.getLogger(AlertaService.class);

    private final AlertaRepository repository;
    private final LimiteService limites;

    // chave: máquina + tipo; valor: se a leitura anterior já estava acima do limite
    private final Map<String, Boolean> acima = new ConcurrentHashMap<>();

    private final MeterRegistry metricas;
    private final NotificadorDeAlertas notificador;

    public AlertaService(AlertaRepository repository, LimiteService limites, MeterRegistry metricas, NotificadorDeAlertas notificador) {
        this.repository = repository;
        this.limites = limites;
        this.metricas = metricas;
        this.notificador = notificador;
    }

    public void avaliar(RegistroSensor leitura) {
        avaliar(leitura, Alerta.Tipo.TEMPERATURA, leitura.getTemperaturaMotor());
        avaliar(leitura, Alerta.Tipo.VIBRACAO, leitura.getVibracao());
    }

    private void avaliar(RegistroSensor leitura, Alerta.Tipo tipo, Double valor) {
        if (valor == null) return;

        double limite = limites.limiteDe(leitura.getIdMaquina(), tipo);
        boolean estaAcima = valor > limite;
        Boolean estavaAcima = acima.put(leitura.getIdMaquina() + "|" + tipo, estaAcima);

        if (estaAcima && !Boolean.TRUE.equals(estavaAcima)) {
            Alerta alerta = repository.save(new Alerta(leitura.getIdMaquina(), leitura.getTimestamp(), tipo, valor, limite));
            log.info("Alerta: {} passou do limite de {} ({} > {})", leitura.getIdMaquina(), tipo, valor, limite);
            metricas.counter("iot.alertas.gerados", "tipo", tipo.name()).increment();
            notificador.notificar(alerta); // assíncrono e sem lançar erro: o chat fora do ar não atrapalha a leitura
        }
    }
}
