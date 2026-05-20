package com.industria.iot_core.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;

@Service
public class TokenService {

    // O Spring vai buscar esse valor lá no application.properties
    @Value("${api.security.token.secret}")
    private String CHAVE_SECRETA;

    private SecretKey getChaveAssinatura() {
        return Keys.hmacShaKeyFor(CHAVE_SECRETA.getBytes());
    }

    public String gerarToken(String usuario) {
        return Jwts.builder()
                .subject(usuario) // Nome do funcionário no crachá
                .issuedAt(new Date()) // Data e hora de emissão
                // Validade do crachá: 2 horas (em milissegundos)
                .expiration(new Date(System.currentTimeMillis() + 7200000)) 
                .signWith(getChaveAssinatura()) // Carimbo criptográfico
                .compact();
    }
}