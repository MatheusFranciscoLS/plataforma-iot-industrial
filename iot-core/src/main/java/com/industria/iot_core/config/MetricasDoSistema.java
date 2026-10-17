package com.industria.iot_core.config;

import com.industria.iot_core.repository.AlertaRepository;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import io.micrometer.core.instrument.config.MeterFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Métricas do sistema, além das que o Spring já publica (memória, requisições, banco...).
 * Leituras recebidas, alertas gerados e falhas do RabbitMQ são contadas onde acontecem; aqui ficam
 * a etiqueta que identifica a aplicação em todas as métricas e o número de alertas que ninguém reconheceu ainda.
 */
@Configuration
public class MetricasDoSistema {

    @Bean
    MeterFilter etiquetaDaAplicacao() {
        return MeterFilter.commonTags(Tags.of("application", "iot-core"));
    }

    @Bean
    Gauge alertasPendentes(MeterRegistry registro, AlertaRepository alertas) {
        return Gauge.builder("iot.alertas.pendentes", alertas, AlertaRepository::countByReconhecidoPorIsNull)
                .description("Alertas que ninguém reconheceu ainda")
                .register(registro);
    }
}
