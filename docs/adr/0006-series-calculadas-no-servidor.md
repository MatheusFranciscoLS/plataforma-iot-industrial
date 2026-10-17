# 0006. Séries por período calculadas no servidor

## O problema

O gráfico só mostrava as últimas 20 a 160 leituras. Ver a última hora, 6 horas ou o dia exige muitas leituras (cada máquina grava uma a cada 2 s:
cerca de 43 mil por máquina em 24 horas), e mandar tudo isso ao navegador seria lento e desperdiçaria a banda do plano gratuito.

## A decisão

- `GET /api/sensores/serie?periodo=1h|6h|24h` agrupa as leituras em **faixas de 1, 5 ou 15 minutos** direto no banco (média e máximo de
  temperatura e vibração, rotação média): cerca de 100 pontos por máquina. `GET /api/sensores/resumo` traz o resumo por máquina (leituras, média,
  máximo, mínimo e alertas).
- O agrupamento usa **divisão inteira do `timestamp`**. A faixa vem de um enum e entra no texto da consulta, porque o PostgreSQL
  não aceita a mesma conta com parâmetro no `SELECT` e no `GROUP BY`. Como H2 e Postgres poderiam divergir aqui, **um teste roda no Postgres real** (CI).
- O resultado de cada consulta fica **15 segundos** em memória, para vários painéis abertos não repetirem a mesma conta.
- O relógio é um bean (`Clock`), então os testes fixam a hora e conferem números exatos.
- O painel consulta a cada 30 s e descarta a resposta antiga quando o período muda.

## O que ficou de bom

- Poucos pontos trafegam; a conta pesada fica onde há índice (`idx_registro_sensor_timestamp`).
- Mesma API para o gráfico, para a comparação entre máquinas e para o gráfico da janela de cada máquina.

## O que ficou de ruim

- Só existe o que o banco guarda: no demo a limpeza mantém 24 horas, então não há 7 dias.
- Não há uma tabela de agregados pré-calculados: cada consulta varre as leituras do período (aceitável no volume atual, e o cache de 15 s ajuda).

## O que foi descartado

- **Agregar no painel:** exigiria baixar milhares de leituras por período.
- **Uma tabela de resumos por minuto, alimentada a cada leitura:** mais código e mais escrita por leitura, sem necessidade com este volume.
