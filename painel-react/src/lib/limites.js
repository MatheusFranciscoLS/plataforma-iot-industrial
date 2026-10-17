import { I18N_PT } from '../i18n/textos';

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
 * @param i18n { t, locale } do idioma da tela (padrão: português)
 * @returns {{ estado: 'sem-dados' | 'sem-sinal' | 'critica' | 'normal', motivos: string[] }}
 */
export function avaliarMaquina(dado, agora, i18n = I18N_PT) {
  if (!dado) return { estado: 'sem-dados', motivos: [] };

  if (agora - dado.recebidoEm > SEM_SINAL_APOS_S * 1000) {
    return { estado: 'sem-sinal', motivos: [] };
  }

  const motivos = motivosDaLeitura(dado, i18n);
  return { estado: motivos.length > 0 ? 'critica' : 'normal', motivos };
}

/** Que limites uma leitura ultrapassou (lista vazia se está tudo dentro), já no idioma da tela. */
export function motivosDaLeitura(dado, { t, locale } = I18N_PT) {
  const motivos = [];
  if (dado.temperaturaMotor > LIMITE_TEMPERATURA) {
    motivos.push(t('motivo.temperatura', { limite: LIMITE_TEMPERATURA }));
  }
  if (dado.vibracao > LIMITE_VIBRACAO) {
    motivos.push(t('motivo.vibracao', { limite: formatarNumero(LIMITE_VIBRACAO, 1, 1, locale) }));
  }
  return motivos;
}

/** Texto de um alerta guardado no servidor: o que passou do limite e o valor lido. */
export function descreverAlerta({ tipo, valor, limite }, { t, locale } = I18N_PT) {
  if (tipo === 'VIBRACAO') {
    return {
      motivo: t('motivo.vibracao', { limite: formatarNumero(limite, 1, 1, locale) }),
      valor: `${formatarNumero(valor, 2, 2, locale)} mm/s`,
    };
  }
  return {
    motivo: t('motivo.temperatura', { limite: formatarNumero(limite, 0, 0, locale) }),
    valor: `${formatarNumero(valor, 1, 1, locale)} °C`,
  };
}

/** Frase única que resume a fábrica inteira. */
export function resumirFabrica(avaliacoes, { t } = I18N_PT) {
  const criticas = avaliacoes.filter((a) => a.estado === 'critica');
  const aguardando = avaliacoes.filter((a) => a.estado === 'sem-dados');
  // Máquina que nunca mandou leitura, enquanto as outras mandam, também conta como sem sinal.
  const semSinal = avaliacoes.filter((a) => a.estado === 'sem-sinal' || a.estado === 'sem-dados');

  if (criticas.length > 0) {
    return {
      nivel: 'critico',
      texto: criticas.length === 1 ? t('resumo.critica.um') : t('resumo.critica.varios', { n: criticas.length }),
    };
  }
  if (aguardando.length === avaliacoes.length) {
    return { nivel: 'aguardando', texto: t('resumo.aguardando') };
  }
  if (semSinal.length > 0) {
    return {
      nivel: 'atencao',
      texto: semSinal.length === 1 ? t('resumo.semSinal.um') : t('resumo.semSinal.varios', { n: semSinal.length }),
    };
  }
  return { nivel: 'normal', texto: t('resumo.normal') };
}

export function formatarNumero(valor, casasMax = 2, casasMin = 0, locale = 'pt-BR') {
  return Number(valor).toLocaleString(locale, {
    minimumFractionDigits: casasMin,
    maximumFractionDigits: casasMax,
  });
}
