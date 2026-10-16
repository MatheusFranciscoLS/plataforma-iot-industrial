// Teste ponta a ponta do gateway: conecta no WebSocket com um token e espera chegar uma leitura do simulador.
import { io } from 'socket.io-client';

const token = process.env.TOKEN;
const url = process.env.GATEWAY_URL || 'http://localhost:3000';
const limiteMs = 60000;

const socket = io(url, { transports: ['websocket'], auth: { token } });

const falhar = (mensagem) => {
  console.error(`FALHOU: ${mensagem}`);
  process.exit(1);
};

setTimeout(() => falhar(`nenhuma leitura chegou em ${limiteMs / 1000} s`), limiteMs);
socket.on('connect_error', (erro) => falhar(`conexão recusada: ${erro.message}`));
socket.on('novoRegistro', (dado) => {
  if (typeof dado.idMaquina !== 'string') falhar('leitura sem idMaquina');
  console.log(`OK: leitura recebida de ${dado.idMaquina}`);
  process.exit(0);
});
