package com.industria.iot_core.security;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Conta as falhas de login por chave (endereço de quem chama + usuário) e bloqueia por um tempo
 * depois de muitas falhas seguidas. Fica só na memória: reiniciar a API zera as contagens.
 */
public class LimiteDeTentativas {

    private record Falhas(int quantidade, Instant inicio) {}

    private final int maximo;
    private final Duration janela;
    private final Supplier<Instant> relogio;
    private final Map<String, Falhas> falhas = new ConcurrentHashMap<>();

    public LimiteDeTentativas(int maximo, Duration janela, Supplier<Instant> relogio) {
        this.maximo = maximo;
        this.janela = janela;
        this.relogio = relogio;
    }

    public boolean bloqueado(String chave) {
        Falhas atual = falhas.get(chave);
        return atual != null && !expirou(atual) && atual.quantidade() >= maximo;
    }

    public void registrarFalha(String chave) {
        Instant agora = relogio.get();
        falhas.merge(chave, new Falhas(1, agora),
                (antiga, nova) -> expirou(antiga) ? nova : new Falhas(antiga.quantidade() + 1, antiga.inicio()));
        removerExpirados();
    }

    public void limpar(String chave) {
        falhas.remove(chave);
    }

    private boolean expirou(Falhas f) {
        return !relogio.get().isBefore(f.inicio().plus(janela));
    }

    // Evita que a memória cresça com chaves antigas que nunca mais voltaram
    private void removerExpirados() {
        if (falhas.size() > 1000) {
            falhas.values().removeIf(this::expirou);
        }
    }
}
