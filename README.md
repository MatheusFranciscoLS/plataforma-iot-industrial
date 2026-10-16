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
  <img src="docs/painel.webp" alt="Painel de monitoramento com temperatura, RPM e vibração de três máquinas e o histórico de temperatura da frota" width="100%">
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
Usuário: admin
Senha: senha123
```

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
- **Usuários no banco, senha em BCrypt.** O login deixou de comparar com um texto fixo no código: os usuários ficam na tabela `usuario`, só com o hash da senha. Na primeira subida com o banco vazio a API cria o usuário de demonstração (`admin`); em produção, `ADMIN_USUARIO` e `ADMIN_SENHA` trocam esse acesso. Usuário inexistente gasta o mesmo tempo de um usuário real, para o tempo de resposta não revelar quem existe.
- **Limite de tentativas no login.** Depois de 5 falhas seguidas do mesmo endereço para o mesmo usuário, o login responde 429 por 5 minutos (`LOGIN_MAX_TENTATIVAS` e `LOGIN_JANELA_SEGUNDOS` mudam isso). A contagem fica na memória, então reiniciar a API zera. Atrás da hospedagem o endereço vem do cabeçalho `X-Forwarded-For`.
- **Histórico com filtro.** `GET /api/sensores` sem parâmetros continua devolvendo os 60 mais recentes; `?maquina=MAQ-01&limite=100` filtra uma máquina e escolhe o tamanho (de 1 a 500).
- **Rota de saúde.** `GET /actuator/health` fica aberta e só diz se a API e o banco estão no ar; o RabbitMQ fora do ar não derruba a saúde, porque a API salva as leituras mesmo assim.
- **Mensagem estragada não trava a fila.** O gateway Node descarta (sem devolver à fila) a mensagem que não for um JSON com `idMaquina`, e reconecta no RabbitMQ sozinho, esperando 1 s, 2 s, 4 s... até 30 s.
- **Testes sem serviços externos.** Os testes usam banco H2 em memória e um RabbitMQ simulado, então rodam em qualquer máquina e no CI sem Docker.

## O que aprendi

- **O único teste que existia estava quebrado.** O `contextLoads` falhava porque o arquivo de propriedades de teste não tinha a chave do JWT. Sem CI, nada avisava isso. Hoje o CI roda todos os testes a cada mudança.
- **Testar a segurança de ponta a ponta vale mais que testar só a classe.** Os testes de `JwtFilter` e `TokenService` isolados passariam mesmo com a regra de rotas errada. Os testes com a aplicação inteira é que provam que `/api/sensores` realmente exige token.
- **Sem token, o Spring Security 7 responde 403, não 401.** Isso aparece nos testes: a configuração não define uma resposta própria para requisições sem autenticação, então vale o comportamento padrão.
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