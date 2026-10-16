package com.industria.iot_core.config;

import com.industria.iot_core.security.LimiteDeTentativas;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.time.Instant;

@Configuration
public class LoginConfig {

    // Depois de LOGIN_MAX_TENTATIVAS falhas seguidas (padrão 5) o login fica bloqueado por LOGIN_JANELA_SEGUNDOS (padrão 300).
    @Bean
    public LimiteDeTentativas limiteDeTentativas(@Value("${api.login.max-tentativas:5}") int maximo,
                                                 @Value("${api.login.janela-segundos:300}") long janelaSegundos) {
        return new LimiteDeTentativas(maximo, Duration.ofSeconds(janelaSegundos), Instant::now);
    }
}
