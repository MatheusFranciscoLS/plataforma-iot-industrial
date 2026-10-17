# Colocar a plataforma no ar, do zero, sem pagar nada

Este guia refaz o site publicado em contas novas: banco no Supabase, fila no CloudAMQP, API e gateway no Render e painel na Vercel.
Tudo nos planos gratuitos. Leva cerca de 30 minutos, a maior parte esperando o primeiro build.

> **Aviso honesto:** o arquivo [`render.yaml`](../render.yaml) descreve exatamente os dois serviços que estão no ar hoje, mas **este passo a passo
> ainda não foi refeito do zero numa conta vazia**. Se algum passo estiver diferente na tela, o que vale é o nome da variável na tabela abaixo.

## O que cada peça faz

| Peça | Onde | Plano |
|---|---|---|
| Banco PostgreSQL | Supabase | Free |
| Fila RabbitMQ | CloudAMQP | Little Lemur (free) |
| API Java (`iot-core`) | Render | Free (dorme sem visitas) |
| Gateway Node (`servidor-node`) | Render | Free (dorme sem visitas) |
| Painel (`painel-react`) | Vercel | Hobby (free) |

## 1. Banco (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com) e guarde a senha do banco no seu gerenciador de senhas.
2. Em **Project Settings → Database → Connection string**, escolha **Session pooler** (funciona em redes só com IPv4, como o Render).
3. Monte os três valores para o Render:
   - `DB_URL` = `jdbc:postgresql://HOST:5432/postgres?sslmode=require` (o `HOST` é o do pooler).
   - `DB_USER` = o usuário da tela (algo como `postgres.xxxxxxxx`).
   - `DB_PASS` = a senha do passo 1.

As tabelas são criadas sozinhas na primeira subida da API (migrações Flyway, veja a [ADR 0003](adr/0003-migracoes-com-flyway.md)). Não há nada para rodar à mão.

## 2. Fila (CloudAMQP)

1. Crie uma instância **Little Lemur** em [cloudamqp.com](https://www.cloudamqp.com).
2. Copie o **AMQP URL** (começa com `amqps://`). É o valor de `RABBITMQ_URL` nos dois serviços do Render.

## 3. API e gateway (Render)

1. Em [render.com](https://render.com), conecte a sua conta do GitHub e dê acesso ao repositório.
2. **New → Blueprint**, escolha o repositório. O Render lê o [`render.yaml`](../render.yaml) e lista os dois serviços.
3. Ele pede os valores marcados como segredo. Preencha com a tabela da próxima seção. `JWT_SECRET` você **não** preenche: o Render gera uma
   chave e usa a mesma nos dois serviços.
4. Confirme. O primeiro build da API leva alguns minutos (ela treina o arquivo de classes que acelera a subida).
5. Quando os dois estiverem "Live", teste:

```bash
curl https://SUA-API.onrender.com/actuator/health
curl https://SEU-GATEWAY.onrender.com/saude
```

A primeira deve responder `{"status":"UP",...}` e a segunda `{"status":"ok"}`. A API leva mais de um minuto para acordar depois de um sono
(veja a [ADR 0007](adr/0007-hospedagem-gratuita.md)).

### Variáveis dos serviços

| Variável | Serviço | O que colocar |
|---|---|---|
| `DB_URL`, `DB_USER`, `DB_PASS` | API | Do passo 1 |
| `RABBITMQ_URL` | API e gateway | Do passo 2 |
| `JWT_SECRET` | API e gateway | Gerada pelo Render (grupo `iot-segredos`) |
| `CORS_ORIGINS` | API | Endereço do painel na Vercel, sem barra no fim (ex.: `https://meu-painel.vercel.app`) |
| `CORS_ORIGIN` | gateway | O mesmo endereço do painel |
| `ADMIN_SENHA` | API | Senha do usuário `admin` (só vale na primeira subida, quando o usuário é criado) |
| `DEMO_SENHA` | API | Senha do usuário `demo` (idem). O painel entra com `demo` / `demo123`: se mudar, ajuste `painel-react/src/lib/demo.js` |
| `SIMULADOR_ATIVO`, `RETENCAO_HORAS`, `PROTEGER_USUARIOS` | API | Já definidos no `render.yaml` (modo demonstração) |
| `ALERTA_WEBHOOK_URL` | API | Opcional. Link de webhook do Discord ou Slack. É um segredo: nunca coloque em arquivo do repositório |

Na primeira vez, `CORS_ORIGINS` e `CORS_ORIGIN` ainda não têm valor (o painel não existe). Deixe qualquer endereço provisório e volte depois do passo 4.

## 4. Painel (Vercel)

1. Em [vercel.com](https://vercel.com), **Add New → Project**, escolha o mesmo repositório.
2. Em **Root Directory**, escolha `painel-react`. O framework (Vite) é reconhecido sozinho.
3. Em **Environment Variables**, crie:
   - `VITE_API_JAVA` = endereço da API no Render (sem barra no fim);
   - `VITE_API_NODE` = endereço do gateway no Render.
4. Faça o deploy e copie o endereço que a Vercel gerou.
5. Volte ao Render e troque `CORS_ORIGINS` (API) e `CORS_ORIGIN` (gateway) por esse endereço. Os dois serviços reiniciam sozinhos.

## 5. Conferir

Abra o painel, clique em **Ver o painel de demonstração**. A primeira visita pode esperar a API acordar; depois, as três máquinas aparecem
com números mudando sozinhos.

Se algo falhar, olhe os logs do serviço no Render:

- `JWT_SECRET ... pelo menos 32` — a chave ficou curta ou vazia.
- erro de conexão com o banco — confira `DB_URL` (precisa de `?sslmode=require`) e o usuário do pooler.
- gateway em `sem-rabbitmq` — `RABBITMQ_URL` errada ou instância da fila sem acesso.

## Manter acordado só quando precisar

Nos dias em que for divulgar o projeto, crie no GitHub a variável de repositório `MANTER_ACORDADO` com o valor `true`
(**Settings → Secrets and variables → Actions → Variables**). O agendamento [`modo-candidatura.yml`](../.github/workflows/modo-candidatura.yml)
passa a chamar a API e o gateway a cada 10 minutos. Depois apague a variável, para não gastar as horas gratuitas à toa.
