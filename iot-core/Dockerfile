# Etapa 1: compila e empacota a aplicação em um único .jar
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app

# Copia primeiro só o necessário para baixar as dependências (aproveita o cache do Docker)
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN chmod +x ./mvnw && ./mvnw -B -q dependency:go-offline

COPY src src
RUN ./mvnw -B -q -DskipTests package

# Etapa 2: imagem final, só com o Java necessário para rodar (sem Maven nem código-fonte)
FROM eclipse-temurin:25-jre
WORKDIR /app

# Não roda como administrador dentro do container
RUN useradd --system --no-create-home iot

# Opções do Java, as mesmas no treino do arquivo CDS e na execução (o arquivo só vale com as mesmas opções):
# - UseSerialGC e MaxRAMPercentage: coletor de lixo simples e mais memória para o heap, para caber nos 512 MB da hospedagem gratuita;
# - TieredStopAtLevel=1: só o compilador rápido do Java. Na hospedagem gratuita (uma fração de CPU) a subida
#   é limitada por CPU, e o compilador completo gasta mais do que devolve numa API tão pequena.
ENV JAVA_OPTS="-XX:+UseSerialGC -XX:MaxRAMPercentage=60 -XX:TieredStopAtLevel=1"

COPY --from=build /app/target/*.jar app.jar

# Subida mais rápida com CDS (Class Data Sharing): o Java guarda num arquivo as classes já lidas e verificadas
# e, nas próximas subidas, carrega esse arquivo em vez de ler o .jar de novo. O treino roda a aplicação até
# o Spring montar o contexto (sem precisar de banco nem de fila) e grava o arquivo. Se o treino falhar, a imagem
# continua valendo: o Java só avisa que não achou o arquivo e sobe do jeito normal.
RUN java -Djarmode=tools -jar app.jar extract --destination extraido \
    && (java $JAVA_OPTS -XX:ArchiveClassesAtExit=extraido/app.jsa -Dspring.context.exit=onRefresh -jar extraido/app.jar || true) \
    && chown -R iot /app
USER iot

EXPOSE 8080
CMD ["sh", "-c", "exec java $JAVA_OPTS -XX:SharedArchiveFile=extraido/app.jsa -jar extraido/app.jar"]
