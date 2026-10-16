// O gráfico mostra no máximo os últimos 20 pontos, para as linhas não ficarem esmagadas.
export const MAX_PONTOS = 20;

// Leituras de máquinas diferentes feitas com menos de 2 s de diferença
// (timestamp em segundos) ficam no mesmo ponto do gráfico.
export const JANELA_AGRUPAMENTO_S = 2;

// Quantas leituras individuais o painel guarda na memória (mais que o suficiente para 20 pontos de 3 máquinas).
export const MAX_LEITURAS = 120;

/** Acrescenta uma leitura ao fim da lista de pontos { timestamp, 'MAQ-01': temp, ... } sem alterar o array recebido. */
export function adicionarLeitura(pontos, dado) {
  const ultimo = pontos[pontos.length - 1];

  let novo;
  if (ultimo && Math.abs(ultimo.timestamp - dado.timestamp) < JANELA_AGRUPAMENTO_S) {
    novo = [...pontos.slice(0, -1), { ...ultimo, [dado.idMaquina]: dado.temperaturaMotor }];
  } else {
    novo = [...pontos, { timestamp: dado.timestamp, [dado.idMaquina]: dado.temperaturaMotor }];
  }

  return novo.length > MAX_PONTOS ? novo.slice(-MAX_PONTOS) : novo;
}

/**
 * Junta duas listas de leituras (histórico da API + leituras ao vivo), tira as repetidas
 * (mesmo `id`), ordena pelo tempo e guarda só as mais recentes.
 */
export function mesclarLeituras(...listas) {
  const porId = new Map();
  const semId = [];

  for (const lista of listas) {
    for (const leitura of lista) {
      if (leitura.id === undefined || leitura.id === null) semId.push(leitura);
      else porId.set(leitura.id, leitura);
    }
  }

  return [...porId.values(), ...semId]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_LEITURAS);
}

/** Transforma as leituras (em qualquer ordem) nos pontos do gráfico, com as mesmas regras do ao vivo. */
export function agruparHistorico(leituras) {
  return [...leituras]
    .sort((a, b) => a.timestamp - b.timestamp)
    .reduce(adicionarLeitura, []);
}

/** Última leitura de cada máquina, no formato do painel (com `recebidoEm` em ms, vindo do relógio da leitura). */
export function ultimasLeituras(leituras) {
  const porMaquina = {};
  for (const l of [...leituras].sort((a, b) => a.timestamp - b.timestamp)) {
    porMaquina[l.idMaquina] = { ...l, recebidoEm: l.timestamp * 1000 };
  }
  return porMaquina;
}

/** Temperaturas de uma máquina, na ordem do tempo, sem os pontos em que ela não apareceu. */
export function serieDaMaquina(historico, maquina) {
  return historico.map((p) => p[maquina]).filter((v) => typeof v === 'number');
}
