package com.industria.iot_core.security;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class LimiteDeTentativasTest {

    final AtomicReference<Instant> agora = new AtomicReference<>(Instant.parse("2026-01-01T12:00:00Z"));
    final LimiteDeTentativas limite = new LimiteDeTentativas(3, Duration.ofMinutes(5), agora::get);

    @Test
    void naoBloqueiaAntesDoMaximoDeFalhas() {
        limite.registrarFalha("a");
        limite.registrarFalha("a");

        assertThat(limite.bloqueado("a")).isFalse();
    }

    @Test
    void bloqueiaNaTerceiraFalha() {
        for (int i = 0; i < 3; i++) limite.registrarFalha("a");

        assertThat(limite.bloqueado("a")).isTrue();
    }

    @Test
    void cadaChaveTemASuaContagem() {
        for (int i = 0; i < 3; i++) limite.registrarFalha("a");

        assertThat(limite.bloqueado("b")).isFalse();
    }

    @Test
    void desbloqueiaDepoisDaJanela() {
        for (int i = 0; i < 3; i++) limite.registrarFalha("a");

        agora.set(agora.get().plus(Duration.ofMinutes(5)));

        assertThat(limite.bloqueado("a")).isFalse();
    }

    @Test
    void falhaDepoisDaJanelaComecaUmaContagemNova() {
        limite.registrarFalha("a");
        limite.registrarFalha("a");
        agora.set(agora.get().plus(Duration.ofMinutes(6)));

        limite.registrarFalha("a");
        limite.registrarFalha("a");

        assertThat(limite.bloqueado("a")).isFalse();
    }

    @Test
    void loginCertoLimpaAsFalhas() {
        limite.registrarFalha("a");
        limite.registrarFalha("a");
        limite.limpar("a");

        limite.registrarFalha("a");
        limite.registrarFalha("a");

        assertThat(limite.bloqueado("a")).isFalse();
    }
}
