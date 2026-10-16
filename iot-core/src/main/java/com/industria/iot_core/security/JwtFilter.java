package com.industria.iot_core.security;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

@Component
public class JwtFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtFilter.class);

    // O Spring vai buscar esse valor lá no application.properties
    @Value("${api.security.token.secret}")
    private String CHAVE_SECRETA;

    private SecretKey getChaveAssinatura() {
        return Keys.hmacShaKeyFor(CHAVE_SECRETA.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String tokenHeader = request.getHeader("Authorization");

        if (tokenHeader != null && tokenHeader.startsWith("Bearer ")) {
            String token = tokenHeader.substring(7); // Tira a palavra "Bearer "
            try {
                // Tenta ler e validar o token
                String usuario = Jwts.parser()
                        .verifyWith(getChaveAssinatura())
                        .build()
                        .parseSignedClaims(token)
                        .getPayload()
                        .getSubject();

                // Se deu certo, avisa o Spring Security que o usuário está autenticado
                if (usuario != null) {
                    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(usuario, null, Collections.emptyList());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (JwtException | IllegalArgumentException e) {
                log.warn("Token inválido ou expirado recusado: {}", e.getClass().getSimpleName());
            }
        }

        // Manda o fluxo seguir
        filterChain.doFilter(request, response);
    }
}
