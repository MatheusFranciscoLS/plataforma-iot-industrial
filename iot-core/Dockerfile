# Usamos uma imagem oficial do Java de alta performance
FROM eclipse-temurin:21-jdk

# Pasta de trabalho no container
WORKDIR /app

# Copiamos tudo da pasta iot-core para dentro do container
COPY . .

# Segredo de Sênior: Precisamos dar permissão para o Docker executar o arquivo do Maven
RUN chmod +x ./mvnw

# Expomos a porta da nossa API
EXPOSE 8080

# O comando para ligar o Spring Boot
CMD ["./mvnw", "spring-boot:run"]