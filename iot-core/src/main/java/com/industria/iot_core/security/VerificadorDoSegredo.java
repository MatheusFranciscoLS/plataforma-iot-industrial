package com.industria.iot_core.security;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Confere a chave que assina os tokens JWT logo na subida da API.
 * - Chave curta demais (menos de 32 bytes) não é aceita pelo algoritmo: a API nem sobe, em vez de falhar no primeiro login.
 * - A chave de desenvolvimento, que está no repositório público, funciona (para rodar local e nos testes),
 *   mas gera um aviso bem visível no log: em produção, defina JWT_SECRET com uma chave sua.
 */
@Component
public class VerificadorDoSegredo {

    /** A chave de desenvolvimento que vem no application.properties. */
    static final String CHAVE_DE_DESENVOLVIMENTO = "MinhaChaveSuperSecretaParaAIndustriaIot2026!";

    private static final Logger log = LoggerFactory.getLogger(VerificadorDoSegredo.class);

    private final String segredo;

    public VerificadorDoSegredo(@Value("${api.security.token.secret}") String segredo) {
        this.segredo = segredo;
    }

    @PostConstruct
    void verificar() {
        if (segredo.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("A chave dos tokens (JWT_SECRET) precisa ter pelo menos 32 caracteres.");
        }
        if (CHAVE_DE_DESENVOLVIMENTO.equals(segredo)) {
            log.warn("ATENÇÃO: a API está usando a chave de DESENVOLVIMENTO dos tokens, que é pública. "
                    + "Em produção, defina a variável JWT_SECRET (a mesma no gateway Node).");
        }
    }
}
