package com.industria.iot_core.controller;

import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Com SENSOR_API_KEY definida, só quem manda a chave certa consegue enviar leituras. */
@SpringBootTest(properties = "api.sensor.key=chave-de-teste-dos-sensores")
@AutoConfigureMockMvc
class ChaveDosSensoresTest {

    @Autowired MockMvc mockMvc;
    @MockitoBean RabbitTemplate rabbitTemplate;

    static final String LEITURA =
            "{\"idMaquina\":\"MAQ-01\",\"timestamp\":1700000000,\"temperaturaMotor\":80,\"vibracao\":2,\"rpm\":1500}";

    @Test
    void semAChaveALeituraEhRecusada() throws Exception {
        mockMvc.perform(post("/api/sensores").contentType(MediaType.APPLICATION_JSON).content(LEITURA))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(rabbitTemplate);
    }

    @Test
    void comAChaveErradaALeituraEhRecusada() throws Exception {
        mockMvc.perform(post("/api/sensores")
                        .header("X-API-Key", "outra-chave")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LEITURA))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void comAChaveCertaALeituraEhAceita() throws Exception {
        mockMvc.perform(post("/api/sensores")
                        .header("X-API-Key", "chave-de-teste-dos-sensores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LEITURA))
                .andExpect(status().isOk());
    }
}
