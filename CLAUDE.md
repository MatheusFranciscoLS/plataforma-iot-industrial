# Plataforma IoT Industrial

Monitoramento em tempo real de telemetria de máquinas (temperatura, rotação e vibração). Escrito em português do Brasil: textos da interface, comentários e mensagens de commit.

## Como os serviços se falam

`simulador-python` → `POST /api/sensores` na API Java (`iot-core`) → grava no PostgreSQL e publica na fila `sensores.fila` do RabbitMQ → `servidor-node` consome a fila e envia cada leitura por WebSocket (evento `novoRegistro`) → `painel-react`. O painel faz login na API Java e usa o mesmo token JWT no WebSocket; Java e Node assinam e validam com a mesma chave.

## Comandos

| Serviço | Testes | Observação |
|---|---|---|
| `iot-core` (Java 21, Spring Boot 4) | `./mvnw test` | com Java 17 local use `-Djava.version=17` |
| `servidor-node` | `npm ci && npm test` | `node --test`, sem Docker |
| `simulador-python` | `pip install -r requirements.txt && python -m unittest -v` | |
| `painel-react` (Vite, React 19, Tailwind 3, shadcn/ui) | `npm run lint`, `npm run build` e, depois do PR do redesign, `npm test` (Vitest) | `npm run dev` |

O CI (`.github/workflows`) roda tudo isso a cada push na `main` e a cada pull request.

## Regras do projeto

- Os limites de alerta são 95 °C e 5,0 mm/s (`painel-react/src/lib/limites.js`).
- O corpo do `POST /api/sensores` entra por `LeituraRequest`; nunca receber a entidade `RegistroSensor` direto (o sensor poderia escolher o `id` e sobrescrever registros).
- Segredos (chave do JWT, senhas) não devem ir para o repositório nem para logs; hoje alguns valores de demonstração ainda estão em `application.properties` e `docker-compose.yml`.
- Os testes da API usam H2 em memória e RabbitMQ simulado; não dependem de Docker.
- Não há Docker no ambiente de desenvolvimento usado até agora: mudanças no `docker-compose.yml` e nos `Dockerfile` precisam ser testadas com `docker compose up --build` antes de mesclar.
