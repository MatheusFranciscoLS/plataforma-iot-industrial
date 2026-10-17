import { I18N_PT } from '../i18n/textos';

// Regras de alerta do painel. Os valores 95 °C e 5,0 mm/s já existiam no painel anterior.
export const MAQUINAS = ['MAQ-01', 'MAQ-02', 'MAQ-03'];

export const LIMITE_TEMPERATURA = 95; // °C
export const LIMITE_VIBRACAO = 5.0; // mm/s

// Limites padrão (os da API, que cada máquina pode trocar pelos seus).
export const LIMITES_PADRAO = { temperatura: LIMITE_TEMPERATURA, vibracao: LIMITE_VIBRACAO };

// Depois deste tempo sem leitura nova, a máquina é mostrada como "sem sinal".
export const SEM_SINAL_APOS_S = 15;

/**
 * Os limites que valem para uma máquina, a partir do que a API devolve em GET /api/limites
 * ({ padrao: { TEMPERATURA, VIBRACAO }, maquinas: [{ idMaquina, tipo, limite }] }).
 * Resposta ausente ou fora do formato esperado volta aos limites padrão do painel.
 */
export function limitesDaMaquina(tabela, maquina) {
  const padrao = {
    temperatura: tabela?.padrao?.TEMPERATURA ?? LIMITES_PADRAO.temperatura,
    vibracao: tabela?.padrao?.VIBRACAO ?? LIMITES_PADRAO.vibracao,
  };
  const proprios = Array.isArray(tabela?.maquinas) ? tabela.maquinas.filter((l) => l.idMaquina === maquina) : [];
  const de = (tipo, chave) => proprios.find((l) => l.tipo === tipo)?.limite ?? padrao[chave];
  return { temperatura: de('TEMPERATURA', 'temperatura'), vibracao: de('VIBRACAO', 'vibracao') };
}

/** Os limites padrão como a API informa (ou os do painel, se ainda não chegou). */
export function limitesPadrao(tabela) {
  return limitesDaMaquina(tabela, null);
}

/**
 * Decide em que estado a máquina está.
 * @param dado última leitura recebida pelo painel (com `recebidoEm`, em ms) ou undefined
 * @param agora hora atual em ms
 * @param i18n { t, locale } do idioma da tela (padrão: português)
 * @param limites limites da máquina ({ temperatura, vibracao }; padrão: os do painel)
 * @returns {{ estado: 'sem-dados' | 'sem-sinal' | 'critica' | 'normal', motivos: string[] }}
 */
export function avaliarMaquina(dado, agora, i18n = I18N_PT, limites = LIMITES_PADRAO) {
  if (!dado) return { estado: 'sem-dados', motivos: [] };

  if (agora - dado.recebidoEm > SEM_SINAL_APOS_S * 1000) {
    return { estado: 'sem-sinal', motivos: [] };
  }

  const motivos = motivosDaLeitura(dado, i18n, limites);
  return { estado: motivos.length > 0 ? 'critica' : 'normal', motivos };
}

/** Que limites uma leitura ultrapassou (lista vazia se está tudo dentro), já no idioma da tela. */
export function motivosDaLeitura(dado, { t, locale } = I18N_PT, limites = LIMITES_PADRAO) {
  const motivos = [];
  if (dado.temperaturaMotor > limites.temperatura) {
    motivos.push(t('motivo.temperatura', { limite: formatarNumero(limites.temperatura, 1, 0, locale) }));
  }
  if (dado.vibracao > limites.vibracao) {
    motivos.push(t('motivo.vibracao', { limite: formatarNumero(limites.vibracao, 1, 1, locale) }));
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
