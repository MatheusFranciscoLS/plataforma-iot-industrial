const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { criarAutenticador, processarMensagem, conectarComRetentativa, lerOrigens } = require('../gateway');

const SEGREDO = 'chave-somente-para-testes-do-gateway-0123456789';
const mudo = { info() {}, warn() {}, error() {} };

// Roda o porteiro com um socket falso e devolve o erro (ou undefined se deixou passar)
function tentarConectar(token) {
  return new Promise((resolve) => {
    const socket = { handshake: { auth: token === undefined ? {} : { token } } };
    criarAutenticador(SEGREDO, mudo)(socket, resolve);
  });
}

test('token válido deixa conectar', async () => {
  const token = jwt.sign({ sub: 'admin' }, SEGREDO, { expiresIn: '2h' });
  assert.equal(await tentarConectar(token), undefined);
});

test('sem token a conexão é recusada', async () => {
  const erro = await tentarConectar(undefined);
  assert.match(erro.message, /Token ausente/);
});

test('token assinado com outra chave é recusado', async () => {
  const token = jwt.sign({ sub: 'admin' }, 'outra-chave-completamente-diferente-9876543210');
  const erro = await tentarConectar(token);
  assert.match(erro.message, /Token inválido/);
});

test('token vencido é recusado', async () => {
  const token = jwt.sign({ sub: 'admin' }, SEGREDO, { expiresIn: -10 });
  const erro = await tentarConectar(token);
  assert.match(erro.message, /Token inválido/);
});

test('token sem assinatura (alg none) é recusado', async () => {
  const cabecalho = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const corpo = Buffer.from(JSON.stringify({ sub: 'admin' })).toString('base64url');
  const erro = await tentarConectar(`${cabecalho}.${corpo}.`);
  assert.match(erro.message, /Token inválido/);
});

// ---------- Mensagens da fila ----------

function filaFalsa() {
  const chamadas = { ack: 0, nack: [], emitidos: [] };
  return {
    chamadas,
    canal: { ack: () => chamadas.ack++, nack: (_msg, todas, devolver) => chamadas.nack.push({ todas, devolver }) },
    io: { emit: (evento, dados) => chamadas.emitidos.push({ evento, dados }) },
  };
}
const mensagem = (texto) => ({ content: Buffer.from(texto) });

test('mensagem boa é repassada ao painel e confirmada', () => {
  const { chamadas, canal, io } = filaFalsa();
  processarMensagem(mensagem('{"idMaquina":"MAQ-01","temperaturaMotor":80}'), canal, io, mudo);

  assert.deepEqual(chamadas.emitidos, [{ evento: 'novoRegistro', dados: { idMaquina: 'MAQ-01', temperaturaMotor: 80 } }]);
  assert.equal(chamadas.ack, 1);
});

test('mensagem que não é JSON é descartada sem derrubar o gateway e sem voltar para a fila', () => {
  const { chamadas, canal, io } = filaFalsa();
  processarMensagem(mensagem('isto não é json'), canal, io, mudo);

  assert.equal(chamadas.emitidos.length, 0);
  assert.equal(chamadas.ack, 0);
  assert.deepEqual(chamadas.nack, [{ todas: false, devolver: false }]);
});

test('mensagem sem idMaquina é descartada', () => {
  const { chamadas, canal, io } = filaFalsa();
  processarMensagem(mensagem('{"temperaturaMotor":80}'), canal, io, mudo);

  assert.equal(chamadas.emitidos.length, 0);
  assert.equal(chamadas.nack.length, 1);
});

test('mensagem nula (consumidor cancelado) é ignorada', () => {
  const { chamadas, canal, io } = filaFalsa();
  processarMensagem(null, canal, io, mudo);

  assert.equal(chamadas.ack + chamadas.nack.length + chamadas.emitidos.length, 0);
});

// ---------- Reconexão ----------

test('tenta conectar de novo, esperando cada vez mais, até conseguir', async () => {
  let tentativas = 0;
  const esperas = [];
  const conexao = { ok: true };

  const resultado = await conectarComRetentativa(
    async () => {
      tentativas++;
      if (tentativas < 4) throw new Error('RabbitMQ fora do ar');
      return conexao;
    },
    { esperaInicialMs: 1000, esperaMaxMs: 30000, pausar: async (ms) => esperas.push(ms), log: mudo },
  );

  assert.equal(resultado, conexao);
  assert.equal(tentativas, 4);
  assert.deepEqual(esperas, [1000, 2000, 4000]);
});

test('a espera entre tentativas não passa do máximo', async () => {
  let tentativas = 0;
  const esperas = [];

  await conectarComRetentativa(
    async () => {
      if (++tentativas < 6) throw new Error('fora do ar');
    },
    { esperaInicialMs: 1000, esperaMaxMs: 3000, pausar: async (ms) => esperas.push(ms), log: mudo },
  );

  assert.deepEqual(esperas, [1000, 2000, 3000, 3000, 3000]);
});

// ---------- CORS ----------

test('sem CORS_ORIGIN aceita qualquer origem; com valor, só as listadas', () => {
  assert.equal(lerOrigens(undefined), '*');
  assert.equal(lerOrigens('*'), '*');
  assert.deepEqual(lerOrigens('https://a.com, https://b.com'), ['https://a.com', 'https://b.com']);
});
