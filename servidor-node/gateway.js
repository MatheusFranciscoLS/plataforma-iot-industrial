// Peças do gateway que não dependem de rede, separadas do server.js para poderem ser testadas.
const jwt = require('jsonwebtoken');

const ALGORITMOS = ['HS256', 'HS384', 'HS512']; // o Spring escolhe um deles conforme o tamanho da chave

/** Porteiro do Socket.io: só deixa conectar quem apresentar um token assinado com a chave certa. */
function criarAutenticador(segredo, log = console) {
  return (socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;

    if (!token) {
      log.warn('Conexão recusada: nenhum token fornecido.');
      return next(new Error('Acesso negado: Token ausente'));
    }

    jwt.verify(token, segredo, { algorithms: ALGORITMOS }, (erro, decodificado) => {
      if (erro) {
        log.warn(`Conexão recusada: token inválido ou expirado (${erro.name}).`);
        return next(new Error('Acesso negado: Token inválido'));
      }
      log.info(`Conexão autorizada para o usuário: ${decodificado.sub}`);
      next();
    });
  };
}

/**
 * Trata uma mensagem da fila. Mensagem estragada vai embora (nack sem devolver à fila),
 * senão ela voltaria para sempre e travaria as seguintes.
 */
function processarMensagem(msg, canal, io, log = console) {
  if (msg === null) return; // o consumidor foi cancelado pelo RabbitMQ

  let dados;
  try {
    dados = JSON.parse(msg.content.toString());
  } catch {
    log.error('Mensagem descartada: não é um JSON válido.');
    canal.nack(msg, false, false);
    return;
  }

  if (!dados || typeof dados.idMaquina !== 'string') {
    log.error('Mensagem descartada: falta o idMaquina.');
    canal.nack(msg, false, false);
    return;
  }

  io.emit('novoRegistro', dados);
  canal.ack(msg);
}

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Tenta conectar de novo, esperando cada vez mais (1 s, 2 s, 4 s... até `esperaMaxMs`), sem desistir. */
async function conectarComRetentativa(conectar, { esperaInicialMs = 1000, esperaMaxMs = 30000, pausar = dormir, log = console } = {}) {
  let espera = esperaInicialMs;

  for (;;) {
    try {
      return await conectar();
    } catch (erro) {
      log.error(`Falha ao conectar no RabbitMQ (${erro.message || erro.code || erro.name}). Nova tentativa em ${espera / 1000} s.`);
      await pausar(espera);
      espera = Math.min(espera * 2, esperaMaxMs);
    }
  }
}

/** Lista de origens aceitas pelo CORS a partir de um texto "a,b,c". Sem valor, aceita todas (comportamento anterior). */
function lerOrigens(texto) {
  const lista = (texto || '*').split(',').map((o) => o.trim()).filter(Boolean);
  return lista.includes('*') ? '*' : lista;
}

module.exports = { criarAutenticador, processarMensagem, conectarComRetentativa, lerOrigens };
