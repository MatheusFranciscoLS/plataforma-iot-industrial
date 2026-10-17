# Etapa 1: compila e empacota a aplicação em um único .jar
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Copia primeiro só o necessário para baixar as dependências (aproveita o cache do Docker)
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN chmod +x ./mvnw && ./mvnw -B -q dependency:go-offline

COPY src src
RUN ./mvnw -B -q -DskipTests package

# Etapa 2: imagem final, só com o Java necessário para rodar (sem Maven nem código-fonte)
FROM eclipse-temurin:21-jre
WORKDIR /app

# Não roda como administrador dentro do container
RUN useradd --system --no-create-home iot
USER iot

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080
# Memória: em container pequeno (a hospedagem gratuita tem 512 MB), o coletor de lixo simples e uma fatia
# maior da memória para o heap deixam a API mais enxuta do que o padrão do Java.
CMD ["java", "-XX:+UseSerialGC", "-XX:MaxRAMPercentage=60", "-jar", "app.jar"]
