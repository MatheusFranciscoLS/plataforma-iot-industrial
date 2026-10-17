package com.industria.iot_core.controller;

import com.industria.iot_core.model.Usuario;
import com.industria.iot_core.model.Usuario.Perfil;
import com.industria.iot_core.repository.UsuarioRepository;
import com.industria.iot_core.security.TokenService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
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
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Perfis (ADMIN, OPERADOR, LEITURA): quem pode o quê, e a gerência de usuários. */
@SpringBootTest
@AutoConfigureMockMvc
class UsuariosEPerfisTest {

    @Autowired MockMvc mockMvc;
    @Autowired TokenService tokenService;
    @Autowired UsuarioRepository usuarios;
    @Autowired PasswordEncoder encoder;
    @Value("${api.security.token.secret}") String segredo;
    @MockitoBean RabbitTemplate rabbitTemplate;

    private String como(Perfil perfil) {
        return "Bearer " + tokenService.gerarToken("teste-" + perfil, perfil);
    }

    private String nomeNovo() {
        return "u" + UUID.randomUUID().toString().substring(0, 8);
    }

    private ResultActions criar(String autorizacao, String nome, String senha, String perfil) throws Exception {
        return mockMvc.perform(post("/api/usuarios").header("Authorization", autorizacao).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"" + nome + "\",\"senha\":\"" + senha + "\",\"perfil\":\"" + perfil + "\"}"));
    }

    private String login(String nome, String senha) throws Exception {
        String corpo = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"usuario\":\"" + nome + "\",\"senha\":\"" + senha + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return corpo.replaceAll(".*\"token\":\"([^\"]+)\".*", "$1");
    }

    private static String dadosDoToken(String token) {
        return new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]), StandardCharsets.UTF_8);
    }

    // ---- LEITURA só olha ----

    @Test
    void leituraPodeVerAlertasELimites() throws Exception {
        mockMvc.perform(get("/api/alertas").header("Authorization", como(Perfil.LEITURA))).andExpect(status().isOk());
        mockMvc.perform(get("/api/limites").header("Authorization", como(Perfil.LEITURA))).andExpect(status().isOk());
        mockMvc.perform(get("/api/sensores").header("Authorization", como(Perfil.LEITURA))).andExpect(status().isOk());
    }

    @Test
    void leituraNaoReconheceAlertaNemTrocaLimite() throws Exception {
        String leitura = como(Perfil.LEITURA);
        mockMvc.perform(post("/api/alertas/1/reconhecer").header("Authorization", leitura)).andExpect(status().isForbidden());
        mockMvc.perform(put("/api/limites/MAQ-01/TEMPERATURA").header("Authorization", leitura)
                .contentType(MediaType.APPLICATION_JSON).content("{\"limite\": 80}")).andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/limites/MAQ-01/TEMPERATURA").header("Authorization", leitura)).andExpect(status().isForbidden());
    }

    @Test
    void leituraNaoGerenciaUsuarios() throws Exception {
        String leitura = como(Perfil.LEITURA);
        mockMvc.perform(get("/api/usuarios").header("Authorization", leitura)).andExpect(status().isForbidden());
        criar(leitura, nomeNovo(), "senha-boa-123", "ADMIN").andExpect(status().isForbidden());
    }

    // ---- OPERADOR reconhece e troca limites, mas não gerencia usuários ----

    @Test
    void operadorReconheceAlertaETrocaLimite() throws Exception {
        String operador = como(Perfil.OPERADOR);
        // 404 (alerta que não existe) prova que passou pela regra de acesso; 403 seria recusa
        mockMvc.perform(post("/api/alertas/999999/reconhecer").header("Authorization", operador)).andExpect(status().isNotFound());
        mockMvc.perform(put("/api/limites/PERFIL-OP/TEMPERATURA").header("Authorization", operador)
                .contentType(MediaType.APPLICATION_JSON).content("{\"limite\": 88}")).andExpect(status().isOk());
        mockMvc.perform(delete("/api/limites/PERFIL-OP/TEMPERATURA").header("Authorization", operador)).andExpect(status().isNoContent());
    }

    @Test
    void operadorNaoGerenciaUsuarios() throws Exception {
        String operador = como(Perfil.OPERADOR);
        mockMvc.perform(get("/api/usuarios").header("Authorization", operador)).andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/usuarios/admin").header("Authorization", operador)).andExpect(status().isForbidden());
    }

    // ---- token ----

    @Test
    void tokenSemPerfilValeSoComoLeitura() throws Exception {
        String antigo = Jwts.builder().subject("antigo").issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60000))
                .signWith(Keys.hmacShaKeyFor(segredo.getBytes(StandardCharsets.UTF_8))).compact();

        mockMvc.perform(get("/api/alertas").header("Authorization", "Bearer " + antigo)).andExpect(status().isOk());
        mockMvc.perform(put("/api/limites/MAQ-01/TEMPERATURA").header("Authorization", "Bearer " + antigo)
                .contentType(MediaType.APPLICATION_JSON).content("{\"limite\": 80}")).andExpect(status().isForbidden());
    }

    @Test
    void perfilDesconhecidoNoTokenVaiParaLeitura() {
        assertThat(Perfil.deTexto("SUPERUSUARIO")).isEqualTo(Perfil.LEITURA);
        assertThat(Perfil.deTexto(null)).isEqualTo(Perfil.LEITURA);
        assertThat(Perfil.deTexto("ADMIN")).isEqualTo(Perfil.ADMIN);
    }

    @Test
    void semTokenOuComTokenInvalidoDa401() throws Exception {
        mockMvc.perform(get("/api/usuarios")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/alertas").header("Authorization", "Bearer lixo")).andExpect(status().isUnauthorized());
    }

    // ---- usuários iniciais e login ----

    @Test
    void oAdministradorEODemoNascemComSeusPerfis() {
        assertThat(usuarios.findByNome("admin")).get().extracting(Usuario::getPerfil).isEqualTo(Perfil.ADMIN);
        assertThat(usuarios.findByNome("demo")).get().extracting(Usuario::getPerfil).isEqualTo(Perfil.OPERADOR);
    }

    @Test
    void oTokenDoLoginTrazOPerfilDoUsuario() throws Exception {
        assertThat(dadosDoToken(login("admin", "senha123"))).contains("\"perfil\":\"ADMIN\"");
        assertThat(dadosDoToken(login("demo", "demo123"))).contains("\"perfil\":\"OPERADOR\"");
    }

    // ---- gerência de usuários (ADMIN) ----

    @Test
    void adminCriaUsuarioQueConsegueEntrarComOPerfilEscolhido() throws Exception {
        String nome = nomeNovo();
        criar(como(Perfil.ADMIN), nome, "senha-boa-123", "LEITURA")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nome", is(nome)))
                .andExpect(jsonPath("$.perfil", is("LEITURA")))
                .andExpect(jsonPath("$.senha").doesNotExist())
                .andExpect(jsonPath("$.senhaHash").doesNotExist());

        assertThat(dadosDoToken(login(nome, "senha-boa-123"))).contains("\"perfil\":\"LEITURA\"");
        assertThat(usuarios.findByNome(nome).orElseThrow().getSenhaHash()).isNotEqualTo("senha-boa-123").startsWith("$2");
    }

    @Test
    void listaOsUsuariosSemMostrarSenha() throws Exception {
        mockMvc.perform(get("/api/usuarios").header("Authorization", como(Perfil.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].nome", hasItem("admin")))
                .andExpect(jsonPath("$[0].senhaHash").doesNotExist());
    }

    @Test
    void nomeRepetidoDa409() throws Exception {
        criar(como(Perfil.ADMIN), "admin", "senha-boa-123", "LEITURA").andExpect(status().isConflict());
    }

    @Test
    void dadosInvalidosNaCriacaoDao400() throws Exception {
        String admin = como(Perfil.ADMIN);
        criar(admin, "ab", "senha-boa-123", "LEITURA").andExpect(status().isBadRequest());           // nome curto
        criar(admin, "nome com espaco", "senha-boa-123", "LEITURA").andExpect(status().isBadRequest());
        criar(admin, nomeNovo(), "curta", "LEITURA").andExpect(status().isBadRequest());            // senha curta
        criar(admin, nomeNovo(), "x".repeat(73), "LEITURA").andExpect(status().isBadRequest());      // BCrypt corta em 72
        criar(admin, nomeNovo(), "senha-boa-123", "SUPERUSUARIO").andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/usuarios").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void adminTrocaASenhaDeUmUsuario() throws Exception {
        String nome = nomeNovo();
        criar(como(Perfil.ADMIN), nome, "senha-antiga-1", "OPERADOR").andExpect(status().isCreated());

        mockMvc.perform(put("/api/usuarios/" + nome + "/senha").header("Authorization", como(Perfil.ADMIN))
                .contentType(MediaType.APPLICATION_JSON).content("{\"senha\":\"senha-nova-123\"}")).andExpect(status().isNoContent());

        login(nome, "senha-nova-123");
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"usuario\":\"" + nome + "\",\"senha\":\"senha-antiga-1\"}")).andExpect(status().isUnauthorized());
    }

    @Test
    void adminTrocaOPerfilDeUmUsuario() throws Exception {
        String nome = nomeNovo();
        criar(como(Perfil.ADMIN), nome, "senha-boa-123", "LEITURA").andExpect(status().isCreated());

        mockMvc.perform(put("/api/usuarios/" + nome + "/perfil").header("Authorization", como(Perfil.ADMIN))
                .contentType(MediaType.APPLICATION_JSON).content("{\"perfil\":\"OPERADOR\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.perfil", is("OPERADOR")));
        assertThat(dadosDoToken(login(nome, "senha-boa-123"))).contains("\"perfil\":\"OPERADOR\"");
    }

    @Test
    void adminApagaUsuarioEOUsuarioNaoEntraMais() throws Exception {
        String nome = nomeNovo();
        criar(como(Perfil.ADMIN), nome, "senha-boa-123", "LEITURA").andExpect(status().isCreated());

        mockMvc.perform(delete("/api/usuarios/" + nome).header("Authorization", como(Perfil.ADMIN))).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/usuarios").header("Authorization", como(Perfil.ADMIN)))
                .andExpect(jsonPath("$[*].nome", not(hasItem(nome))));
        mockMvc.perform(delete("/api/usuarios/" + nome).header("Authorization", como(Perfil.ADMIN))).andExpect(status().isNotFound());
    }

    @Test
    void ninguemApagaOProprioUsuario() throws Exception {
        String nome = nomeNovo();
        criar(como(Perfil.ADMIN), nome, "senha-boa-123", "ADMIN").andExpect(status().isCreated());
        String proprio = "Bearer " + tokenService.gerarToken(nome, Perfil.ADMIN);

        mockMvc.perform(delete("/api/usuarios/" + nome).header("Authorization", proprio)).andExpect(status().isConflict());
    }

    @Test
    @Transactional // o que este teste apaga volta ao normal no fim, para não atrapalhar os outros
    void oUltimoAdministradorNaoSaiNemPerdeOPerfil() throws Exception {
        usuarios.findAll().stream().filter(u -> u.getPerfil() == Perfil.ADMIN).forEach(usuarios::delete);
        usuarios.save(new Usuario("unico-admin", encoder.encode("senha-boa-123"), Perfil.ADMIN));
        usuarios.flush();
        String outroAdmin = como(Perfil.ADMIN); // o token é de "teste-ADMIN", que não é o último administrador

        mockMvc.perform(delete("/api/usuarios/unico-admin").header("Authorization", outroAdmin)).andExpect(status().isConflict());
        mockMvc.perform(put("/api/usuarios/unico-admin/perfil").header("Authorization", outroAdmin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"perfil\":\"LEITURA\"}")).andExpect(status().isConflict());

        assertThat(usuarios.countByPerfil(Perfil.ADMIN)).isEqualTo(1);
    }

    @Test
    void usuarioQueNaoExisteDa404() throws Exception {
        String admin = como(Perfil.ADMIN);
        mockMvc.perform(put("/api/usuarios/ninguem/senha").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"senha\":\"senha-nova-123\"}")).andExpect(status().isNotFound());
        mockMvc.perform(put("/api/usuarios/ninguem/perfil").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"perfil\":\"LEITURA\"}")).andExpect(status().isNotFound());
    }
}
