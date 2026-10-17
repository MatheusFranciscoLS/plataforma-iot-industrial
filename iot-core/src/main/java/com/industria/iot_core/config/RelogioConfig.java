package com.industria.iot_core.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/** O relógio da API. Fica num bean para os testes poderem fixar a hora e conferir períodos com resultados exatos. */
@Configuration
public class RelogioConfig {

    @Bean
    @ConditionalOnMissingBean(Clock.class)
    public Clock relogio() {
        return Clock.systemUTC();
    }
}
