package com.industria.iot_core.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.industria.iot_core.model.Alerta;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;

/**
 * Avisa um canal de chat (Discord, Slack ou qualquer webhook que aceite JSON) quando um alerta nasce.
 * Fica desligado até ALERTA_WEBHOOK_URL ser definida. O envio é assíncrono e com tempo limite: se o chat estiver
 * fora do ar ou lento, o alerta continua salvo e a leitura continua sendo processada normalmente.
 *
 * O corpo tem `content` (Discord) e `text` (Slack) com a mesma frase, então o mesmo endereço serve para os dois.
 */
@Component
public class NotificadorDeAlertas {

    private static final Logger log = LoggerFactory.getLogger(NotificadorDeAlertas.class);
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm:ss");

    private final URI destino;
    private final String enderecoDoPainel;
    private final ZoneId fuso;
    private final ObjectMapper json;
    private final MeterRegistry metricas;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

    public NotificadorDeAlertas(@Value("${alerta.webhook-url:}") String url,
                                @Value("${alerta.webhook-painel-url:}") String enderecoDoPainel,
                                @Value("${alerta.webhook-fuso:America/Sao_Paulo}") String fuso,
                                ObjectMapper json, MeterRegistry metricas) {
        this.destino = enderecoValido(url);
        this.enderecoDoPainel = enderecoDoPainel == null ? "" : enderecoDoPainel.trim();
        this.fuso = ZoneId.of(fuso);
        this.json = json;
        this.metricas = metricas;
        if (destino != null) {
            log.info("Aviso de alertas por webhook ligado.");
        }
    }

    /** Só aceita http ou https; qualquer outra coisa (ou vazio) deixa o aviso desligado, sem derrubar a API. */
    private static URI enderecoValido(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            URI uri = URI.create(url.trim());
            if (uri.getHost() != null && ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))) {
                return uri;
            }
        } catch (IllegalArgumentException e) {
            // cai no aviso abaixo
        }
        log.warn("ALERTA_WEBHOOK_URL não é um endereço http(s) válido: o aviso por webhook ficou desligado.");
        return null;
    }

    public boolean ligado() {
        return destino != null;
    }

    /** Manda o aviso sem esperar a resposta. Nunca lança exceção. */
    public void notificar(Alerta alerta) {
        if (destino == null) return;
        try {
            HttpRequest pedido = HttpRequest.newBuilder(destino)
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(corpo(alerta)))
                    .build();
            http.sendAsync(pedido, HttpResponse.BodyHandlers.discarding()).whenComplete((resposta, falha) -> {
                if (falha != null) {
                    registrarFalha("sem resposta: " + falha.getClass().getSimpleName());
                } else if (resposta.statusCode() / 100 != 2) {
                    registrarFalha("resposta " + resposta.statusCode());
                } else {
                    metricas.counter("iot.webhook.enviados").increment();
                }
            });
        } catch (Exception e) {
            registrarFalha(e.getClass().getSimpleName());
        }
    }

    String corpo(Alerta alerta) throws JsonProcessingException {
        String texto = texto(alerta);
        return json.writeValueAsString(Map.of("username", "Plataforma IoT", "content", texto, "text", texto));
    }

    String texto(Alerta alerta) {
        boolean temperatura = alerta.getTipo() == Alerta.Tipo.TEMPERATURA;
        String grandeza = temperatura ? "temperatura" : "vibração";
        String unidade = temperatura ? "°C" : "mm/s";
        String quando = HORA.format(Instant.ofEpochSecond(alerta.getTimestamp()).atZone(fuso));
        String frase = String.format(Locale.ROOT, "⚠️ %s: %s acima do limite (%.1f %s, limite %.1f %s) às %s",
                alerta.getIdMaquina(), grandeza, alerta.getValor(), unidade, alerta.getLimite(), unidade, quando);
        return enderecoDoPainel.isEmpty() ? frase : frase + "\n" + enderecoDoPainel;
    }

    private void registrarFalha(String motivo) {
        metricas.counter("iot.webhook.falhas").increment();
        log.warn("Não foi possível enviar o aviso do alerta por webhook ({}).", motivo);
    }
}
