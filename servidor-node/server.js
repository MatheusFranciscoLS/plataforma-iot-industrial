require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const amqp = require('amqplib');
const { criarAutenticador, processarMensagem, conectarComRetentativa, lerOrigens } = require('./gateway');

// A mesma chave do TokenService.java. Sem ela ninguém conseguiria entrar, então é melhor nem subir.
const CHAVE_SECRETA = process.env.JWT_SECRET;
if (!CHAVE_SECRETA) {
    console.error('JWT_SECRET não definida: o gateway não tem como validar os tokens.');
    process.exit(1);
}

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const FILA = 'sensores.fila';
const PORTA = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: lerOrigens(process.env.CORS_ORIGIN), // sem CORS_ORIGIN, aceita qualquer origem
        methods: ['GET', 'POST']
    }
});

let rabbitConectado = false;

// Usado por plataformas de hospedagem para saber se o serviço está de pé
app.get('/saude', (req, res) => {
    res.status(rabbitConectado ? 200 : 503).json({ status: rabbitConectado ? 'ok' : 'sem-rabbitmq' });
});

io.use(criarAutenticador(CHAVE_SECRETA));

async function consumirFila() {
    const conexao = await conectarComRetentativa(() => amqp.connect(RABBITMQ_URL));
    const canal = await conexao.createChannel();
    await canal.assertQueue(FILA, { durable: true });
    await canal.prefetch(20); // no máximo 20 mensagens sem confirmação por vez

    rabbitConectado = true;
    console.log('🐰 Conectado ao RabbitMQ! Ouvindo a fila...');

    // Se a conexão cair, volta a conectar sozinho em vez de ficar surdo para sempre
    const aoPerder = (motivo) => {
        if (!rabbitConectado) return; // 'error' e 'close' chegam juntos; só reage uma vez
        rabbitConectado = false;
        console.error(`Conexão com o RabbitMQ perdida (${motivo}). Reconectando...`);
        consumirFila().catch((erro) => console.error('Erro ao reconectar:', erro));
    };
    conexao.on('error', (erro) => aoPerder(erro.message));
    conexao.on('close', () => aoPerder('conexão fechada'));

    canal.consume(FILA, (msg) => processarMensagem(msg, canal, io));
}

consumirFila().catch((erro) => {
    console.error('Erro no RabbitMQ:', erro);
    process.exit(1);
});

server.listen(PORTA, () => console.log(`🚀 Node.js Gateway rodando na porta ${PORTA}...`));
