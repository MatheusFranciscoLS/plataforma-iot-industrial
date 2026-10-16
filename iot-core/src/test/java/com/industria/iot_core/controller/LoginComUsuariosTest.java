package com.industria.iot_core.controller;

import com.industria.iot_core.model.Usuario;
import com.industria.iot_core.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Login contra usuários guardados no banco, com senha em BCrypt e limite de tentativas (3 neste teste). */
@SpringBootTest(properties = "api.login.max-tentativas=3")
@AutoConfigureMockMvc
class LoginComUsuariosTest {

    @Autowired MockMvc mockMvc;
    @Autowired UsuarioRepository usuarios;
    @Autowired PasswordEncoder encoder;
    @MockitoBean RabbitTemplate rabbitTemplate;

    private ResultActions login(String usuario, String senha) throws Exception {
        return mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"usuario\":\"" + usuario + "\",\"senha\":\"" + senha + "\"}"));
    }

    private void criarUsuario(String nome, String senha) {
        usuarios.save(new Usuario(nome, encoder.encode(senha)));
    }

    @Test
    void usuarioDeDemonstracaoEhCriadoNaPrimeiraSubidaEConsegueEntrar() throws Exception {
        login("admin", "senha123")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void senhaFicaGuardadaSoComoHashBCrypt() {
        Usuario admin = usuarios.findByNome("admin").orElseThrow();

        assertThat(admin.getSenhaHash()).isNotEqualTo("senha123").startsWith("$2");
    }

    @Test
    void outroUsuarioDoBancoConsegueEntrarComASuaSenha() throws Exception {
        criarUsuario("maria", "outra-senha-forte");

        login("maria", "outra-senha-forte").andExpect(status().isOk());
        login("maria", "senha123").andExpect(status().isUnauthorized());
    }

    @Test
    void usuarioInexistenteRecebe401() throws Exception {
        login("ninguem", "senha123").andExpect(status().isUnauthorized());
    }

    @Test
    void depoisDeTresFalhasOLoginFicaBloqueadoMesmoComASenhaCerta() throws Exception {
        criarUsuario("bloqueado", "senha-certa-1");

        for (int i = 0; i < 3; i++) {
            login("bloqueado", "errada").andExpect(status().isUnauthorized());
        }

        login("bloqueado", "senha-certa-1").andExpect(status().isTooManyRequests());
    }

    @Test
    void loginCertoZeraAContagemDeFalhas() throws Exception {
        criarUsuario("zera", "senha-certa-2");

        login("zera", "errada").andExpect(status().isUnauthorized());
        login("zera", "errada").andExpect(status().isUnauthorized());
        login("zera", "senha-certa-2").andExpect(status().isOk());
        login("zera", "errada").andExpect(status().isUnauthorized());
        login("zera", "errada").andExpect(status().isUnauthorized());
        login("zera", "senha-certa-2").andExpect(status().isOk());
    }

    @Test
    void bloqueioDeUmUsuarioNaoAtrapalhaOutro() throws Exception {
        for (int i = 0; i < 3; i++) {
            login("alvo", "errada").andExpect(status().isUnauthorized());
        }

        login("admin", "senha123").andExpect(status().isOk());
    }
}
