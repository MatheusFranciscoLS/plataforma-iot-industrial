package com.industria.iot_core.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * Deixa o Prometheus buscar as métricas com um token fixo (METRICAS_TOKEN), em vez de um token de login, que vence em
 * 2 horas. O token só vale para /actuator/prometheus e /actuator/metrics; em qualquer outra rota ele não abre nada.
 * Sem METRICAS_TOKEN definido, este filtro não faz nada (as métricas continuam só para o administrador logado).
 */
@Component
public class MetricasTokenFilter extends OncePerRequestFilter {

    /** Perfil de quem entra com o token de métricas: só enxerga as rotas do actuator. */
    public static final String PERFIL = "METRICAS";

    private final byte[] token;

    public MetricasTokenFilter(@Value("${metricas.token:}") String token) {
        this.token = token == null || token.isBlank() ? null : token.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (token != null && rotaDeMetricas(request) && tokenConfere(request.getHeader("Authorization"))) {
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                    "prometheus", null, List.of(new SimpleGrantedAuthority("ROLE_" + PERFIL))));
        }
        filterChain.doFilter(request, response);
    }

    private static boolean rotaDeMetricas(HttpServletRequest request) {
        String caminho = request.getRequestURI();
        return "GET".equals(request.getMethod()) && ("/actuator/prometheus".equals(caminho) || "/actuator/metrics".equals(caminho)
                || caminho.startsWith("/actuator/metrics/"));
    }

    private boolean tokenConfere(String cabecalho) {
        if (cabecalho == null || !cabecalho.startsWith("Bearer ")) return false;
        // comparação em tempo constante: o tempo de resposta não revela quantos caracteres estavam certos
        return MessageDigest.isEqual(cabecalho.substring(7).getBytes(StandardCharsets.UTF_8), token);
    }
}
