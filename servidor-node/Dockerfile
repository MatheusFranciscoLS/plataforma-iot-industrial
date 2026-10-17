# Usa uma versão leve do Node.js
FROM node:20-alpine

# Cria uma pasta de trabalho dentro do container, que pertence ao usuário comum "node"
WORKDIR /usr/src/app
RUN chown node:node /usr/src/app

# Não roda como administrador dentro do container
USER node

# Copia os arquivos de configuração das bibliotecas primeiro (aproveita o cache do Docker)
COPY --chown=node:node package*.json ./

# Instala só as dependências de produção, nas versões exatas do package-lock.json (express, socket.io, amqplib...)
RUN npm ci --omit=dev

# Copia o resto do nosso código (o server.js)
COPY --chown=node:node . .

# Expõe a porta 3000 para o mundo exterior
EXPOSE 3000

# O comando que o Docker vai rodar para ligar o servidor
CMD ["node", "server.js"]
