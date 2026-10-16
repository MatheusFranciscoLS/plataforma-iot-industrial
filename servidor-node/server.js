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
let reconectando = false;

// Usado por plataformas de hospedagem para saber se o serviço está de pé
app.get('/saude', (req, res) => {
    res.status(rabbitConectado ? 200 : 503).json({ status: rabbitConectado ? 'ok' : 'sem-rabbitmq' });
});

io.use(criarAutenticador(CHAVE_SECRETA));

// Uma tentativa completa: conecta, abre o canal e começa a consumir a fila.
// Se qualquer passo falhar, fecha a conexão e lança o erro (quem chamou tenta de novo).
async function configurarConsumo() {
    const conexao = await amqp.connect(RABBITMQ_URL);
    // Sem um ouvinte de 'error', o Node derrubaria o processo inteiro por qualquer falha de rede
    conexao.on('error', (erro) => console.error('Erro na conexão com o RabbitMQ:', erro.message));
    conexao.on('close', aoPerderConexao);

    try {
        const canal = await conexao.createChannel();
        canal.on('error', (erro) => console.error('Erro no canal do RabbitMQ:', erro.message));
        // Se só o canal cair, derruba a conexão também, para cair no caminho de reconexão
        canal.on('close', () => conexao.close().catch(() => {}));

        await canal.assertQueue(FILA, { durable: true });
        await canal.prefetch(20); // no máximo 20 mensagens sem confirmação por vez
        await canal.consume(FILA, (msg) => {
            if (msg === null) {
                console.error('O RabbitMQ cancelou o consumo da fila. Reconectando...');
                canal.close().catch(() => {});
                return;
            }
            processarMensagem(msg, canal, io);
        });
    } catch (erro) {
        conexao.removeListener('close', aoPerderConexao);
        await conexao.close().catch(() => {});
        throw erro;
    }

    return conexao;
}

async function iniciarConsumo() {
    reconectando = true;
    await conectarComRetentativa(configurarConsumo);
    reconectando = false;
    rabbitConectado = true;
    console.log('🐰 Conectado ao RabbitMQ! Ouvindo a fila...');
}

// Se a conexão cair depois de pronta, volta a conectar sozinho em vez de ficar surdo para sempre
function aoPerderConexao() {
    if (reconectando) return;
    rabbitConectado = false;
    console.error('Conexão com o RabbitMQ perdida. Reconectando...');
    iniciarConsumo().catch((erro) => {
        console.error('Erro ao reconectar:', erro);
        process.exit(1);
    });
}

iniciarConsumo().catch((erro) => {
    console.error('Erro no RabbitMQ:', erro);
    process.exit(1);
});

server.listen(PORTA, () => console.log(`🚀 Node.js Gateway rodando na porta ${PORTA}...`));
