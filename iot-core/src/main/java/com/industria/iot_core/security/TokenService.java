package com.industria.iot_core.security;

import com.industria.iot_core.model.Usuario.Perfil;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

@Service
public class TokenService {

    /** Validade de cada token: 2 horas. O painel pede um novo antes de vencer (veja {@link #renovar}). */
    private static final long VALIDADE_MS = 7_200_000L;

    // O Spring vai buscar esse valor lá no application.properties
    @Value("${api.security.token.secret}")
    private String CHAVE_SECRETA;

    /** Quanto tempo, no máximo, uma sessão dura renovando token (a partir do login). Depois disso é preciso entrar de novo. */
    @Value("${api.security.token.sessao-maxima-horas:12}")
    private long sessaoMaximaHoras = 12;

    private SecretKey getChaveAssinatura() {
        return Keys.hmacShaKeyFor(CHAVE_SECRETA.getBytes(StandardCharsets.UTF_8));
    }

    /** Token de um login novo: a sessão começa agora. */
    public String gerarToken(String usuario, Perfil perfil) {
        return gerarToken(usuario, perfil, Instant.now().getEpochSecond());
    }

    private String gerarToken(String usuario, Perfil perfil, long inicioDaSessaoSegundos) {
        return Jwts.builder()
                .subject(usuario) // Nome do usuário dono do token
                .claim("perfil", perfil.name()) // O que ele pode fazer (o painel também lê, para esconder botões)
                .claim("sessao", inicioDaSessaoSegundos) // Quando o login original aconteceu: limita quanto a sessão pode ser renovada
                .issuedAt(new Date()) // Data e hora de emissão
                .expiration(new Date(System.currentTimeMillis() + VALIDADE_MS))
                .signWith(getChaveAssinatura()) // Assinatura criptográfica
                .compact();
    }

    /** Lê e confere um token (assinatura e validade). Vazio se for inválido ou estiver vencido. */
    public Optional<Claims> ler(String token) {
        try {
            return Optional.of(Jwts.parser().verifyWith(getChaveAssinatura()).build().parseSignedClaims(token).getPayload());
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /**
     * Novo token para quem ainda tem um válido, com o perfil que o usuário tem agora (se um administrador mudou o perfil,
     * a renovação já traz o novo). Vazio se a sessão já passou do limite de {@code sessaoMaximaHoras}, contado do login.
     * Token antigo, sem a marca de início da sessão, conta a sessão a partir da emissão dele.
     */
    public Optional<String> renovar(Claims atuais, Perfil perfilAtual) {
        long agora = Instant.now().getEpochSecond();
        Long inicio = atuais.get("sessao", Long.class);
        long inicioDaSessao = inicio != null ? inicio : atuais.getIssuedAt().toInstant().getEpochSecond();
        if (agora - inicioDaSessao > sessaoMaximaHoras * 3600) return Optional.empty();
        return Optional.of(gerarToken(atuais.getSubject(), perfilAtual, inicioDaSessao));
    }
}
