package com.industria.iot_core.controller;

import com.industria.iot_core.model.Usuario.Perfil;
import com.industria.iot_core.repository.UsuarioRepository;
import com.industria.iot_core.security.TokenService;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Proteção do site de demonstração (PROTEGER_USUARIOS): o acesso de administrador é público, então ele não pode estragar o demo. */
class ProtecaoDoDemoTest {

    abstract static class Base {
        @Autowired MockMvc mockMvc;
        @Autowired TokenService tokenService;
        @Autowired UsuarioRepository usuarios;
        @MockitoBean RabbitTemplate rabbitTemplate;

        String admin() {
            return "Bearer " + tokenService.gerarToken("quem-chama", Perfil.ADMIN);
        }

        ResultActions criar(String nome, String perfil) throws Exception {
            return mockMvc.perform(post("/api/usuarios").header("Authorization", admin()).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"nome\":\"" + nome + "\",\"senha\":\"senha-boa-123\",\"perfil\":\"" + perfil + "\"}"));
        }
    }

    @Nested
    @SpringBootTest(properties = {"demo.proteger-usuarios=true", "demo.max-usuarios=5"})
    @AutoConfigureMockMvc
    @Transactional // o que cada teste cria ou tenta apagar volta ao normal no fim
    class Ligada extends Base {

        @Test
        void oAdministradorEODemoNaoSaemNemMudam() throws Exception {
            for (String nome : new String[] {"admin", "demo"}) {
                mockMvc.perform(delete("/api/usuarios/" + nome).header("Authorization", admin())).andExpect(status().isLocked());
                mockMvc.perform(put("/api/usuarios/" + nome + "/senha").header("Authorization", admin())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"senha\":\"outra-senha-123\"}")).andExpect(status().isLocked());
                mockMvc.perform(put("/api/usuarios/" + nome + "/perfil").header("Authorization", admin())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"perfil\":\"LEITURA\"}")).andExpect(status().isLocked());
            }
            assertThat(usuarios.findByNome("admin")).get().extracting(u -> u.getPerfil()).isEqualTo(Perfil.ADMIN);
            assertThat(usuarios.findByNome("demo")).isPresent();
        }

        @Test
        void aListaAvisaQuaisUsuariosSaoProtegidos() throws Exception {
            criar("visitante", "LEITURA").andExpect(status().isCreated()).andExpect(jsonPath("$.protegido", is(false)));

            mockMvc.perform(get("/api/usuarios").header("Authorization", admin()))
                    .andExpect(jsonPath("$[?(@.nome=='admin')].protegido", contains(true)))
                    .andExpect(jsonPath("$[?(@.nome=='demo')].protegido", contains(true)))
                    .andExpect(jsonPath("$[?(@.nome=='visitante')].protegido", contains(false)));
        }

        @Test
        void usuarioCriadoPorVisitanteContinuaPodendoSerMudadoEApagado() throws Exception {
            criar("visitante", "LEITURA").andExpect(status().isCreated());

            mockMvc.perform(put("/api/usuarios/visitante/perfil").header("Authorization", admin())
                    .contentType(MediaType.APPLICATION_JSON).content("{\"perfil\":\"OPERADOR\"}")).andExpect(status().isOk());
            mockMvc.perform(put("/api/usuarios/visitante/senha").header("Authorization", admin())
                    .contentType(MediaType.APPLICATION_JSON).content("{\"senha\":\"outra-senha-123\"}")).andExpect(status().isNoContent());
            mockMvc.perform(delete("/api/usuarios/visitante").header("Authorization", admin())).andExpect(status().isNoContent());
        }

        @Test
        void naoCriaNemPromoveAdministrador() throws Exception {
            criar("novo-admin", "ADMIN").andExpect(status().isLocked());

            criar("visitante", "LEITURA").andExpect(status().isCreated());
            mockMvc.perform(put("/api/usuarios/visitante/perfil").header("Authorization", admin())
                    .contentType(MediaType.APPLICATION_JSON).content("{\"perfil\":\"ADMIN\"}")).andExpect(status().isLocked());
            assertThat(usuarios.findByNome("novo-admin")).isEmpty();
        }

        @Test
        void haUmTetoDeUsuarios() throws Exception {
            // admin e demo já existem; o teto de 5 deixa criar mais 3
            criar("visitante1", "LEITURA").andExpect(status().isCreated());
            criar("visitante2", "LEITURA").andExpect(status().isCreated());
            criar("visitante3", "OPERADOR").andExpect(status().isCreated());

            criar("visitante4", "LEITURA").andExpect(status().isLocked());
        }

        @Test
        void quemNaoEAdministradorContinuaSemAcessoEntaoNaoMudaDeRegra() throws Exception {
            mockMvc.perform(get("/api/usuarios").header("Authorization", "Bearer " + tokenService.gerarToken("op", Perfil.OPERADOR)))
                    .andExpect(status().isForbidden());
        }
    }

    @Nested
    @SpringBootTest
    @AutoConfigureMockMvc
    @Transactional
    class DesligadaPorPadrao extends Base {

        @Test
        void semaProtecaoOAdministradorPodeCriarOutroAdministradorEMexerNosUsuariosIniciais() throws Exception {
            criar("admin-extra", "ADMIN").andExpect(status().isCreated());

            mockMvc.perform(put("/api/usuarios/demo/senha").header("Authorization", admin())
                    .contentType(MediaType.APPLICATION_JSON).content("{\"senha\":\"outra-senha-123\"}")).andExpect(status().isNoContent());
            mockMvc.perform(get("/api/usuarios").header("Authorization", admin()))
                    .andExpect(jsonPath("$[?(@.nome=='demo')].protegido", contains(false)));
        }
    }
}
