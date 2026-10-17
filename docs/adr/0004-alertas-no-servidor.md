# 0004. Alertas calculados e guardados no servidor

## O problema

No começo, o alerta existia só na tela: o painel pintava a máquina de vermelho quando a leitura passava de 95 °C ou 5,0 mm/s, e a lista
de "alertas" sumia ao recarregar a página. Não havia histórico, nem como saber quem viu o quê, nem como avisar quem não estava olhando.

## A decisão

- A API avalia **cada leitura recebida** e grava um alerta (`alerta`) **só no momento em que a máquina passa do limite** (borda de subida).
  Enquanto a máquina continua acima, as leituras seguintes não geram alertas repetidos; se voltar ao normal e passar de novo, gera outro.
- O limite padrão é 95 °C e 5,0 mm/s e **cada máquina pode ter o seu** (`limite_maquina`, rotas `/api/limites`). O painel lê os limites da API.
- Alertas se **reconhecem** (`POST /api/alertas/{id}/reconhecer`): guarda quem viu primeiro e quando. A lista filtra por máquina, tipo e situação.
- Cada alerta novo pode virar uma mensagem no Discord ou Slack (webhook), de forma assíncrona e sem atrapalhar a leitura.
- A avaliação do alerta roda dentro do tratamento da leitura, mas dentro de um `try/catch`: um erro nela **não impede a leitura de ser salva**.

## O que ficou de bom

- A lista de alertas sobrevive a recarregar a página e vale para todos que abrem o painel.
- O contador de alertas sem reconhecer vira métrica (`iot_alertas_pendentes`) e painel no Grafana.

## O que ficou de ruim

- O estado "a leitura anterior já estava acima?" e a cópia dos limites por máquina ficam **na memória da API**. Reiniciar a API faz a primeira leitura acima do limite alertar de novo, e rodar duas instâncias exigiria guardar esse estado num lugar compartilhado.
- A pessoa que reconhece é só registrada; não há fila de atribuição nem escalonamento.

## O que foi descartado

- **Guardar o estado "estava acima" no banco a cada leitura:** uma consulta a mais por leitura, na hospedagem que já é lenta.
- **Alertar a cada leitura acima do limite:** enche a lista (foi exatamente o que o demo fazia antes de ganhar dados realistas).
