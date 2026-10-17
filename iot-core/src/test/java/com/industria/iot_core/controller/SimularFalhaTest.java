package com.industria.iot_core.controller;

import com.industria.iot_core.model.Usuario.Perfil;
import com.industria.iot_core.security.TokenService;
import com.industria.iot_core.service.SimuladorDemo;
import com.industria.iot_core.service.TipoDeFalha;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Botão "Simular falha": só com o modo demonstração ligado, só para operador e administrador, com espera entre pedidos. */
class SimularFalhaTest {

    /** Um relógio que o teste adianta à mão, para conferir a espera sem esperar de verdade. */
    static final class RelogioManual extends Clock {
        final AtomicLong agoraMs = new AtomicLong(1_700_000_000_000L);

        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return Instant.ofEpochMilli(agoraMs.get()); }
        void avancar(Duration d) { agoraMs.addAndGet(d.toMillis()); }
    }

    @Nested
    @SpringBootTest(properties = {"demo.simulador.ativo=true", "demo.simulador.intervalo-ms=100", "demo.simulador.espera-falha-segundos=30"})
    @AutoConfigureMockMvc
    class ModoDemonstracaoLigado {

        @TestConfiguration
        static class Relogio {
            @Bean @Primary RelogioManual relogioManual() { return new RelogioManual(); }
        }

        @Autowired MockMvc mockMvc;
        @Autowired TokenService tokenService;
        @Autowired SimuladorDemo simulador;
        @Autowired RelogioManual relogio;
        @MockitoBean RabbitTemplate rabbitTemplate;

        private String como(Perfil perfil) {
            return "Bearer " + tokenService.gerarToken("falha-" + perfil, perfil);
        }

        @Test
        void estadoDizQueODemoEstaLigadoEQuaisMaquinasExistem() throws Exception {
            mockMvc.perform(get("/api/demo/estado").header("Authorization", como(Perfil.LEITURA)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.simulador", is(true)))
                    .andExpect(jsonPath("$.maquinas", hasItems("MAQ-01", "MAQ-02", "MAQ-03")))
                    .andExpect(jsonPath("$.esperaEntreFalhasSegundos", is(30)));
        }

        @Test
        void operadorProvocaFalhaEARespostaDizQuantoDura() throws Exception {
            mockMvc.perform(post("/api/demo/falha/MAQ-01").header("Authorization", como(Perfil.OPERADOR)))
                    .andExpect(status().isAccepted())
                    .andExpect(jsonPath("$.maquina", is("MAQ-01")))
                    .andExpect(jsonPath("$.tipo", is("AMBAS")))
                    .andExpect(jsonPath("$.duracaoSegundos").isNumber());
        }

        @Test
        void administradorEscolheOTipoDaFalha() throws Exception {
            mockMvc.perform(post("/api/demo/falha/MAQ-02").header("Authorization", como(Perfil.ADMIN))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"tipo\":\"VIBRACAO\"}"))
                    .andExpect(status().isAccepted())
                    .andExpect(jsonPath("$.tipo", is("VIBRACAO")));
        }

        @Test
        void somenteLeituraNaoProvocaFalha() throws Exception {
            mockMvc.perform(post("/api/demo/falha/MAQ-01").header("Authorization", como(Perfil.LEITURA))).andExpect(status().isForbidden());
        }

        @Test
        void semTokenDa401() throws Exception {
            mockMvc.perform(post("/api/demo/falha/MAQ-01")).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/api/demo/estado")).andExpect(status().isUnauthorized());
        }

        @Test
        void maquinaQueNaoExisteDa404() throws Exception {
            mockMvc.perform(post("/api/demo/falha/MAQ-99").header("Authorization", como(Perfil.OPERADOR))).andExpect(status().isNotFound());
        }

        @Test
        void tipoInvalidoDa400() throws Exception {
            mockMvc.perform(post("/api/demo/falha/MAQ-03").header("Authorization", como(Perfil.OPERADOR))
                    .contentType(MediaType.APPLICATION_JSON).content("{\"tipo\":\"EXPLOSAO\"}")).andExpect(status().isBadRequest());
        }

        @Test
        void segundoPedidoNaMesmaMaquinaEsperaEDepoisPassa() throws Exception {
            simulador.provocarFalha("MAQ-03", TipoDeFalha.TEMPERATURA); // primeiro pedido

            mockMvc.perform(post("/api/demo/falha/MAQ-03").header("Authorization", como(Perfil.OPERADOR)))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(header().string("Retry-After", "30"));

            relogio.avancar(Duration.ofSeconds(10));
            mockMvc.perform(post("/api/demo/falha/MAQ-03").header("Authorization", como(Perfil.OPERADOR)))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(header().string("Retry-After", "20"));

            relogio.avancar(Duration.ofSeconds(21));
            mockMvc.perform(post("/api/demo/falha/MAQ-03").header("Authorization", como(Perfil.OPERADOR))).andExpect(status().isAccepted());
        }

        @Test
        void aEsperaECadaMaquinaTemASua() {
            assertThat(simulador.provocarFalha("MAQ-01", TipoDeFalha.AMBAS).aceita()).isTrue();
            assertThat(simulador.provocarFalha("MAQ-02", TipoDeFalha.AMBAS).aceita()).isTrue();
            assertThat(simulador.provocarFalha("MAQ-01", TipoDeFalha.AMBAS).aceita()).isFalse();
        }


        @Test
        void maquinaDesconhecidaNoServicoLancaErro() {
            assertThatThrownBy(() -> simulador.provocarFalha("MAQ-99", TipoDeFalha.AMBAS)).isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @SpringBootTest
    @AutoConfigureMockMvc
    class ModoDemonstracaoDesligado {

        @Autowired MockMvc mockMvc;
        @Autowired TokenService tokenService;
        @MockitoBean RabbitTemplate rabbitTemplate;

        @Test
        void asRotasNemExistemEOPainelEscondeOBotao() throws Exception {
            String token = "Bearer " + tokenService.gerarToken("op", Perfil.OPERADOR);

            mockMvc.perform(get("/api/demo/estado").header("Authorization", token)).andExpect(status().isNotFound());
            mockMvc.perform(post("/api/demo/falha/MAQ-01").header("Authorization", token)).andExpect(status().isNotFound());
        }
    }
}
