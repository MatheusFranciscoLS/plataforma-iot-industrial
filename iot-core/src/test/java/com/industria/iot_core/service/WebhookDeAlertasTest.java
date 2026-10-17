package com.industria.iot_core.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.industria.iot_core.model.Alerta;
import com.sun.net.httpserver.HttpServer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Aviso de alertas por webhook: chega ao chat, não repete, e o chat fora do ar não atrapalha nada. */
class WebhookDeAlertasTest {

    /** Um "Discord de mentira": guarda o que recebe e responde com o código que o teste mandar. */
    static final class ChatDeMentira {
        final HttpServer servidor;
        final List<String> corpos = new CopyOnWriteArrayList<>();
        final AtomicInteger codigoDeResposta = new AtomicInteger(204);

        ChatDeMentira() {
            try {
                servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            } catch (IOException e) {
                throw new IllegalStateException(e);
            }
            servidor.createContext("/webhook", troca -> {
                corpos.add(new String(troca.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                troca.sendResponseHeaders(codigoDeResposta.get(), -1);
                troca.close();
            });
            servidor.start();
        }

        String endereco() {
            return "http://127.0.0.1:" + servidor.getAddress().getPort() + "/webhook";
        }
    }

    // ---- o texto e o corpo da mensagem (sem Spring) ----

    private static NotificadorDeAlertas notificador(String url, String painel) {
        return new NotificadorDeAlertas(url, painel, "UTC", new ObjectMapper(), new SimpleMeterRegistry());
    }

    private static Alerta alerta(Alerta.Tipo tipo, double valor, double limite) {
        // 1_700_000_000 s = 2023-11-14 22:13:20 UTC
        return new Alerta("MAQ-02", 1_700_000_000L, tipo, valor, limite);
    }

    @Test
    void mensagemDeTemperaturaDizMaquinaValorLimiteEHora() {
        String texto = notificador("http://localhost/x", "").texto(alerta(Alerta.Tipo.TEMPERATURA, 98.24, 95.0));

        assertThat(texto).isEqualTo("⚠️ MAQ-02: temperatura acima do limite (98.2 °C, limite 95.0 °C) às 22:13:20");
    }

    @Test
    void mensagemDeVibracaoUsaMmPorSegundo() {
        String texto = notificador("http://localhost/x", "").texto(alerta(Alerta.Tipo.VIBRACAO, 5.26, 5.0));

        assertThat(texto).contains("vibração acima do limite").contains("5.3 mm/s").contains("limite 5.0 mm/s");
    }

    @Test
    void enderecoDoPainelVaiNoFimDaMensagem() {
        String texto = notificador("http://localhost/x", "https://painel.exemplo").texto(alerta(Alerta.Tipo.TEMPERATURA, 99, 95));

        assertThat(texto).endsWith("\nhttps://painel.exemplo");
    }

    @Test
    void corpoServeParaDiscordESlackEEJsonValidoMesmoComAspasNoTexto() throws Exception {
        NotificadorDeAlertas n = notificador("http://localhost/x", "https://painel.exemplo/?a=\"b\"");
        JsonNode corpo = new ObjectMapper().readTree(n.corpo(alerta(Alerta.Tipo.TEMPERATURA, 99, 95)));

        assertThat(corpo.get("content").asText()).isEqualTo(corpo.get("text").asText()).contains("MAQ-02").contains("a=\"b\"");
        assertThat(corpo.get("username").asText()).isEqualTo("Plataforma IoT");
    }

    @Test
    void semEnderecoOuComEnderecoInvalidoFicaDesligado() {
        assertThat(notificador("", "").ligado()).isFalse();
        assertThat(notificador("   ", "").ligado()).isFalse();
        assertThat(notificador("ftp://exemplo.com/x", "").ligado()).isFalse();
        assertThat(notificador("isto nao e um endereco", "").ligado()).isFalse();
        assertThat(notificador("https://discord.com/api/webhooks/1/abc", "").ligado()).isTrue();
    }

    @Test
    void desligadoNaoEnviaNemLancaErro() {
        notificador("", "").notificar(alerta(Alerta.Tipo.TEMPERATURA, 99, 95)); // nada a verificar além de não lançar
    }

    // ---- a API inteira com um chat de mentira ----

    @Nested
    @SpringBootTest
    @AutoConfigureMockMvc
    class ComChatLigado {

        static final ChatDeMentira chat = new ChatDeMentira();

        @DynamicPropertySource
        static void enderecoDoChat(DynamicPropertyRegistry registro) {
            registro.add("alerta.webhook-url", chat::endereco);
            registro.add("alerta.webhook-fuso", () -> "UTC");
        }

        @AfterAll
        static void parar() {
            chat.servidor.stop(0);
        }

        @Autowired MockMvc mockMvc;
        @MockitoBean RabbitTemplate rabbitTemplate;

        @BeforeEach
        void limpar() {
            chat.corpos.clear();
            chat.codigoDeResposta.set(204);
        }

        private void enviar(String maquina, long timestamp, double temperatura) throws Exception {
            mockMvc.perform(post("/api/sensores").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"idMaquina\":\"" + maquina + "\",\"timestamp\":" + timestamp
                                    + ",\"temperaturaMotor\":" + temperatura + ",\"vibracao\":1.0,\"rpm\":1500}"))
                    .andExpect(status().isOk());
        }

        @Test
        void alertaNovoChegaNoChatUmaVezSo() throws Exception {
            enviar("WH-UM", 1_700_000_000L, 99.0); // passou: avisa
            enviar("WH-UM", 1_700_000_002L, 98.0); // continua acima: não repete
            enviar("WH-UM", 1_700_000_004L, 97.0);

            await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(chat.corpos).hasSize(1));
            Thread.sleep(300); // dá tempo de um envio indevido aparecer
            assertThat(chat.corpos).hasSize(1);
            assertThat(chat.corpos.get(0)).contains("WH-UM").contains("temperatura acima do limite").contains("\"content\"").contains("\"text\"");
        }

