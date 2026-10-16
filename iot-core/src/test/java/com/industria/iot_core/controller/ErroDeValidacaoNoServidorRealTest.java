package com.industria.iot_core.controller;

import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Sobe o servidor de verdade (porta aleatória). O MockMvc não repassa os erros para a rota interna /error,
 * então só um servidor real prova que um erro de validação chega ao sensor como 400 (e não como 403).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ErroDeValidacaoNoServidorRealTest {

    @LocalServerPort int porta;
    @MockitoBean RabbitTemplate rabbitTemplate;

    private int enviar(String json) throws Exception {
        HttpRequest requisicao = HttpRequest.newBuilder(URI.create("http://localhost:" + porta + "/api/sensores"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
        return HttpClient.newHttpClient().send(requisicao, HttpResponse.BodyHandlers.ofString()).statusCode();
    }

    @Test
    void leituraInvalidaRecebe400() throws Exception {
        assertThat(enviar("{\"idMaquina\":\"MAQ-01\"}")).isEqualTo(400);
    }

    @Test
    void jsonMalFormadoRecebe400() throws Exception {
        assertThat(enviar("isto nao e json")).isEqualTo(400);
    }

    @Test
    void leituraValidaRecebe200() throws Exception {
        assertThat(enviar("{\"idMaquina\":\"MAQ-01\",\"timestamp\":1700000000,\"temperaturaMotor\":80,\"vibracao\":2,\"rpm\":1500}"))
                .isEqualTo(200);
    }
}
