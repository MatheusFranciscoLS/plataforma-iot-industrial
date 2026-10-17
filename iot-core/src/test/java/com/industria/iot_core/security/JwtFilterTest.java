package com.industria.iot_core.security;

import com.industria.iot_core.model.Usuario;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class JwtFilterTest {

    static final String CHAVE = "chave-somente-para-testes-automatizados-0123456789";

    JwtFilter filtro;
    TokenService tokenService;
    MockHttpServletRequest request;
    MockHttpServletResponse response;
    FilterChain chain;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();

        filtro = new JwtFilter();
        ReflectionTestUtils.setField(filtro, "CHAVE_SECRETA", CHAVE);

        tokenService = new TokenService();
        ReflectionTestUtils.setField(tokenService, "CHAVE_SECRETA", CHAVE);

        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
        chain = mock(FilterChain.class);
    }

    @AfterEach
    void limpar() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void tokenValidoAutenticaOUsuario() throws Exception {
        request.addHeader("Authorization", "Bearer " + tokenService.gerarToken("admin", Usuario.Perfil.ADMIN));

        filtro.doFilter(request, response, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getName()).isEqualTo("admin");
        verify(chain).doFilter(request, response);
    }

    @Test
    void semCabecalhoNaoAutenticaMasDeixaARequisicaoSeguir() throws Exception {
        filtro.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    void tokenInvalidoNaoAutenticaMasDeixaARequisicaoSeguir() throws Exception {
        request.addHeader("Authorization", "Bearer isto-nao-e-um-token");

        filtro.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    void tokenAssinadoComOutraChaveNaoAutentica() throws Exception {
        TokenService outroEmissor = new TokenService();
        ReflectionTestUtils.setField(outroEmissor, "CHAVE_SECRETA", "outra-chave-completamente-diferente-9876543210");
        request.addHeader("Authorization", "Bearer " + outroEmissor.gerarToken("admin", Usuario.Perfil.ADMIN));

        filtro.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    void tokenAdulteradoNaoAutentica() throws Exception {
        String token = tokenService.gerarToken("admin", Usuario.Perfil.ADMIN);
        // Troca o primeiro caractere da assinatura (o último caractere tem bits sobrando e pode não mudar nada)
        int inicioAssinatura = token.lastIndexOf('.') + 1;
        char original = token.charAt(inicioAssinatura);
        String adulterado = token.substring(0, inicioAssinatura)
                + (original == 'A' ? 'B' : 'A')
                + token.substring(inicioAssinatura + 1);
        request.addHeader("Authorization", "Bearer " + adulterado);

        filtro.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    void tokenExpiradoNaoAutentica() throws Exception {
        String expirado = Jwts.builder()
                .subject("admin")
                .issuedAt(new Date(System.currentTimeMillis() - 7_200_000L))
                .expiration(new Date(System.currentTimeMillis() - 60_000L))
                .signWith(Keys.hmacShaKeyFor(CHAVE.getBytes()))
                .compact();
        request.addHeader("Authorization", "Bearer " + expirado);

        filtro.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    void cabecalhoSemPrefixoBearerEhIgnorado() throws Exception {
        request.addHeader("Authorization", tokenService.gerarToken("admin", Usuario.Perfil.ADMIN));

        filtro.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }
}
