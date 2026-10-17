import { MAQUINAS } from './limites';

// Simulação que roda no próprio navegador. Serve só para a tela de demonstração não ficar vazia enquanto o
// servidor gratuito (que dorme sem visitas) acorda. Não fala com a API e não é guardada em lugar nenhum.

export const INTERVALO_SIMULACAO_S = 2; // uma leitura a cada 2 s por máquina, como o simulador do servidor

// Valores normais de cada máquina: a leitura varia devagar em volta deles.
const NORMAL = {
  'MAQ-01': { temperatura: 68, vibracao: 1.9, rpm: 1850 },
  'MAQ-02': { temperatura: 74, vibracao: 2.4, rpm: 2300 },
  'MAQ-03': { temperatura: 80, vibracao: 3.0, rpm: 2750 },
};

// Num episódio de falha a máquina esquenta e vibra acima dos limites padrão (95 °C e 5,0 mm/s).
const EM_FALHA = { temperatura: 101, vibracao: 5.7 };
const CHANCE_DE_FALHA = 1 / 90; // por leitura: em média uma falha a cada 3 minutos por máquina
const DURACAO_DA_FALHA = [10, 22]; // em leituras

const limitar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

/** Estado inicial de uma máquina: no valor normal, sem falha. */
export function criarMaquina(nome) {
  const normal = NORMAL[nome] ?? NORMAL[MAQUINAS[0]];
  return { ...normal, falhaRestante: 0 };
}

/**
 * Próxima leitura de uma máquina. Devolve o novo estado e a leitura (sem `id`).
 * `sorteio` é um Math.random trocável, para os testes darem o mesmo resultado sempre.
 */
export function proximaLeitura(nome, estado, timestamp, sorteio = Math.random) {
  const normal = NORMAL[nome] ?? NORMAL[MAQUINAS[0]];
  let falhaRestante = estado.falhaRestante;
  if (falhaRestante > 0) {
    falhaRestante -= 1;
  } else if (sorteio() < CHANCE_DE_FALHA) {
    const [min, max] = DURACAO_DA_FALHA;
    falhaRestante = min + Math.floor(sorteio() * (max - min + 1));
  }

  const emFalha = falhaRestante > 0;
  const alvoTemperatura = emFalha ? EM_FALHA.temperatura : normal.temperatura;
  const alvoVibracao = emFalha ? EM_FALHA.vibracao : normal.vibracao;
  const ruido = () => sorteio() - 0.5;

  // Anda 15% do caminho até o alvo, mais um ruído pequeno: sobe e desce devagar, sem serrote.
  const temperatura = limitar(estado.temperatura + (alvoTemperatura - estado.temperatura) * 0.15 + ruido() * 1.6, 40, 118);
  const vibracao = limitar(estado.vibracao + (alvoVibracao - estado.vibracao) * 0.15 + ruido() * 0.25, 0.2, 7.5);
  const rpm = Math.round(limitar(normal.rpm + ruido() * 60, 0, 4000));

  return {
    estado: { temperatura, vibracao, rpm, falhaRestante },
    leitura: {
      idMaquina: nome,
      timestamp,
      temperaturaMotor: Math.round(temperatura * 10) / 10,
      vibracao: Math.round(vibracao * 100) / 100,
      rpm,
    },
  };
}

/**
 * Uma rodada: a próxima leitura das três máquinas, no mesmo instante. Atualiza `estados` (um objeto por máquina) no lugar
 * e devolve as leituras, já com `id` local.
 */
export function proximaRodada(estados, timestamp, sorteio = Math.random) {
  return MAQUINAS.map((nome) => {
    const { estado, leitura } = proximaLeitura(nome, estados[nome], timestamp, sorteio);
    estados[nome] = estado;
    return { ...leitura, id: `local-${nome}-${timestamp}` };
  });
}

/**
 * Gera `quantas` rodadas de leituras terminando em `agoraS` (segundos), para o gráfico já nascer com histórico.
 * Devolve as leituras e o estado final de cada máquina.
 */
export function gerarHistorico(agoraS, quantas, sorteio = Math.random) {
  const estados = Object.fromEntries(MAQUINAS.map((nome) => [nome, criarMaquina(nome)]));
  const leituras = [];
  for (let i = quantas - 1; i >= 0; i -= 1) {
    leituras.push(...proximaRodada(estados, agoraS - i * INTERVALO_SIMULACAO_S, sorteio));
  }
  return { leituras, estados };
}
