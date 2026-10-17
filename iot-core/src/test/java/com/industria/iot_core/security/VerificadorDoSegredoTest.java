package com.industria.iot_core.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VerificadorDoSegredoTest {

    @Test
    void chaveCurtaDemaisImpedeASubida() {
        assertThatThrownBy(() -> new VerificadorDoSegredo("curta").verificar())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("pelo menos 32");
    }

    @Test
    void chaveDeTrintaEDoisBytesOuMaisPassa() {
        assertThatCode(() -> new VerificadorDoSegredo("x".repeat(32)).verificar()).doesNotThrowAnyException();
    }

    @Test
    void aChaveDeDesenvolvimentoAindaFuncionaParaRodarLocal() {
        assertThatCode(() -> new VerificadorDoSegredo(VerificadorDoSegredo.CHAVE_DE_DESENVOLVIMENTO).verificar())
                .doesNotThrowAnyException();
    }
}
