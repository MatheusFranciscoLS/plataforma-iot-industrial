package com.industria.iot_core.controller;

import com.industria.iot_core.model.Usuario.Perfil;
import com.industria.iot_core.security.TokenService;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** O Prometheus busca as métricas com um token fixo (METRICAS_TOKEN), que não abre mais nada. */
class TokenDeMetricasTest {

    private static final String EXPOR = "management.endpoints.web.exposure.include=health,metrics,prometheus";

    @Nested
    @SpringBootTest(properties = {EXPOR, "metricas.token=token-do-prometheus-de-teste"})
    @AutoConfigureMockMvc
    class ComTokenDefinido {

        @Autowired MockMvc mockMvc;
        @Autowired TokenService tokenService;
        @MockitoBean RabbitTemplate rabbitTemplate;

        @Test
        void oPrometheusBuscaAsMetricasComOTokenFixo() throws Exception {
            mockMvc.perform(get("/actuator/prometheus").header("Authorization", "Bearer token-do-prometheus-de-teste"))
                    .andExpect(status().isOk())
                    .andExpect(content().string(containsString("jvm_memory_used_bytes")));
        }

        @Test
        void tambemLeAListaDeMetricas() throws Exception {
            mockMvc.perform(get("/actuator/metrics").header("Authorization", "Bearer token-do-prometheus-de-teste")).andExpect(status().isOk());
            mockMvc.perform(get("/actuator/metrics/jvm.memory.used").header("Authorization", "Bearer token-do-prometheus-de-teste")).andExpect(status().isOk());
        }

        @Test
        void tokenErradoOuVazioNaoAbre() throws Exception {
            mockMvc.perform(get("/actuator/prometheus").header("Authorization", "Bearer outro-token")).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/actuator/prometheus").header("Authorization", "Bearer ")).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/actuator/prometheus").header("Authorization", "token-do-prometheus-de-teste")).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/actuator/prometheus")).andExpect(status().isUnauthorized());
        }

        @Test
        void oTokenDeMetricasNaoAbreAsRotasDaApi() throws Exception {
            String cabecalho = "Bearer token-do-prometheus-de-teste";

            mockMvc.perform(get("/api/alertas").header("Authorization", cabecalho)).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/api/usuarios").header("Authorization", cabecalho)).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/api/sensores").header("Authorization", cabecalho)).andExpect(status().isUnauthorized());
        }

        @Test
        void oTokenNaoValeEmOutrasRotasDoActuatorNemParaEscrever() throws Exception {
            String cabecalho = "Bearer token-do-prometheus-de-teste";

            mockMvc.perform(get("/actuator/env").header("Authorization", cabecalho)).andExpect(status().isUnauthorized());
            mockMvc.perform(post("/actuator/prometheus").header("Authorization", cabecalho)).andExpect(status().is4xxClientError());
        }

        @Test
        void administradorLogadoContinuaVendoAsMetricas() throws Exception {
            mockMvc.perform(get("/actuator/prometheus").header("Authorization", "Bearer " + tokenService.gerarToken("adm", Perfil.ADMIN)))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/actuator/prometheus").header("Authorization", "Bearer " + tokenService.gerarToken("op", Perfil.OPERADOR)))
                    .andExpect(status().isForbidden());
        }

        @Test
        void aSaudeContinuaPublica() throws Exception {
            mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
        }
    }

    @Nested
    @SpringBootTest(properties = EXPOR)
    @AutoConfigureMockMvc
    class SemTokenDefinido {

        @Autowired MockMvc mockMvc;
        @MockitoBean RabbitTemplate rabbitTemplate;

        @Test
        void semMetricasTokenNaoExisteEntradaPorTokenFixo() throws Exception {
            mockMvc.perform(get("/actuator/prometheus").header("Authorization", "Bearer ")).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/actuator/prometheus").header("Authorization", "Bearer qualquer-coisa")).andExpect(status().isUnauthorized());
        }
    }
}
