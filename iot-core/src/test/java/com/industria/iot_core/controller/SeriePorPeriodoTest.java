package com.industria.iot_core.controller;

import com.industria.iot_core.model.Alerta;
import com.industria.iot_core.model.RegistroSensor;
import com.industria.iot_core.model.Usuario.Perfil;
import com.industria.iot_core.repository.AlertaRepository;
import com.industria.iot_core.repository.RegistroSensorRepository;
import com.industria.iot_core.security.TokenService;
import com.industria.iot_core.service.Periodo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Séries e resumos por período, com a hora fixa para os números saírem exatos. */
@SpringBootTest(properties = "serie.cache-segundos=0")
@AutoConfigureMockMvc
class SeriePorPeriodoTest {

    // 1_700_000_000 = 2023-11-14 22:13:20 UTC
    static final long AGORA = 1_700_000_000L;

    @TestConfiguration
    static class RelogioFixo {
        @Bean
        @Primary
        Clock relogioDeTeste() {
            return Clock.fixed(Instant.ofEpochSecond(AGORA), ZoneOffset.UTC);
        }
    }

    @Autowired MockMvc mockMvc;
    @Autowired TokenService tokenService;
    @Autowired RegistroSensorRepository leituras;
    @Autowired AlertaRepository alertas;
    @MockitoBean RabbitTemplate rabbitTemplate;

    private String como(Perfil perfil) {
        return "Bearer " + tokenService.gerarToken("serie-" + perfil, perfil);
    }

    private void leitura(String maquina, long timestamp, double temperatura, double vibracao, int rpm) {
        RegistroSensor r = new RegistroSensor();
        r.setIdMaquina(maquina);
        r.setTimestamp(timestamp);
        r.setTemperaturaMotor(temperatura);
        r.setVibracao(vibracao);
        r.setRpm(rpm);
        leituras.save(r);
    }

    @BeforeEach
    void limpar() {
        leituras.deleteAll();
        alertas.deleteAll();
        // MAQ-A: duas leituras na mesma faixa de 1 min (as 2 mais recentes) e uma numa faixa mais antiga
        leitura("MAQ-A", AGORA - 20, 80.0, 2.0, 1000);
        leitura("MAQ-A", AGORA - 10, 90.0, 4.0, 2000);
        leitura("MAQ-A", AGORA - 600, 70.0, 1.0, 1500);
        // MAQ-B: uma leitura
        leitura("MAQ-B", AGORA - 30, 60.0, 3.0, 1800);
        // fora de 1 h, dentro de 6 h
        leitura("MAQ-A", AGORA - 2 * 3600, 50.0, 0.5, 1200);
        // fora de 6 h, dentro de 24 h
        leitura("MAQ-A", AGORA - 10 * 3600, 40.0, 0.4, 1100);
    }

    // ---- série ----

