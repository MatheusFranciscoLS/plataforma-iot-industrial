package com.industria.iot_core.controller;

import com.industria.iot_core.repository.RegistroSensorRepository;
import com.industria.iot_core.security.TokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sobe a aplicação inteira (com banco H2 em memória) e chama a API de verdade,
 * passando pela cadeia de segurança. Só o RabbitMQ é trocado por um falso.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ApiSegurancaTest {

    @Autowired MockMvc mockMvc;
    @Autowired TokenService tokenService;
    @Autowired RegistroSensorRepository repository;

    @MockitoBean RabbitTemplate rabbitTemplate;

    static final String LEITURA = """
            {"idMaquina":"MAQ-01","timestamp":1700000000000,"temperaturaMotor":97.5,"vibracao":5.2,"rpm":1800}
            """;

    @BeforeEach
    void limparBanco() {
        repository.deleteAll();
    }

    // ---------- Login ----------

    @Test
    void loginComCredenciaisCorretasDevolveToken() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"usuario\":\"admin\",\"senha\":\"senha123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void loginComSenhaErradaDevolve401() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"usuario\":\"admin\",\"senha\":\"errada\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginComUsuarioDesconhecidoDevolve401() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"usuario\":\"fulano\",\"senha\":\"senha123\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ---------- Histórico protegido por JWT ----------

    @Test
    void historicoSemTokenEhBloqueado() throws Exception {
        mockMvc.perform(get("/api/sensores"))
                .andExpect(status().isForbidden());
    }

    @Test
    void historicoComTokenInvalidoEhBloqueado() throws Exception {
        mockMvc.perform(get("/api/sensores").header("Authorization", "Bearer lixo"))
                .andExpect(status().isForbidden());
    }

    @Test
    void historicoComTokenValidoFunciona() throws Exception {
        String token = tokenService.gerarToken("admin");

        mockMvc.perform(get("/api/sensores").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    // ---------- Entrada de dados dos sensores ----------

    @Test
    void sensorPodeEnviarLeituraSemTokenEElaFicaSalvaEVaiParaAFila() throws Exception {
        mockMvc.perform(post("/api/sensores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LEITURA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.idMaquina").value("MAQ-01"))
                .andExpect(jsonPath("$.dataRecebimento").isNotEmpty());

        assertThat(repository.count()).isEqualTo(1);
        verify(rabbitTemplate).convertAndSend(eq("sensores.fila"), anyString());
    }

    @Test
    void seOBrokerFalharALeituraContinuaSalvaEARespostaEhOk() throws Exception {
        doThrow(new RuntimeException("broker fora do ar"))
                .when(rabbitTemplate).convertAndSend(eq("sensores.fila"), anyString());

        mockMvc.perform(post("/api/sensores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LEITURA))
                .andExpect(status().isOk());

        assertThat(repository.count()).isEqualTo(1);
        verify(rabbitTemplate).convertAndSend(eq("sensores.fila"), anyString());
    }
}
