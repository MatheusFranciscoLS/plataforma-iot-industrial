// Teste de carga da API com o k6 (https://k6.io).
//
// Dois cenários rodam ao mesmo tempo, como no uso real:
//   - escrita: sensores mandando leituras (POST /api/sensores), sem login, como o simulador faz;
//   - leitura: painéis abertos consultando histórico, séries por período e alertas (com token).
//
// Os limites em "thresholds" são o contrato: se a API ficar mais lenta ou começar a errar, o teste falha.
// Como rodar: veja testes-de-carga/README.md.
import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API_URL || 'http://localhost:8080';
const USUARIO = __ENV.USUARIO || 'admin';
const SENHA = __ENV.SENHA || 'senha123';

const MAQUINAS = ['CARGA-01', 'CARGA-02', 'CARGA-03', 'CARGA-04', 'CARGA-05'];

export const options = {
  scenarios: {
    escrita: {
      executor: 'ramping-arrival-rate',
      exec: 'escrita',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { target: 50, duration: '15s' },
        { target: 100, duration: '30s' },
        { target: 100, duration: '30s' },
      ],
    },
    leitura: {
      executor: 'constant-vus',
      exec: 'leitura',
      vus: 20,
      duration: '75s',
    },
  },
  thresholds: {
    // Quase nada pode falhar.
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    // Escrever uma leitura (grava no banco e avisa a fila).
    'http_req_duration{operacao:escrita}': ['p(95)<500'],
    // Ler o histórico e os alertas.
    'http_req_duration{operacao:leitura}': ['p(95)<500'],
    // A série por período agrupa leituras no banco, então tem limite mais folgado.
    'http_req_duration{operacao:serie}': ['p(95)<1000'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'max'],
};

// Roda uma vez, antes de tudo: faz o login e entrega o token aos cenários de leitura.
export function setup() {
  const resposta = http.post(
    `${API}/api/auth/login`,
    JSON.stringify({ usuario: USUARIO, senha: SENHA }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (resposta.status !== 200) {
    throw new Error(`Login falhou (${resposta.status}). Confira USUARIO, SENHA e API_URL.`);
  }
  return { token: resposta.json('token') };
}

export function escrita() {
  const leitura = {
    idMaquina: MAQUINAS[Math.floor(Math.random() * MAQUINAS.length)],
    timestamp: Date.now(),
    temperaturaMotor: 60 + Math.random() * 20, // sempre abaixo do limite de 95: não gera alertas
    vibracao: 1 + Math.random() * 2,
    rpm: 1700 + Math.floor(Math.random() * 200),
  };
  const resposta = http.post(`${API}/api/sensores`, JSON.stringify(leitura), {
    headers: { 'Content-Type': 'application/json' },
    tags: { operacao: 'escrita' },
  });
  check(resposta, { 'leitura aceita (200)': (r) => r.status === 200 });
}

export function leitura(dados) {
  const cabecalhos = { Authorization: `Bearer ${dados.token}` };
  const maquina = MAQUINAS[Math.floor(Math.random() * MAQUINAS.length)];

  const historico = http.get(`${API}/api/sensores?maquina=${maquina}&limite=60`, {
    headers: cabecalhos,
    tags: { operacao: 'leitura' },
  });
  check(historico, { 'histórico (200)': (r) => r.status === 200 });

  const alertas = http.get(`${API}/api/alertas?limite=20`, {
    headers: cabecalhos,
    tags: { operacao: 'leitura' },
  });
  check(alertas, { 'alertas (200)': (r) => r.status === 200 });

  const serie = http.get(`${API}/api/sensores/serie?periodo=1h`, {
    headers: cabecalhos,
    tags: { operacao: 'serie' },
  });
  check(serie, { 'série (200)': (r) => r.status === 200 });

  sleep(1);
}

// Escreve um resumo em Markdown (para o resumo do job no GitHub e para colar no README) e o JSON completo.
export function handleSummary(dados) {
  const m = dados.metrics;
  const ms = (nome, estatistica) => {
    const valor = m[nome] && m[nome].values[estatistica];
    return valor === undefined ? '-' : `${valor.toFixed(1)} ms`;
  };
  const linha = (rotulo, nome) =>
    `| ${rotulo} | ${ms(nome, 'med')} | ${ms(nome, 'p(95)')} | ${ms(nome, 'max')} |`;

  const total = m.http_reqs.values.count;
  const porSegundo = m.http_reqs.values.rate.toFixed(1);
  const falhas = (m.http_req_failed.values.rate * 100).toFixed(2);

  const resumo = [
    '| Operação | Mediana | p95 | Máximo |',
    '|---|---|---|---|',
    linha('Gravar leitura (POST /api/sensores)', 'http_req_duration{operacao:escrita}'),
    linha('Histórico e alertas (GET)', 'http_req_duration{operacao:leitura}'),
    linha('Série por período (GET, 1h)', 'http_req_duration{operacao:serie}'),
    '',
    `Total: ${total} requisições, ${porSegundo} por segundo, ${falhas}% com falha.`,
    '',
  ].join('\n');

  return {
    'resultado.md': resumo,
    'resultado.json': JSON.stringify(dados, null, 2),
    stdout: `\n${resumo}\n`,
  };
}
