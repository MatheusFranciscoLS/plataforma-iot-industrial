// Regras de alerta do painel. Os valores 95 °C e 5,0 mm/s já existiam no painel anterior.
export const MAQUINAS = ['MAQ-01', 'MAQ-02', 'MAQ-03'];

export const LIMITE_TEMPERATURA = 95; // °C
export const LIMITE_VIBRACAO = 5.0; // mm/s

// Depois deste tempo sem leitura nova, a máquina é mostrada como "sem sinal".
export const SEM_SINAL_APOS_S = 15;

/**
 * Decide em que estado a máquina está.
 * @param dado última leitura recebida pelo painel (com `recebidoEm`, em ms) ou undefined
 * @param agora hora atual em ms
 * @returns {{ estado: 'sem-dados' | 'sem-sinal' | 'critica' | 'normal', motivos: string[] }}
 */
export function avaliarMaquina(dado, agora) {
  if (!dado) return { estado: 'sem-dados', motivos: [] };

  if (agora - dado.recebidoEm > SEM_SINAL_APOS_S * 1000) {
    return { estado: 'sem-sinal', motivos: [] };
  }

  const motivos = motivosDaLeitura(dado);
  return { estado: motivos.length > 0 ? 'critica' : 'normal', motivos };
}

/** Que limites uma leitura ultrapassou (lista vazia se está tudo dentro). */
export function motivosDaLeitura(dado) {
  const motivos = [];
  if (dado.temperaturaMotor > LIMITE_TEMPERATURA) {
    motivos.push(`Temperatura acima de ${LIMITE_TEMPERATURA} °C`);
  }
  if (dado.vibracao > LIMITE_VIBRACAO) {
    motivos.push(`Vibração acima de ${formatarNumero(LIMITE_VIBRACAO, 1, 1)} mm/s`);
  }
  return motivos;
}

/** Texto de um alerta guardado no servidor: o que passou do limite e o valor lido. */
export function descreverAlerta({ tipo, valor, limite }) {
  if (tipo === 'VIBRACAO') {
    return { motivo: `Vibração acima de ${formatarNumero(limite, 1, 1)} mm/s`, valor: `${formatarNumero(valor, 2, 2)} mm/s` };
  }
  return { motivo: `Temperatura acima de ${formatarNumero(limite, 0)} °C`, valor: `${formatarNumero(valor, 1, 1)} °C` };
}

/** Frase única que resume a fábrica inteira. */
export function resumirFabrica(avaliacoes) {
  const criticas = avaliacoes.filter((a) => a.estado === 'critica');
  const aguardando = avaliacoes.filter((a) => a.estado === 'sem-dados');
  // Máquina que nunca mandou leitura, enquanto as outras mandam, também conta como sem sinal.
  const semSinal = avaliacoes.filter((a) => a.estado === 'sem-sinal' || a.estado === 'sem-dados');

  if (criticas.length > 0) {
    return {
      nivel: 'critico',
      texto:
        criticas.length === 1
          ? '1 máquina em estado crítico'
          : `${criticas.length} máquinas em estado crítico`,
    };
  }
  if (aguardando.length === avaliacoes.length) {
    return { nivel: 'aguardando', texto: 'Aguardando as primeiras leituras' };
  }
  if (semSinal.length > 0) {
    return {
      nivel: 'atencao',
      texto:
        semSinal.length === 1
          ? '1 máquina sem sinal'
          : `${semSinal.length} máquinas sem sinal`,
    };
  }
  return { nivel: 'normal', texto: 'Tudo normal' };
}

export function formatarNumero(valor, casasMax = 2, casasMin = 0) {
  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: casasMin,
    maximumFractionDigits: casasMax,
  });
}
