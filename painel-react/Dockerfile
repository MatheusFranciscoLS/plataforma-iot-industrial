# Imagem super leve do Node (este Dockerfile serve o painel em modo de desenvolvimento, no docker-compose;
# o site publicado é gerado com "npm run build" na Vercel)
FROM node:20-alpine

# A pasta de trabalho pertence ao usuário comum "node": o Vite precisa escrever o cache dentro dela
WORKDIR /app
RUN chown node:node /app

# Não roda como administrador dentro do container
USER node

# Copia os arquivos de dependência primeiro (aproveita o cache do Docker)
COPY --chown=node:node package*.json ./

# Instala as bibliotecas do React e do Recharts, nas versões exatas do package-lock.json
RUN npm ci

# Copia o resto do projeto
COPY --chown=node:node . .

# Expõe a porta padrão do Vite
EXPOSE 5173

# O segredo: a flag --host libera o acesso para o seu navegador enxergar o painel
CMD ["npm", "run", "dev", "--", "--host"]
