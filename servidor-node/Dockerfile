# Usa uma versão leve do Node.js
FROM node:20-alpine

# Cria uma pasta de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos de configuração das bibliotecas primeiro
COPY package*.json ./

# Instala as dependências (express, socket.io, cors)
RUN npm install

# Copia o resto do nosso código (o server.js)
COPY . .

# Expõe a porta 3000 para o mundo exterior
EXPOSE 3000

# O comando que o Docker vai rodar para ligar o servidor
CMD ["node", "server.js"]