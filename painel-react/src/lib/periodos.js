// Períodos que a API sabe agrupar no servidor (GET /api/sensores/serie e /resumo).
export const PERIODOS = ['1h', '6h', '24h'];

// De que campo da série (resposta da API) sai cada grandeza do gráfico (as mesmas de lib/metricas.js).
export const CAMPO_DA_SERIE = {
  temperaturaMotor: { media: 'temperatura', maximo: 'temperaturaMax' },
  vibracao: { media: 'vibracao', maximo: 'vibracaoMax' },
  rpm: { media: 'rpm', maximo: null },
};

/**
 * Transforma a série da API ({ maquinas: [{ idMaquina, pontos: [{ t, temperatura, ... }] }] }) nas linhas do
 * gráfico ({ timestamp, 'MAQ-01': média, 'MAQ-02': média, ... }), em ordem de tempo.
 * `grandeza` é o id da métrica do gráfico (temperaturaMotor, vibracao ou rpm).
 */
export function serieParaLinhas(serie, grandeza) {
  if (!serie || !Array.isArray(serie.maquinas)) return [];
  const campo = CAMPO_DA_SERIE[grandeza]?.media;
  if (!campo) return [];

  const porTempo = new Map();
  for (const { idMaquina, pontos } of serie.maquinas) {
    for (const ponto of pontos) {
      const linha = porTempo.get(ponto.t) ?? { timestamp: ponto.t };
      linha[idMaquina] = ponto[campo];
      porTempo.set(ponto.t, linha);
    }
  }
  return [...porTempo.values()].sort((a, b) => a.timestamp - b.timestamp);
}

/** Linhas de UMA máquina com média e máximo da grandeza, para o gráfico da janela de detalhes. */
export function serieDaMaquinaParaLinhas(serie, idMaquina, grandeza) {
  const campos = CAMPO_DA_SERIE[grandeza];
  const pontos = serie?.maquinas?.find((m) => m.idMaquina === idMaquina)?.pontos ?? [];
  return pontos.map((p) => ({
    timestamp: p.t,
    media: p[campos.media],
    maximo: campos.maximo ? p[campos.maximo] : null,
  }));
}

/** Minutos de cada faixa da série (1, 5 ou 15), ou null se a série não veio. */
export function faixaEmMinutos(serie) {
  return typeof serie?.faixaSegundos === 'number' ? serie.faixaSegundos / 60 : null;
}
