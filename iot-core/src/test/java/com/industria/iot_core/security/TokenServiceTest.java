package com.industria.iot_core.security;

import com.industria.iot_core.model.Usuario;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.SecretKey;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TokenServiceTest {

    static final String CHAVE = "chave-somente-para-testes-automatizados-0123456789";

    TokenService tokenService;

    @BeforeEach
    void setUp() {
        tokenService = new TokenService();
        ReflectionTestUtils.setField(tokenService, "CHAVE_SECRETA", CHAVE);
    }

    private Claims ler(String token, String chave) {
        SecretKey key = Keys.hmacShaKeyFor(chave.getBytes());
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    @Test
    void tokenGeradoTrazOUsuarioNoSubject() {
        String token = tokenService.gerarToken("admin", Usuario.Perfil.ADMIN);

        assertThat(ler(token, CHAVE).getSubject()).isEqualTo("admin");
    }

    @Test
    void tokenExpiraEmDuasHoras() {
        String token = tokenService.gerarToken("admin", Usuario.Perfil.ADMIN);

        Claims claims = ler(token, CHAVE);
        long duracao = claims.getExpiration().getTime() - claims.getIssuedAt().getTime();

        // O JWT guarda datas em segundos, então pode haver até 1s de diferença no arredondamento
        assertThat(duracao).isBetween(7_199_000L, 7_201_000L);
    }

    @Test
    void tokenNaoEhValidoComOutraChave() {
        String token = tokenService.gerarToken("admin", Usuario.Perfil.ADMIN);

        assertThatThrownBy(() -> ler(token, "outra-chave-completamente-diferente-9876543210"))
                .isInstanceOf(JwtException.class);
    }
}