    @Test
    void umaHoraAgrupaPorMinutoComMediaEMaximo() throws Exception {
        mockMvc.perform(get("/api/sensores/serie?periodo=1h").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.periodo", is("1h")))
                .andExpect(jsonPath("$.faixaSegundos", is(60)))
                .andExpect(jsonPath("$.ate", is((int) AGORA)))
                .andExpect(jsonPath("$.de", is((int) (AGORA - 3600))))
                .andExpect(jsonPath("$.maquinas", hasSize(2)))
                .andExpect(jsonPath("$.maquinas[0].idMaquina", is("MAQ-A")))
                .andExpect(jsonPath("$.maquinas[0].pontos", hasSize(2)))
                // faixa mais antiga (-600 s) vem primeiro
                .andExpect(jsonPath("$.maquinas[0].pontos[0].leituras", is(1)))
                .andExpect(jsonPath("$.maquinas[0].pontos[0].temperatura", closeTo(70.0, 0.001)))
                // a faixa recente junta as duas leituras: média 85, máximo 90
                .andExpect(jsonPath("$.maquinas[0].pontos[1].leituras", is(2)))
                .andExpect(jsonPath("$.maquinas[0].pontos[1].temperatura", closeTo(85.0, 0.001)))
                .andExpect(jsonPath("$.maquinas[0].pontos[1].temperaturaMax", closeTo(90.0, 0.001)))
                .andExpect(jsonPath("$.maquinas[0].pontos[1].vibracao", closeTo(3.0, 0.001)))
                .andExpect(jsonPath("$.maquinas[0].pontos[1].vibracaoMax", closeTo(4.0, 0.001)))
                .andExpect(jsonPath("$.maquinas[0].pontos[1].rpm", closeTo(1500.0, 0.001)))
                .andExpect(jsonPath("$.maquinas[1].idMaquina", is("MAQ-B")))
                .andExpect(jsonPath("$.maquinas[1].pontos", hasSize(1)));
    }

    @Test
    void oInicioDaFaixaVemEmSegundosEAlinhadoAoTamanhoDaFaixa() throws Exception {
        var resultado = mockMvc.perform(get("/api/sensores/serie?periodo=1h&maquina=MAQ-B").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        // AGORA - 30 = 1_699_999_970; a faixa de 60 s que o contém começa em 1_699_999_920
        assertThat(resultado).contains("\"t\":1699999920");
    }

    @Test
    void filtroPorMaquinaDevolveSoEla() throws Exception {
        mockMvc.perform(get("/api/sensores/serie?periodo=1h&maquina=MAQ-B").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(jsonPath("$.maquinas", hasSize(1)))
                .andExpect(jsonPath("$.maquinas[0].idMaquina", is("MAQ-B")));
    }

    @Test
    void seisHorasUsaFaixasDeCincoMinutosEIncluiAsLeiturasMaisAntigas() throws Exception {
        mockMvc.perform(get("/api/sensores/serie?periodo=6h&maquina=MAQ-A").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(jsonPath("$.faixaSegundos", is(300)))
                // -2 h entra; -10 h ainda não; e as leituras de -10 s, -20 s ficam na mesma faixa de 5 min
                .andExpect(jsonPath("$.maquinas[0].pontos", hasSize(3)));
    }

    @Test
    void vinteEQuatroHorasUsaFaixasDeQuinzeMinutosEIncluiTudo() throws Exception {
        mockMvc.perform(get("/api/sensores/serie?periodo=24h&maquina=MAQ-A").header("Authorization", como(Perfil.LEITURA)))
                // -10 s, -20 s e -600 s caem na mesma faixa de 15 min; -2 h e -10 h têm uma cada
                .andExpect(jsonPath("$.faixaSegundos", is(900)))
                .andExpect(jsonPath("$.maquinas[0].pontos", hasSize(3)));
    }

    @Test
    void semPeriodoValeUmaHora() throws Exception {
        mockMvc.perform(get("/api/sensores/serie").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(jsonPath("$.periodo", is("1h")));
    }

    @Test
    void periodoInvalidoDa400() throws Exception {
        mockMvc.perform(get("/api/sensores/serie?periodo=7d").header("Authorization", como(Perfil.LEITURA))).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/sensores/resumo?periodo=abc").header("Authorization", como(Perfil.LEITURA))).andExpect(status().isBadRequest());
    }

    @Test
    void semLeiturasNoPeriodoDevolveListaVazia() throws Exception {
        leituras.deleteAll();

        mockMvc.perform(get("/api/sensores/serie?periodo=1h").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.maquinas", hasSize(0)));
        mockMvc.perform(get("/api/sensores/resumo?periodo=1h").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.maquinas", hasSize(0)));
    }

    @Test
    void exigeToken() throws Exception {
        mockMvc.perform(get("/api/sensores/serie")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/sensores/resumo")).andExpect(status().isUnauthorized());
    }

    // ---- resumo ----

    @Test
    void resumoTrazContagemMediaMaximoMinimoEAlertasDeCadaMaquina() throws Exception {
        alertas.save(new Alerta("MAQ-A", AGORA - 15, Alerta.Tipo.TEMPERATURA, 99.0, 95.0));
        alertas.save(new Alerta("MAQ-A", AGORA - 500, Alerta.Tipo.VIBRACAO, 5.5, 5.0));
        alertas.save(new Alerta("MAQ-A", AGORA - 400, Alerta.Tipo.VIBRACAO, 5.6, 5.0));
        alertas.save(new Alerta("MAQ-A", AGORA - 5 * 3600, Alerta.Tipo.TEMPERATURA, 99.0, 95.0)); // fora de 1 h

        mockMvc.perform(get("/api/sensores/resumo?periodo=1h").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.periodo", is("1h")))
                .andExpect(jsonPath("$.maquinas", hasSize(2)))
                .andExpect(jsonPath("$.maquinas[0].idMaquina", is("MAQ-A")))
                .andExpect(jsonPath("$.maquinas[0].leituras", is(3)))
                .andExpect(jsonPath("$.maquinas[0].temperaturaMedia", closeTo(80.0, 0.001)))
                .andExpect(jsonPath("$.maquinas[0].temperaturaMax", closeTo(90.0, 0.001)))
                .andExpect(jsonPath("$.maquinas[0].temperaturaMin", closeTo(70.0, 0.001)))
                .andExpect(jsonPath("$.maquinas[0].vibracaoMax", closeTo(4.0, 0.001)))
                .andExpect(jsonPath("$.maquinas[0].rpmMedio", closeTo(1500.0, 0.001)))
                .andExpect(jsonPath("$.maquinas[0].rpmMax", closeTo(2000.0, 0.001)))
                .andExpect(jsonPath("$.maquinas[0].alertasTemperatura", is(1)))
                .andExpect(jsonPath("$.maquinas[0].alertasVibracao", is(2)))
                .andExpect(jsonPath("$.maquinas[1].idMaquina", is("MAQ-B")))
                .andExpect(jsonPath("$.maquinas[1].alertasTemperatura", is(0)))
                .andExpect(jsonPath("$.maquinas[1].alertasVibracao", is(0)));
    }

    @Test
    void resumoDeSeisHorasConsideraMaisLeituras() throws Exception {
        mockMvc.perform(get("/api/sensores/resumo?periodo=6h").header("Authorization", como(Perfil.LEITURA)))
                .andExpect(jsonPath("$.maquinas[0].leituras", is(4)))
                .andExpect(jsonPath("$.maquinas[0].temperaturaMin", closeTo(50.0, 0.001)));
    }

    @Test
    void periodosConhecidos() {
        assertThat(Periodo.deTexto("1h")).contains(Periodo.UMA_HORA);
        assertThat(Periodo.deTexto("6H")).contains(Periodo.SEIS_HORAS);
        assertThat(Periodo.deTexto("24h")).contains(Periodo.VINTE_E_QUATRO_HORAS);
        assertThat(Periodo.deTexto("7d")).isEmpty();
        assertThat(Periodo.deTexto(null)).isEmpty();
    }
}
