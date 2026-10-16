package com.industria.iot_core.config;

import com.industria.iot_core.security.JwtFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    // Origens aceitas pelo CORS, separadas por vírgula. O padrão "*" mantém o comportamento anterior;
    // em produção, defina CORS_ORIGINS com o endereço do painel.
    private final List<String> origensPermitidas;

    public SecurityConfig(JwtFilter jwtFilter, @Value("${api.cors.origins:*}") String origens) {
        this.jwtFilter = jwtFilter;
        this.origensPermitidas = Arrays.stream(origens.split(",")).map(String::trim).filter(o -> !o.isEmpty()).toList();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/sensores").permitAll()
                // Verificação de saúde, para a hospedagem e o Docker saberem se a API está de pé
                .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
                // Erros de validação (400) são reenviados internamente para /error; sem isso viram 403
                .requestMatchers("/error").permitAll()
                .anyRequest().authenticated()
            )
            // O leitor de token roda ANTES do filtro de login do Spring Security
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(origensPermitidas);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