        @Test
        void voltandoAoNormalEPassandoDeNovoAvisaDeNovo() throws Exception {
            enviar("WH-DOIS", 1_700_000_000L, 99.0);
            enviar("WH-DOIS", 1_700_000_002L, 80.0);
            enviar("WH-DOIS", 1_700_000_004L, 99.0);

            await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(chat.corpos).hasSize(2));
        }

        @Test
        void leituraDentroDoLimiteNaoAvisaNinguem() throws Exception {
            enviar("WH-NORMAL", 1_700_000_000L, 80.0);

            Thread.sleep(300);
            assertThat(chat.corpos).isEmpty();
        }

        @Test
        void chatQueRespondeErroNaoDerrubaALeituraNemOAlerta() throws Exception {
            chat.codigoDeResposta.set(500);

            enviar("WH-ERRO", 1_700_000_000L, 99.0); // a leitura é salva (200) mesmo com o chat falhando

            await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(chat.corpos).hasSize(1));
        }
    }

    @Nested
    @SpringBootTest
    @AutoConfigureMockMvc
    class ComChatForaDoAr {

        @DynamicPropertySource
        static void enderecoSemNinguem(DynamicPropertyRegistry registro) {
            registro.add("alerta.webhook-url", () -> "http://127.0.0.1:1/webhook"); // porta 1: ninguém escutando
        }

        @Autowired MockMvc mockMvc;
        @MockitoBean RabbitTemplate rabbitTemplate;

        @Test
        void leituraEAlertaSeguemNormalmenteQuandoOChatNaoResponde() throws Exception {
            mockMvc.perform(post("/api/sensores").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"idMaquina\":\"WH-FORA\",\"timestamp\":1700000000,\"temperaturaMotor\":99.0,\"vibracao\":1.0,\"rpm\":1500}"))
                    .andExpect(status().isOk());
        }
    }
}
