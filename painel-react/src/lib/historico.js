// O gráfico mostra no máximo os últimos 20 pontos, para as linhas não ficarem esmagadas.
export const MAX_PONTOS = 20;

// Leituras de máquinas diferentes feitas com menos de 2 s de diferença
// (timestamp em segundos) ficam no mesmo ponto do gráfico.
export const JANELA_AGRUPAMENTO_S = 2;

/** Transforma a lista da API (uma linha por leitura) em pontos { timestamp, 'MAQ-01': temp, ... }. */
export function agruparHistorico(registros) {
  const porTimestamp = new Map();

  for (const r of registros) {
    const ponto = porTimestamp.get(r.timestamp) ?? { timestamp: r.timestamp };
    ponto[r.idMaquina] = r.temperaturaMotor;
    porTimestamp.set(r.timestamp, ponto);
  }

  return [...porTimestamp.values()]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_PONTOS);
}

/** Acrescenta uma leitura nova ao histórico sem alterar o array recebido. */
export function adicionarLeitura(historico, dado) {
  const ultimo = historico[historico.length - 1];

  let novo;
  if (ultimo && Math.abs(ultimo.timestamp - dado.timestamp) < JANELA_AGRUPAMENTO_S) {
    novo = [
      ...historico.slice(0, -1),
      { ...ultimo, [dado.idMaquina]: dado.temperaturaMotor },
    ];
  } else {
    novo = [...historico, { timestamp: dado.timestamp, [dado.idMaquina]: dado.temperaturaMotor }];
  }

  return novo.length > MAX_PONTOS ? novo.slice(-MAX_PONTOS) : novo;
}

/** Temperaturas de uma máquina, na ordem do tempo, sem os pontos em que ela não apareceu. */
export function serieDaMaquina(historico, maquina) {
  return historico.map((p) => p[maquina]).filter((v) => typeof v === 'number');
}
