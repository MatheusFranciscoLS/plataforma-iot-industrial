# 0001. Uma fila (RabbitMQ) entre a API e o gateway

## O problema

O painel precisa ver cada leitura em tempo real, e a leitura também precisa ser guardada no banco. Quem fala com o navegador
(WebSocket) e quem guarda (API Java) podiam ser a mesma peça, ou duas.

## A decisão

A API Java recebe a leitura (`POST /api/sensores`), **salva no banco primeiro** e só então publica na fila `sensores.fila`.
O gateway Node consome a fila e entrega cada leitura ao painel por WebSocket, depois de conferir o token JWT.

## O que ficou de bom

- A leitura nunca se perde por causa do tempo real: se publicar na fila falhar, o erro é só registrado (e contado em
  `iot_rabbitmq_falhas_total`) e a API responde 200 do mesmo jeito. Há teste para isso.
- O gateway pode reiniciar ou ficar fora do ar sem atrapalhar a gravação. Ele reconecta sozinho, esperando 1 s, 2 s, 4 s... até 30 s.
- Se o tempo real não chegar, o painel percebe, mostra "Atualizando por consulta" e passa a buscar as leituras novas na API a cada 3 segundos.
- A API e o gateway escalam e falham de forma independente.

## O que ficou de ruim

- É uma peça a mais para hospedar e vigiar. Na hospedagem gratuita, a fila foi o serviço que mais deu trabalho (credenciais
  recusadas, instância nova a criar).
- Uma mensagem estragada na fila poderia travar o consumo. Por isso o gateway descarta, sem devolver à fila, a mensagem que não for um JSON com `idMaquina`.
- Não há fila de mensagens mortas nem reprocessamento: o que não chega ao tempo real fica só no banco (o painel o recupera pelo histórico).

## O que foi descartado

- **A API entregar o WebSocket direto:** acoplaria a gravação às conexões abertas, e reiniciar a API derrubaria todos os painéis.
- **O gateway ler o banco de tempos em tempos:** adiciona atraso e carga no banco só para o painel ficar atualizado.
