package com.industria.iot_core.controller;

import com.industria.iot_core.model.Usuario.Perfil;
import com.industria.iot_core.security.TokenService;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.hasKey;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Documentação da API (OpenAPI/Swagger) e métricas (Prometheus). */
class DocumentacaoEMetricasTest {

    private static final String EXPOR_METRICAS = "management.endpoints.web.exposure.include=health,metrics,prometheus";

    @Nested
    @SpringBootTest(properties = EXPOR_METRICAS)
    @AutoConfigureMockMvc
    class Documentacao {

        @Autowired MockMvc mockMvc;
        @MockitoBean RabbitTemplate rabbitTemplate;

        @Test
        void aDocumentacaoEmJsonSaiSemTokenEListaAsRotasDoSistema() throws Exception {
            mockMvc.perform(get("/v3/api-docs"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.info.title", is("Plataforma IoT Industrial: API")))
                    .andExpect(jsonPath("$.paths", hasKey("/api/sensores")))
                    .andExpect(jsonPath("$.paths", hasKey("/api/alertas")))
                    .andExpect(jsonPath("$.paths", hasKey("/api/alertas/{id}/reconhecer")))
                    .andExpect(jsonPath("$.paths", hasKey("/api/limites/{maquina}/{tipo}")))
                    .andExpect(jsonPath("$.paths", hasKey("/api/usuarios")))
                    .andExpect(jsonPath("$.paths", hasKey("/api/auth/login")));
        }

        @Test
        void aDocumentacaoExplicaComoAutenticarComToken() throws Exception {
            mockMvc.perform(get("/v3/api-docs"))
                    .andExpect(jsonPath("$.components.securitySchemes.token-jwt.type", is("http")))
                    .andExpect(jsonPath("$.components.securitySchemes.token-jwt.scheme", is("bearer")))
                    .andExpect(jsonPath("$.components.securitySchemes.token-jwt.bearerFormat", is("JWT")));
        }

        @Test
        void asRotasPublicasNaoMostramCadeadoENemAsProtegidasEsquecem() throws Exception {
            mockMvc.perform(get("/v3/api-docs"))
                    .andExpect(jsonPath("$.paths['/api/auth/login'].post.security.length()", is(0)))
                    .andExpect(jsonPath("$.paths['/api/sensores'].post.security.length()", is(0)))
                    // o cadeado das rotas protegidas vem da exigência geral de token, no topo da documentação
                    .andExpect(jsonPath("$.security[0].token-jwt").exists());
        }

        @Test
        void aTelaDoSwaggerAbreSemToken() throws Exception {
            mockMvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
        }

        @Test
        void asRotasContinuamProtegidasMesmoComADocumentacaoAberta() throws Exception {
            mockMvc.perform(get("/api/alertas")).andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @SpringBootTest(properties = {EXPOR_METRICAS, "springdoc.api-docs.enabled=false", "springdoc.swagger-ui.enabled=false"})
    @AutoConfigureMockMvc
    class DocumentacaoDesligada {

        @Autowired MockMvc mockMvc;
        @MockitoBean RabbitTemplate rabbitTemplate;

        @Test
        void comDocsAtivasFalseADocumentacaoNaoExiste() throws Exception {
            mockMvc.perform(get("/v3/api-docs")).andExpect(status().isNotFound());
        }
    }

    @Nested
    @SpringBootTest(properties = EXPOR_METRICAS)
    @AutoConfigureMockMvc
    class Metricas {

        @Autowired MockMvc mockMvc;
        @Autowired TokenService tokenService;
        @MockitoBean RabbitTemplate rabbitTemplate;

        private String como(Perfil perfil) {
            return "Bearer " + tokenService.gerarToken("metricas-" + perfil, perfil);
        }

        private void enviar(String maquina, long timestamp, double temperatura) throws Exception {
            mockMvc.perform(post("/api/sensores").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"idMaquina\":\"" + maquina + "\",\"timestamp\":" + timestamp
                                    + ",\"temperaturaMotor\":" + temperatura + ",\"vibracao\":1.0,\"rpm\":1500}"))
                    .andExpect(status().isOk());
        }

        private String prometheus() throws Exception {
            return mockMvc.perform(get("/actuator/prometheus").header("Authorization", como(Perfil.ADMIN)))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        }

        @Test
        void aSaudeContinuaPublica() throws Exception {
            mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
        }

        @Test
        void asMetricasExigemTokenDeAdministrador() throws Exception {
            mockMvc.perform(get("/actuator/prometheus")).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/actuator/prometheus").header("Authorization", como(Perfil.LEITURA))).andExpect(status().isForbidden());
            mockMvc.perform(get("/actuator/prometheus").header("Authorization", como(Perfil.OPERADOR))).andExpect(status().isForbidden());
            mockMvc.perform(get("/actuator/metrics").header("Authorization", como(Perfil.OPERADOR))).andExpect(status().isForbidden());
            mockMvc.perform(get("/actuator/prometheus").header("Authorization", como(Perfil.ADMIN))).andExpect(status().isOk());
        }

        @Test
        void aListaDeMetricasDoSpringTambemSaiParaOAdministrador() throws Exception {
            mockMvc.perform(get("/actuator/metrics").header("Authorization", como(Perfil.ADMIN)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.names", hasItem("jvm.memory.used")));
        }

        @Test
        void leituraRecebidaEContadaPorMaquina() throws Exception {
            enviar("MET-CONTA", 1000, 80.0);
            enviar("MET-CONTA", 1002, 81.0);

            assertThat(prometheus()).containsPattern("iot_leituras_recebidas_total\\{[^}]*maquina=\"MET-CONTA\"[^}]*\\} 2\\.0");
        }

        @Test
        void alertaGeradoEContadoPorTipo() throws Exception {
            enviar("MET-ALERTA", 1000, 99.0);

            assertThat(prometheus()).containsPattern("iot_alertas_gerados_total\\{[^}]*tipo=\"TEMPERATURA\"[^}]*\\} [1-9]");
        }

        @Test
        void falhaDoRabbitMqEContadaEALeituraContinuaSalva() throws Exception {
            doThrow(new AmqpException("fila fora do ar")).when(rabbitTemplate).convertAndSend(anyString(), anyString());

            enviar("MET-FILA", 1000, 80.0);

            assertThat(prometheus()).containsPattern("iot_rabbitmq_falhas_total\\{[^}]*\\} [1-9]");
        }

        @Test
        void oNumeroDeAlertasPendentesApareceENaoFicaNegativo() throws Exception {
            enviar("MET-PENDENTE", 1000, 99.0);

            assertThat(prometheus()).containsPattern("iot_alertas_pendentes\\{[^}]*\\} [1-9]");
        }

        @Test
        void asMetricasLevamAEtiquetaDaAplicacao() throws Exception {
            assertThat(prometheus()).contains("application=\"iot-core\"");
        }
    }
}
