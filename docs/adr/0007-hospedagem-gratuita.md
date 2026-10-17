# 0007. Hospedagem 100% gratuita

## O problema

É um projeto prático e de portfólio: o custo precisa ser **zero**. O site publicado usa Render (API e gateway), Vercel (painel), Supabase
(PostgreSQL) e CloudAMQP (RabbitMQ), todos em planos gratuitos.

## O que isso custa

- O plano gratuito do Render **dorme a API e o gateway sem visitas** e os sobe com uma fração de CPU. Medidas feitas neste projeto:
  a API levou **169 s** para responder a primeira chamada de um sono (a subida do Java levou **147 s**).
- O banco gratuito do Supabase pausa depois de cerca de uma semana sem uso, e é limitado em conexões.

## O que foi feito (tudo sem gastar nada)

- **Subida mais rápida:** a imagem Docker guarda um arquivo CDS (classes já lidas e verificadas, gerado no `docker build`) e sobe só com o compilador rápido do Java.
  Medido no Render depois da mudança: a subida caiu de **137–147 s para 62 s**.
- **Aviso antecipado:** a tela de login chama a rota de saúde da API e do gateway assim que abre; enquanto a pessoa lê a página, eles já estão acordando.
  Se a espera passar de poucos segundos, o painel explica que o servidor está acordando.
- **Pool de conexões pequeno** (5) e `open-in-view` desligado, por causa do limite de conexões do banco.
- **"Modo candidatura":** um agendamento do GitHub Actions que chama a API e o gateway a cada 10 minutos, **só quando a variável do repositório `MANTER_ACORDADO` vale `true`**.
  Fica desligado por padrão para não gastar as horas gratuitas à toa; liga-se nos dias de divulgar o projeto.
- Um agendamento de 3 em 3 dias mantém o banco do Supabase acordado.

## O que não dá para resolver com código

Manter a API sempre acordada o tempo todo só com um plano pago (ou outra hospedagem). A decisão do projeto é aceitar o sono e reduzir a espera.

## O que foi descartado

- **Plano pago do Render:** contra a regra de custo zero do projeto.
- **Chamar a API a cada poucos minutos o tempo todo:** gastaria as horas gratuitas de todos os serviços da conta.
