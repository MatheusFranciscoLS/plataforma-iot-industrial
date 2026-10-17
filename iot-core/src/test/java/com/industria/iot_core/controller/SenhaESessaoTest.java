package com.industria.iot_core.controller;

import com.industria.iot_core.model.Usuario;
import com.industria.iot_core.model.Usuario.Perfil;
import com.industria.iot_core.repository.UsuarioRepository;
import com.industria.iot_core.security.TokenService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Troca da própria senha e renovação do token. */
class SenhaESessaoTest {

    abstract static class Base {
        @Autowired MockMvc mockMvc;
        @Autowired TokenService tokenService;
        @Autowired UsuarioRepository usuarios;
        @Autowired PasswordEncoder encoder;
        @Value("${api.security.token.secret}") String segredo;
        @MockitoBean RabbitTemplate rabbitTemplate;

        String novoUsuario(Perfil perfil, String senha) {
            String nome = "u" + UUID.randomUUID().toString().substring(0, 8);
            usuarios.save(new Usuario(nome, encoder.encode(senha), perfil));
            return nome;
        }

        String bearer(String nome, Perfil perfil) {
            return "Bearer " + tokenService.gerarToken(nome, perfil);
        }

        ResultActions trocar(String autorizacao, String atual, String nova) throws Exception {
            return mockMvc.perform(put("/api/auth/senha").header("Authorization", autorizacao).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"senhaAtual\":\"" + atual + "\",\"novaSenha\":\"" + nova + "\"}"));
        }

