package com.industria.iot_core.controller;

import com.industria.iot_core.model.RegistroSensor;
import com.industria.iot_core.repository.RegistroSensorRepository;
import com.industria.iot_core.security.TokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class HistoricoESaudeTest {

    @Autowired MockMvc mockMvc;
    @Autowired RegistroSensorRepository repository;
    @Autowired TokenService tokenService;
    @MockitoBean RabbitTemplate rabbitTemplate;

    @BeforeEach
    void prepararDados() {
        repository.deleteAll();
        for (long t = 1; t <= 10; t++) {
            repository.save(leitura("MAQ-01", t));
            repository.save(leitura("MAQ-02", t));
        }
    }

    private RegistroSensor leitura(String maquina, long timestamp) {
        RegistroSensor r = new RegistroSensor();
        r.setIdMaquina(maquina);
        r.setTimestamp(timestamp);
        r.setTemperaturaMotor(70.0);
        r.setVibracao(1.0);
        r.setRpm(1500);
        return r;
    }

    private ResultActions buscar(String consulta) throws Exception {
        return mockMvc.perform(get("/api/sensores" + consulta)
                .header("Authorization", "Bearer " + tokenService.gerarToken("admin")));
    }

    @Test
    void semParametrosDevolveOsRegistrosDeTodasAsMaquinas() throws Exception {
        buscar("").andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(20)));
    }

    @Test
    void filtraPorMaquina() throws Exception {
        buscar("?maquina=MAQ-02")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(10)))
                .andExpect(jsonPath("$[*].idMaquina", everyItem(is("MAQ-02"))));
    }

    @Test
    void limiteEscolheOTamanhoEOrdenaDoMaisNovoParaOMaisAntigo() throws Exception {
        buscar("?maquina=MAQ-01&limite=3")
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].timestamp", is(10)))
                .andExpect(jsonPath("$[2].timestamp", is(8)));
    }

    @Test
    void limiteInvalidoEhAjustadoEmVezDeDarErro() throws Exception {
        buscar("?limite=0").andExpect(jsonPath("$", hasSize(1)));
        buscar("?limite=-5").andExpect(jsonPath("$", hasSize(1)));
        buscar("?limite=999999").andExpect(jsonPath("$", hasSize(20)));
    }

    @Test
    void maquinaSemRegistrosDevolveListaVazia() throws Exception {
        buscar("?maquina=NAO-EXISTE").andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void historicoContinuaExigindoToken() throws Exception {
        mockMvc.perform(get("/api/sensores?maquina=MAQ-01")).andExpect(status().isForbidden());
    }

    @Test
    void rotaDeSaudeFuncionaSemToken() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("UP")));
    }

    @Test
    void outrasRotasDoActuatorNaoFicamExpostas() throws Exception {
        mockMvc.perform(get("/actuator/env")).andExpect(status().is4xxClientError());
    }
}
