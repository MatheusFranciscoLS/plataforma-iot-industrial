# 0005. Modo demonstração dentro da API

## O problema

O site publicado precisa mostrar máquinas "vivas" para quem visita, mas o simulador Python é um terceiro processo que teria de rodar em
algum lugar gratuito e acordado.

## A decisão

- Com `SIMULADOR_ATIVO=true`, a **própria API gera as leituras** de três máquinas a cada 2 segundos, por dentro (sem passar pelo `POST /api/sensores`).
- Os valores **variam devagar** em torno do normal de cada máquina (uma caminhada aleatória com volta ao normal). De vez em quando
  um "episódio" leva a temperatura e/ou a vibração acima do limite por algumas dezenas de segundos. A primeira versão sorteava cada leitura do zero
  e gerou mais de 1.700 alertas em um dia, com um gráfico em serrote.
- O botão **"Simular falha"** (operador e administrador) provoca esse episódio na hora, com uma espera de 30 s por máquina. As rotas só existem com o demo ligado.
- `RETENCAO_HORAS=24` apaga leituras e alertas com mais de 24 horas, para o banco gratuito não encher.
- O botão "Ver o painel de demonstração" entra como `demo` (**operador**), de propósito: dá para testar alertas e limites, mas não para mexer em usuários.
- Como o acesso de administrador do demo é público, `PROTEGER_USUARIOS=true` trava o que poderia estragar o demo para o próximo visitante:
  `admin` e `demo` não são apagados nem têm senha ou perfil trocados, ninguém cria ou promove administradores e há um teto de usuários.
  A API responde 423. Desligado por padrão.

## O que ficou de bom

- Um processo só para hospedar, e o demo funciona mesmo sem simulador externo.
- A mesma lógica de alertas, limites e fila do uso real é exercitada.

## O que ficou de ruim

- As leituras do demo não passam pelo `POST /api/sensores`, então a chave dos sensores e a validação de entrada não são exercitadas por elas.
- É um modelo simples (três máquinas, três grandezas), não uma simulação física.
- O estado do simulador também fica na memória: reiniciar a API reinicia as máquinas no normal.

## O que foi descartado

- **Manter só o simulador Python:** precisaria de uma hospedagem gratuita extra e acordada.
- **Dados fixos no painel:** não provariam o caminho completo (API, fila, WebSocket).
