package com.industria.iot_core.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.util.Collections;

@Component
public class JwtFilter extends OncePerRequestFilter {

    // O Spring vai buscar esse valor lá no application.properties
    @Value("${api.security.token.secret}")
    private String CHAVE_SECRETA;

    private SecretKey getChaveAssinatura() {
        return Keys.hmacShaKeyFor(CHAVE_SECRETA.getBytes());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String tokenHeader = request.getHeader("Authorization");

        if (tokenHeader != null && tokenHeader.startsWith("Bearer ")) {
            String token = tokenHeader.substring(7); // Tira a palavra "Bearer "
            try {
                // Tenta ler e validar o crachá
                String usuario = Jwts.parser()
                        .verifyWith(getChaveAssinatura())
                        .build()
                        .parseSignedClaims(token)
                        .getPayload()
                        .getSubject();

                // Se deu certo, avisa o Segurança que o usuário pode entrar
                if (usuario != null) {
                    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(usuario, null, Collections.emptyList());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception e) {
                System.out.println("⚠️ Alerta: Tentativa de acesso com crachá inválido ou expirado.");
            }
        }
        
        // Manda o fluxo seguir
        filterChain.doFilter(request, response);
    }
}