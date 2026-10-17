package com.industria.iot_core.controller;

import com.industria.iot_core.model.Usuario;
import com.industria.iot_core.model.RegistroSensor;
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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
                .andExpect(status().isUnauthorized());
    }

    @Test
    void historicoComTokenInvalidoEhBloqueado() throws Exception {
        mockMvc.perform(get("/api/sensores").header("Authorization", "Bearer lixo"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void historicoComTokenValidoFunciona() throws Exception {
        String token = tokenService.gerarToken("admin", Usuario.Perfil.ADMIN);

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

    // ---------- Validação e proteção dos dados ----------

    @Test
    void sensorNaoConsegueSobrescreverUmRegistroExistenteMandandoOId() throws Exception {
        RegistroSensor original = new RegistroSensor();
        original.setIdMaquina("MAQ-01");
        original.setTimestamp(1L);
        original.setTemperaturaMotor(50.0);
        original.setVibracao(1.0);
        original.setRpm(1000);
        Long idOriginal = repository.save(original).getId();

        mockMvc.perform(post("/api/sensores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":" + idOriginal + ",\"idMaquina\":\"MAQ-99\",\"timestamp\":2,"
                                + "\"temperaturaMotor\":99.0,\"vibracao\":1.0,\"rpm\":1}"))
                .andExpect(status().isOk());

        assertThat(repository.count()).isEqualTo(2);
        assertThat(repository.findById(idOriginal).orElseThrow().getIdMaquina()).isEqualTo("MAQ-01");
    }

    @Test
    void leituraSemCamposObrigatoriosEhRecusadaComErro400() throws Exception {
        mockMvc.perform(post("/api/sensores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idMaquina\":\"MAQ-01\"}"))
                .andExpect(status().isBadRequest());

        assertThat(repository.count()).isZero();
    }

    @Test
    void leituraComVibracaoOuRpmNegativosEhRecusada() throws Exception {
        mockMvc.perform(post("/api/sensores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idMaquina\":\"MAQ-01\",\"timestamp\":1,\"temperaturaMotor\":70,\"vibracao\":-1,\"rpm\":-5}"))
                .andExpect(status().isBadRequest());

        assertThat(repository.count()).isZero();
        verifyNoInteractions(rabbitTemplate);
    }

    @Test
    void leituraComNomeDeMaquinaEmBrancoEhRecusada() throws Exception {
        mockMvc.perform(post("/api/sensores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idMaquina\":\"  \",\"timestamp\":1,\"temperaturaMotor\":70,\"vibracao\":1,\"rpm\":1000}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void loginComCamposNulosDevolve401SemQuebrar() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void preflightDoCorsLiberaOPainel() throws Exception {
        mockMvc.perform(options("/api/sensores")
                        .header("Origin", "https://painel.exemplo.com")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "*"));
    }
}
