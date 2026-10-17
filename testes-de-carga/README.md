# Teste de carga (k6)

`carga.js` usa o [k6](https://k6.io) para castigar a API com dois grupos ao mesmo tempo, como no uso real:

- **Escrita:** sensores mandando leituras (`POST /api/sensores`), de 10 até 100 por segundo.
- **Leitura:** 20 painéis abertos consultando histórico, alertas e a série da última hora.

Os limites ficam no próprio script (`thresholds`): menos de 1% de falhas e p95 abaixo de 500 ms (1 s na série por período).
Se a API piorar, o teste falha.

## Rodar no GitHub

A aba **Actions → Teste de carga → Run workflow**. O resultado aparece no resumo do job.

## Rodar na sua máquina

Com a API no ar (`docker compose up -d --build postgres-db rabbitmq iot-core`, sem o simulador):

```bash
docker run --rm --network host -v "$PWD/testes-de-carga:/scripts" -w /scripts grafana/k6:1.1.0 run carga.js
```

Para outro endereço ou outro usuário: `-e API_URL=... -e USUARIO=... -e SENHA=...`.
Os resultados `resultado.md` e `resultado.json` são gerados nesta pasta e não vão para o Git.

O teste grava leituras de cinco máquinas fictícias (`CARGA-01` a `CARGA-05`). **Não rode contra o site publicado.**
