package com.industria.iot_core.config;

import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String FILA_SENSORES = "sensores.fila";

    // Cria a fila no RabbitMQ (durável: sobrevive a um reinício do broker)
    @Bean
    public Queue filaSensores() {
        return new Queue(FILA_SENSORES, true);
    }
}
