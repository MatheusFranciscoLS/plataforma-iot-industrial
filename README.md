# 🏭 Plataforma de Monitoramento IoT Industrial

![Java](https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)

[![CI](https://github.com/MatheusFranciscoLS/plataforma-iot-industrial/actions/workflows/ci.yml/badge.svg)](https://github.com/MatheusFranciscoLS/plataforma-iot-industrial/actions/workflows/ci.yml)

> 🟢 **Acesse o painel rodando na nuvem:** [Clique aqui para abrir o Dashboard](https://plataforma-iot-industrial.vercel.app)
> *(Utilize as credenciais de teste disponíveis no final da página para entrar)*

Uma arquitetura de microsserviços ponta a ponta para monitoramento em tempo real de telemetria de máquinas industriais (Temperatura, RPM e Vibração), protegida por autenticação criptográfica JWT e orquestrada inteiramente em containers Docker.

---

# 📸 Painel em funcionamento

<p align="center">
  <img src="docs/painel-claro.png" alt="Painel de monitoramento com uma faixa vermelha avisando que uma máquina está em estado crítico, os cartões de temperatura, vibração e rotação das três máquinas e o gráfico de temperatura com a linha do limite" width="100%">
</p>

A máquina em estado crítico (MAQ-01) é destacada em vermelho; o gráfico mostra o histórico de temperatura da frota.

---

# ✨ Funcionalidades Principais

- **Streaming em Tempo Real:** Visualização instantânea da telemetria das máquinas via WebSockets, com atraso inferior a 1 segundo.
- **Alertas Dinâmicos:** Interface reativa que destaca máquinas em estado crítico (ex: Temperatura > 95°C ou Vibração > 5.0 mm/s) com efeitos visuais e mudança de cores.
- **Histórico Consolidado:** Gráfico interativo desenhando a linha do tempo da temperatura de toda a frota, consumido diretamente do banco relacional.
- **Segurança Ponta a Ponta:** Rotas da API REST e conexões de WebSocket totalmente protegidas por JSON Web Tokens (JWT).

---

# 🗺️ Arquitetura Visual

O fluxo de dados segue um padrão de produtor-consumidor, garantindo que o sistema continue estável mesmo sob alta carga de dados dos sensores IoT.

```mermaid
graph TD
    A[📡 Simulador Sensores IoT<br/>Python] -->|Envia Telemetria| B(📮 RabbitMQ)

    B -->|Consumo Assíncrono| C[⚡ Gateway Real-Time<br/>Node.js]

    C -->|Streaming WebSockets| D[💻 Dashboard<br/>React + Tailwind]

    E[🛡️ API Principal & Auth<br/>Spring Boot Java] -->|Valida Login & Histórico| D

    E -->|Persistência| F[(🗄️ PostgreSQL)]
```

---

# 🛠️ Stack por Serviço

| Serviço | Tecnologia Base | Bibliotecas / Ferramentas |
|---|---|---|
| Frontend UI | React.js (Vite) | Tailwind CSS, Recharts, Socket.io-client |
| Gateway Real-Time | Node.js | Express, Socket.io, JsonWebToken, Amqplib |
| API Core & Auth | Java 21 | Spring Boot, Spring Security, io.jsonwebtoken |
| Mensageria | RabbitMQ | Protocolo AMQP, RabbitMQ Management |
| Banco de Dados | PostgreSQL | JPA/Hibernate via Spring |
| Simulador IoT | Python 3 | Requests |
| Infraestrutura | Docker | Docker Compose, Multi-container network |

---

# 🔒 Camada de Segurança (JWT Multi-Serviço)

O ecossistema implementa uma arquitetura de segurança descentralizada:

- O **Spring Boot** valida as credenciais e emite o token assinado.
- O **React** armazena o token e o envia:
  - No cabeçalho `Authorization` para requisições REST.
  - No objeto de autenticação do WebSocket.
- O **Node.js** intercepta a conexão WebSocket e valida a assinatura JWT antes de liberar o streaming em tempo real.

---

# 🚀 Como Executar o Projeto

Graças à conteinerização com Docker, você pode subir todo o ecossistema com apenas um comando.

## 📋 Pré-requisitos

- Docker
- Docker Compose

---

## ▶️ Passo a Passo

### 1. Clone o repositório

```bash
git clone https://github.com/MatheusFranciscoLS/plataforma-iot-industrial.git

cd plataforma-iot-industrial
```

### 2. Inicialize os containers

```bash
docker compose up -d --build
```

---

# 🌐 Serviços Disponíveis

| Serviço | URL |
|---|---|
| Dashboard React | http://localhost:5173 |
| API Java Spring | http://localhost:8080 |
| RabbitMQ Management | http://localhost:15672 |

---

# 💡 Credenciais de Teste

```txt
Demonstração (perfil OPERADOR: vê tudo, reconhece alertas e troca limites)
Usuário: demo
Senha: demo123

Administrador local (perfil ADMIN: também gerencia usuários)
Usuário: admin
Senha: senha123
```

Em produção, troque a senha do `admin` (tela de usuários do painel) ou defina `ADMIN_SENHA` antes da primeira subida: essa senha padrão é pública.

---

# ✅ Testes Automatizados

A API Java (`iot-core`, 56 testes), o gateway Node (`servidor-node`, 12 testes) e o simulador Python (`simulador-python`, 6 testes) têm testes automatizados, que rodam a cada push na `main` e a cada pull request no GitHub Actions (o selo no topo mostra o resultado).

O que os testes do gateway Node cobrem: porteiro de tokens (válido, ausente, outra chave, vencido, sem assinatura), mensagens estragadas da fila, reconexão com espera crescente e a lista de origens do CORS. Os do simulador cobrem os campos e as faixas das leituras e o envio (cabeçalho de chave e tempo limite).

| O que é testado | Como |
|---|---|
| Geração do token JWT: usuário no token, validade de 2 horas, assinatura que não vale com outra chave | Teste unitário |
| Filtro de segurança: token válido autentica; sem token, token inválido, adulterado, expirado, assinado com outra chave ou sem `Bearer` não autentica | Teste unitário |
| Login (`/api/auth/login`): senha certa devolve token; senha ou usuário errado devolve 401 | Aplicação completa com banco H2 em memória |
| Rotas protegidas: `GET /api/sensores` é bloqueado sem token ou com token inválido e liberado com token válido | Aplicação completa |
| Entrada de dados: `POST /api/sensores` salva a leitura, envia para a fila `sensores.fila` e continua respondendo 200 mesmo se o RabbitMQ falhar | Aplicação completa, RabbitMQ simulado |
| Histórico: no máximo 60 registros, do mais novo para o mais antigo; data de recebimento preenchida ao salvar | Teste de repositório (JPA + H2) |

Para rodar na sua máquina:

```bash
# API Java (precisa de Java 21)
cd iot-core && ./mvnw test

# Gateway Node
cd servidor-node && npm ci && npm test

# Simulador Python
cd simulador-python && pip install -r requirements.txt && python -m unittest -v
```

---

# 🧭 Decisões e o que aprendi

## Decisões de projeto

- **Salvar primeiro, avisar depois.** A API grava a leitura no banco e só então publica na fila do RabbitMQ, com o erro da fila tratado à parte. O teste `seOBrokerFalharALeituraContinuaSalvaEARespostaEhOk` garante que, com a fila falhando, a leitura continua salva e a resposta é 200.
- **Fila entre a API e o painel.** O gateway Node consome a fila `sensores.fila` e entrega cada leitura por WebSocket (evento `novoRegistro`); o histórico do gráfico vem da API REST.
- **Um único segredo para o JWT nos dois serviços.** O Spring Boot emite o token e o Node valida a assinatura com a mesma chave, sem precisar chamar a API Java a cada conexão WebSocket.
- **Sensores enviam sem login.** `POST /api/sensores` é aberto para que o simulador (e, em um caso real, os equipamentos) não precisem de token. Já a leitura do histórico exige token. Quem quiser fechar essa porta define `SENSOR_API_KEY` na API e no simulador: a API passa a exigir o cabeçalho `X-API-Key`.
- **O sensor não escolhe o `id`.** A API recebe a leitura em um objeto próprio (`LeituraRequest`), valida os campos (nome da máquina, timestamp, temperatura, vibração e rotação) e sempre cria um registro novo. Antes, a entidade do banco era recebida direto, e um `POST` com o `id` de um registro existente o sobrescrevia (há um teste para isso).
- **Usuários no banco, senha em BCrypt.** O login deixou de comparar com um texto fixo no código: os usuários ficam na tabela `usuario`, só com o hash da senha. Na primeira subida com o banco vazio a API cria o administrador (`admin`) e o usuário de demonstração (`demo`); em produção, `ADMIN_USUARIO` e `ADMIN_SENHA` trocam o acesso do administrador e `DEMO_USUARIO` vazio desliga o de demonstração. Se o administrador ainda usa a senha padrão, a API avisa no log.
- **Três perfis.** `ADMIN` gerencia usuários (`/api/usuarios`: criar, trocar senha e perfil, apagar) e faz tudo do operador; `OPERADOR` reconhece alertas e troca limites; `LEITURA` só olha. O perfil vai dentro do token e a regra fica no `SecurityConfig`. Token sem perfil vale só como `LEITURA`, e o sistema nunca fica sem administrador. O botão de demonstração entra como `demo` (operador), de propósito: quem visita pode testar alertas e limites, mas ninguém de fora cria ou apaga usuários no site público. Usuário inexistente gasta o mesmo tempo de um usuário real, para o tempo de resposta não revelar quem existe.
- **Limite de tentativas no login.** Depois de 5 falhas seguidas do mesmo endereço para o mesmo usuário, o login responde 429 por 5 minutos (`LOGIN_MAX_TENTATIVAS` e `LOGIN_JANELA_SEGUNDOS` mudam isso). A contagem fica na memória, então reiniciar a API zera. Atrás da hospedagem o endereço vem do cabeçalho `X-Forwarded-For`.
- **Histórico com filtro.** `GET /api/sensores` sem parâmetros continua devolvendo os 60 mais recentes; `?maquina=MAQ-01&limite=100` filtra uma máquina e escolhe o tamanho (de 1 a 500).
- **Rota de saúde.** `GET /actuator/health` fica aberta e só diz se a API e o banco estão no ar; o RabbitMQ fora do ar não derruba a saúde, porque a API salva as leituras mesmo assim.
- **Chave dos tokens por variável de ambiente.** A API e o gateway leem `JWT_SECRET` (a mesma nos dois). A chave de desenvolvimento que vem no repositório é pública: serve para rodar local, a API avisa no log quando ela está em uso, e uma chave com menos de 32 caracteres impede a API de subir. Em produção, defina `JWT_SECRET` com uma chave sua (`openssl rand -base64 48`, por exemplo).
- **Painel em português e inglês.** O painel escolhe o idioma pelo navegador na primeira visita e tem um botão para trocar (a escolha fica guardada). Os textos ficam em `painel-react/src/i18n/textos.js`, sem biblioteca externa; um teste confere que os dois idiomas têm as mesmas chaves e os mesmos `{valores}`. Números e horas seguem o formato do idioma (`99,5` em português, `99.5` em inglês).
- **Alertas no servidor, com limite por máquina e reconhecimento.** A API registra um alerta quando uma máquina passa de um limite (só no momento da passagem, sem repetir enquanto continua acima). Os limites padrão são 95 °C e 5,0 mm/s e cada máquina pode ter os seus (`GET/PUT/DELETE /api/limites`, guardados na tabela `limite_maquina`). Quem está de plantão marca o alerta como visto (`POST /api/alertas/{id}/reconhecer`, que guarda quem e quando), e a lista filtra por máquina, tipo e situação (`GET /api/alertas?maquina=&tipo=&reconhecido=`). No painel, o botão "Limites de alerta" edita os valores, o gráfico desenha a linha de cada limite e o contador mostra quantos alertas ninguém reconheceu.
- **Acordar rápido na hospedagem gratuita.** O plano gratuito do Render dorme a API sem visitas e a sobe com uma fração de CPU, então a primeira visita esperava mais de dois minutos (medi 147 s e 169 s). Três mudanças atacam isso: a imagem Docker guarda um arquivo CDS (as classes já lidas e verificadas, gerado no `docker build`) e sobe com o compilador rápido do Java (`-XX:TieredStopAtLevel=1`), o pool de conexões é pequeno e a tela de login chama a rota de saúde da API e do gateway assim que abre, para eles acordarem enquanto a pessoa lê a página. O painel também consulta menos: a contagem de alertas não reconhecidos vem a cada 15 s, não a cada 5 s. Para o custo continuar zero, ainda existe o "modo candidatura" (`.github/workflows/modo-candidatura.yml`): um agendamento do GitHub Actions que chama a API e o gateway a cada 10 minutos, mas só quando a variável de repositório `MANTER_ACORDADO` vale `true`. Fica desligado por padrão para não gastar as horas gratuitas da hospedagem; liga-se nos dias em que o projeto é divulgado. Acordar a API por completo, o tempo todo, só com plano pago (ou outro tipo de hospedagem): isso não se resolve com código.
- **API documentada e observável.** A documentação interativa fica em `/swagger-ui.html` (e o JSON em `/v3/api-docs`): pública, porque só descreve as rotas, e o botão "Authorize" aceita o token do login para testar as rotas protegidas. `DOCS_ATIVAS=false` desliga. As métricas ficam em `/actuator/prometheus` e `/actuator/metrics` e só respondem com token de administrador; além das métricas padrão do Spring (memória, requisições, banco), a API conta leituras recebidas por máquina (`iot_leituras_recebidas_total`), alertas gerados por tipo (`iot_alertas_gerados_total`), falhas de envio ao RabbitMQ (`iot_rabbitmq_falhas_total`) e quantos alertas ninguém reconheceu (`iot_alertas_pendentes`). `/actuator/health` continua aberta.
- **Migrações do banco com Flyway.** O esquema do banco é criado e alterado por scripts versionados em `iot-core/src/main/resources/db/migration`, e o Hibernate não mexe mais nas tabelas. Em um banco que já tinha as tabelas (criadas antes pelo Hibernate), o Flyway apenas marca a versão 1 como feita. O `MigracoesTest` cria o esquema só com as migrações e deixa o Hibernate conferir (`ddl-auto=validate`), então mudar uma entidade sem escrever a migração quebra o CI.
- **Modo demonstração.** Com `SIMULADOR_ATIVO=true`, a própria API gera leituras de teste das três máquinas, para o painel publicado funcionar sem um simulador rodando em outro lugar. Os valores variam devagar em torno do normal de cada máquina (como numa máquina de verdade, sem pular de 60 para 105 °C de uma leitura para a outra) e, de tempos em tempos, uma delas passa dos limites por algumas dezenas de segundos e volta ao normal: é isso que gera os alertas, em vez de um alerta a cada poucos segundos. Com `RETENCAO_HORAS=24`, as leituras com mais de 24 horas são apagadas a cada 10 minutos, para o banco gratuito não encher. As duas variáveis vêm desligadas por padrão.
- **Mensagem estragada não trava a fila.** O gateway Node descarta (sem devolver à fila) a mensagem que não for um JSON com `idMaquina`, e reconecta no RabbitMQ sozinho, esperando 1 s, 2 s, 4 s... até 30 s.
- **Testes sem serviços externos.** Os testes usam banco H2 em memória e um RabbitMQ simulado, então rodam em qualquer máquina e no CI sem Docker.

## O que aprendi

- **O único teste que existia estava quebrado.** O `contextLoads` falhava porque o arquivo de propriedades de teste não tinha a chave do JWT. Sem CI, nada avisava isso. Hoje o CI roda todos os testes a cada mudança.
- **Testar a segurança de ponta a ponta vale mais que testar só a classe.** Os testes de `JwtFilter` e `TokenService` isolados passariam mesmo com a regra de rotas errada. Os testes com a aplicação inteira é que provam que `/api/sensores` realmente exige token.
- **Sem token, o Spring Security 7 responde 403 por padrão, e isso atrapalha os perfis.** Com perfis, "não sei quem você é" (401) e "sei, mas você não pode" (403) precisam ser respostas diferentes: o painel desloga no 401, mas só avisa no 403. Por isso a API define uma resposta 401 própria para quem não se identificou.
- **Versão do Java importa.** O projeto compila para Java 21 (`pom.xml` e `Dockerfile`); por isso o CI usa Java 21.

## Limitações conhecidas e próximos passos

- Não há tela nem rota para criar usuários: o usuário de demonstração é criado na subida e outros precisam ser inseridos no banco.
- O CORS aceita qualquer origem (`*`) por padrão; em produção, defina `CORS_ORIGINS` na API Java e `CORS_ORIGIN` no gateway com o endereço do painel.
- `POST /api/sensores` não exige autenticação por padrão (veja `SENSOR_API_KEY` acima).
- O limite de tentativas do login é por instância da API e fica na memória; com mais de uma instância, cada uma conta por conta própria.
- O painel React ainda não tem testes automatizados.
- O `docker-compose.yml` foi ajustado (endereços entre serviços, healthchecks e volume do banco) sem poder ser testado com Docker neste ambiente.

---

# 📈 Tecnologias e Conceitos Aplicados

- Microsserviços
- Mensageria Assíncrona
- Arquitetura Event-Driven
- WebSockets
- JWT Authentication
- Dockerização
- Comunicação em Tempo Real
- Producer / Consumer Pattern
- APIs REST
- Persistência Relacional
- Containers Multi-serviço

---

# 👨‍💻 Autor

Desenvolvido por Matheus Francisco.