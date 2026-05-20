# Imagem super leve do Node
FROM node:20-alpine

WORKDIR /app

# Copia os arquivos de dependência primeiro
COPY package*.json ./

# Instala as bibliotecas do React e do Recharts
RUN npm install

# Copia o resto do projeto
COPY . .

# Expõe a porta padrão do Vite
EXPOSE 5173

# O segredo: a flag --host libera o acesso para o seu navegador enxergar o painel
CMD ["npm", "run", "dev", "--", "--host"]