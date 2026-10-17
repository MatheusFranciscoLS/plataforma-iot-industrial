// Quantos pontos o gráfico mostra: 20 por padrão (as linhas não ficam esmagadas); a pessoa pode pedir mais.
export const MAX_PONTOS = 20;
export const OPCOES_PONTOS = [20, 60, 160];

// Leituras de máquinas diferentes feitas com menos de 2 s de diferença
// (timestamp em segundos) ficam no mesmo ponto do gráfico.
export const JANELA_AGRUPAMENTO_S = 2;

// Quantas leituras individuais o painel guarda na memória (cabe a maior opção de pontos, 160, com 3 máquinas).
export const MAX_LEITURAS = 700;

/**
 * Acrescenta uma leitura ao fim da lista de pontos { timestamp, 'MAQ-01': valor, ... } sem alterar o array recebido.
 * `campo` é o que se desenha: temperaturaMotor (padrão), vibracao ou rpm.
 */
export function adicionarLeitura(pontos, dado, maxPontos = MAX_PONTOS, campo = 'temperaturaMotor') {
  const ultimo = pontos[pontos.length - 1];

  let novo;
  if (ultimo && Math.abs(ultimo.timestamp - dado.timestamp) < JANELA_AGRUPAMENTO_S) {
    novo = [...pontos.slice(0, -1), { ...ultimo, [dado.idMaquina]: dado[campo] }];
  } else {
    novo = [...pontos, { timestamp: dado.timestamp, [dado.idMaquina]: dado[campo] }];
  }

  return novo.length > maxPontos ? novo.slice(-maxPontos) : novo;
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
export function agruparHistorico(leituras, maxPontos = MAX_PONTOS, campo = 'temperaturaMotor') {
  return [...leituras]
    .sort((a, b) => a.timestamp - b.timestamp)
    .reduce((pontos, leitura) => adicionarLeitura(pontos, leitura, maxPontos, campo), []);
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