        ResultActions entrar(String nome, String senha) throws Exception {
            return mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"usuario\":\"" + nome + "\",\"senha\":\"" + senha + "\"}"));
        }

        String token(ResultActions resposta) throws Exception {
            return resposta.andReturn().getResponse().getContentAsString().replaceAll(".*\"token\":\"([^\"]+)\".*", "$1");
        }

        /** Um token assinado com a chave da API, com início de sessão e emissão à escolha (para simular sessões antigas). */
        String tokenAntigo(String nome, Perfil perfil, Long inicioDaSessao, Instant emitidoEm) {
            var construtor = Jwts.builder().subject(nome).claim("perfil", perfil.name())
                    .issuedAt(Date.from(emitidoEm)).expiration(Date.from(Instant.now().plusSeconds(3600)))
                    .signWith(Keys.hmacShaKeyFor(segredo.getBytes(StandardCharsets.UTF_8)));
            if (inicioDaSessao != null) construtor.claim("sessao", inicioDaSessao);
            return construtor.compact();
        }
    }

    @Nested
    @SpringBootTest
    @AutoConfigureMockMvc
    class TrocaDeSenha extends Base {

        @Test
        void trocaACorretaFazAvaliaNovaValerEAAntigaNao() throws Exception {
            String nome = novoUsuario(Perfil.LEITURA, "senha-antiga-1");

            trocar(bearer(nome, Perfil.LEITURA), "senha-antiga-1", "senha-nova-123").andExpect(status().isNoContent());

            entrar(nome, "senha-nova-123").andExpect(status().isOk());
            entrar(nome, "senha-antiga-1").andExpect(status().isUnauthorized());
            assertThat(usuarios.findByNome(nome).orElseThrow().getSenhaHash()).startsWith("$2").isNotEqualTo("senha-nova-123");
        }

        @Test
        void qualquerPerfilTrocaASuaSenha() throws Exception {
            for (Perfil perfil : Perfil.values()) {
                String nome = novoUsuario(perfil, "senha-antiga-1");
                trocar(bearer(nome, perfil), "senha-antiga-1", "senha-nova-123").andExpect(status().isNoContent());
            }
        }

        @Test
        void senhaAtualErradaDa400ENaoMudaNada() throws Exception {
            String nome = novoUsuario(Perfil.OPERADOR, "senha-antiga-1");

            trocar(bearer(nome, Perfil.OPERADOR), "senha-errada-99", "senha-nova-123").andExpect(status().isBadRequest());

            entrar(nome, "senha-antiga-1").andExpect(status().isOk());
        }

        @Test
        void novaSenhaForaDoTamanhoDa400() throws Exception {
            String nome = novoUsuario(Perfil.OPERADOR, "senha-antiga-1");
            String autorizacao = bearer(nome, Perfil.OPERADOR);

            trocar(autorizacao, "senha-antiga-1", "curta").andExpect(status().isBadRequest());
            trocar(autorizacao, "senha-antiga-1", "x".repeat(73)).andExpect(status().isBadRequest());
            mockMvc.perform(put("/api/auth/senha").header("Authorization", autorizacao).contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        void semTokenDa401() throws Exception {
            mockMvc.perform(put("/api/auth/senha").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"senhaAtual\":\"a\",\"novaSenha\":\"senha-nova-123\"}")).andExpect(status().isUnauthorized());
        }

        @Test
        void muitasSenhasAtuaisErradasBloqueiamPorUmTempo() throws Exception {
            String nome = novoUsuario(Perfil.LEITURA, "senha-antiga-1");
            String autorizacao = bearer(nome, Perfil.LEITURA);

            for (int i = 0; i < 5; i++) trocar(autorizacao, "errada-" + i + "-xx", "senha-nova-123").andExpect(status().isBadRequest());

            // depois de 5 falhas até a senha certa fica bloqueada por um tempo
            trocar(autorizacao, "senha-antiga-1", "senha-nova-123").andExpect(status().isTooManyRequests());
        }

        @Test
        void tokenDeUsuarioQueFoiApagadoDa401() throws Exception {
            String nome = novoUsuario(Perfil.LEITURA, "senha-antiga-1");
            String autorizacao = bearer(nome, Perfil.LEITURA);
            usuarios.delete(usuarios.findByNome(nome).orElseThrow());

            trocar(autorizacao, "senha-antiga-1", "senha-nova-123").andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @SpringBootTest(properties = "demo.proteger-usuarios=true")
    @AutoConfigureMockMvc
    class UsuarioProtegido extends Base {

        @Test
        void oDemoNaoTrocaASenhaNoSiteDeDemonstracao() throws Exception {
            trocar(bearer("demo", Perfil.OPERADOR), "demo123", "outra-senha-123").andExpect(status().isLocked());
            entrar("demo", "demo123").andExpect(status().isOk());
        }

        @Test
        void usuarioComumContinuaTrocandoASua() throws Exception {
            String nome = novoUsuario(Perfil.LEITURA, "senha-antiga-1");

            trocar(bearer(nome, Perfil.LEITURA), "senha-antiga-1", "senha-nova-123").andExpect(status().isNoContent());
        }
    }

    @Nested
    @SpringBootTest
    @AutoConfigureMockMvc
    class RenovacaoDoToken extends Base {

        private ResultActions renovar(String autorizacao) throws Exception {
            var pedido = post("/api/auth/renovar");
            if (autorizacao != null) pedido = pedido.header("Authorization", autorizacao);
            return mockMvc.perform(pedido);
        }

        @Test
        void tokenValidoRecebeUmNovoComOMesmoUsuario() throws Exception {
            String nome = novoUsuario(Perfil.OPERADOR, "senha-boa-123");

            String novo = token(renovar(bearer(nome, Perfil.OPERADOR)).andExpect(status().isOk()));

            Claims dados = tokenService.ler(novo).orElseThrow();
            assertThat(dados.getSubject()).isEqualTo(nome);
            assertThat(dados.get("perfil", String.class)).isEqualTo("OPERADOR");
            assertThat(dados.getExpiration()).isAfter(Date.from(Instant.now().plusSeconds(7000))); // mais ~2 h
        }

        @Test
        void aRenovacaoTrazOPerfilQueOUsuarioTemAgora() throws Exception {
            String nome = novoUsuario(Perfil.LEITURA, "senha-boa-123");
            String tokenAntigo = bearer(nome, Perfil.LEITURA);
            Usuario usuario = usuarios.findByNome(nome).orElseThrow();
            usuario.setPerfil(Perfil.OPERADOR); // um administrador promoveu o usuário
            usuarios.save(usuario);

            String novo = token(renovar(tokenAntigo).andExpect(status().isOk()));

            assertThat(tokenService.ler(novo).orElseThrow().get("perfil", String.class)).isEqualTo("OPERADOR");
        }

        @Test
        void oNovoTokenValeParaUsarAApi() throws Exception {
            String nome = novoUsuario(Perfil.LEITURA, "senha-boa-123");
            String novo = token(renovar(bearer(nome, Perfil.LEITURA)).andExpect(status().isOk()));

            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/alertas").header("Authorization", "Bearer " + novo))
                    .andExpect(status().isOk());
        }

        @Test
        void semTokenOuComTokenRuimDa401() throws Exception {
            renovar(null).andExpect(status().isUnauthorized());
            renovar("Bearer lixo").andExpect(status().isUnauthorized());
            renovar("sem-bearer").andExpect(status().isUnauthorized());
        }

        @Test
        void usuarioApagadoNaoRenova() throws Exception {
            String nome = novoUsuario(Perfil.LEITURA, "senha-boa-123");
            String autorizacao = bearer(nome, Perfil.LEITURA);
            usuarios.delete(usuarios.findByNome(nome).orElseThrow());

            renovar(autorizacao).andExpect(status().isUnauthorized());
        }

        @Test
        void aSessaoTemUmLimiteDeHorasDesdeOLogin() throws Exception {
            String nome = novoUsuario(Perfil.LEITURA, "senha-boa-123");
            long agora = Instant.now().getEpochSecond();

            renovar("Bearer " + tokenAntigo(nome, Perfil.LEITURA, agora - 13 * 3600, Instant.now())).andExpect(status().isUnauthorized());
            renovar("Bearer " + tokenAntigo(nome, Perfil.LEITURA, agora - 11 * 3600, Instant.now())).andExpect(status().isOk());
        }

        @Test
        void aRenovacaoGuardaOInicioDaSessaoEntaoNaoEstendeParaSempre() throws Exception {
            String nome = novoUsuario(Perfil.LEITURA, "senha-boa-123");
            long inicio = Instant.now().getEpochSecond() - 5 * 3600;

            String novo = token(renovar("Bearer " + tokenAntigo(nome, Perfil.LEITURA, inicio, Instant.now())).andExpect(status().isOk()));

            assertThat(tokenService.ler(novo).orElseThrow().get("sessao", Long.class)).isEqualTo(inicio);
        }

        @Test
        void tokenAntigoSemMarcaDeSessaoContaAPartirDaEmissao() throws Exception {
            String nome = novoUsuario(Perfil.LEITURA, "senha-boa-123");

            renovar("Bearer " + tokenAntigo(nome, Perfil.LEITURA, null, Instant.now().minusSeconds(13 * 3600))).andExpect(status().isUnauthorized());
            renovar("Bearer " + tokenAntigo(nome, Perfil.LEITURA, null, Instant.now().minusSeconds(3600))).andExpect(status().isOk());
        }
    }
}
