require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const amqp = require('amqplib');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Aceita conexões de qualquer lugar
        methods: ["GET", "POST"]
    }
}
);

// A mesma chave idêntica do TokenService.java!
const CHAVE_SECRETA = process.env.JWT_SECRET;

// O Middleware de Segurança do Socket.io
io.use((socket, next) => {
    // O React vai mandar o token dentro de um objeto 'auth'
    const token = socket.handshake.auth.token;

    if (!token) {
        console.log("🚫 Conexão recusada: Nenhum token fornecido.");
        return next(new Error("Acesso negado: Token ausente"));
    }

    // Tenta decodificar e validar o token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log("🚫 Conexão recusada: Token inválido ou expirado.");
            return next(new Error("Acesso negado: Token inválido"));
        }
        
        // Se a chave bateu, libera a catraca!
        console.log(`✅ Conexão autorizada para o usuário: ${decoded.sub}`);
        next();
    });
});

async function conectarRabbitMQ() {
    try {
        // Conecta no RabbitMQ pelo nome do container
        const connection = await amqp.connect('amqp://guest:guest@rabbitmq:5672');
        const channel = await connection.createChannel();
        await channel.assertQueue('sensores.fila', { durable: true });

        console.log("🐰 Conectado ao RabbitMQ! Ouvindo a fila...");

        // Fica vigiando a fila
        channel.consume('sensores.fila', (msg) => {
            if (msg !== null) {
                const dados = JSON.parse(msg.content.toString());
                console.log("📡 Repassando do Rabbit p/ React:", dados.idMaquina);
                
                // Repassa para o React
                io.emit('novoRegistro', dados);
                
                channel.ack(msg); // Confirma que leu a mensagem
            }
        });
    } catch (error) {
        console.error("Erro no RabbitMQ:", error);
    }
}

conectarRabbitMQ();

server.listen(3000, () => console.log('🚀 Node.js Gateway rodando...'));