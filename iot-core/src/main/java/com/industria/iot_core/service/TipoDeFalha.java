package com.industria.iot_core.service;

/** O que o botão "Simular falha" do painel provoca numa máquina do modo demonstração. */
public enum TipoDeFalha {
    /** O motor esquenta acima do limite de temperatura. */
    TEMPERATURA(true, false),
    /** A máquina vibra acima do limite de vibração. */
    VIBRACAO(false, true),
    /** As duas coisas juntas, como um rolamento falhando. */
    AMBAS(true, true);

    private final boolean esquenta;
    private final boolean vibra;

    TipoDeFalha(boolean esquenta, boolean vibra) {
        this.esquenta = esquenta;
        this.vibra = vibra;
    }

    boolean esquenta() { return esquenta; }
    boolean vibra() { return vibra; }
}
