# Decisões de arquitetura

Cada decisão grande do projeto tem uma página curta: o problema, o que foi escolhido, o que ficou de bom e de ruim e o que foi descartado.
O formato é o dos *Architecture Decision Records* (ADR). São registros do que foi decidido **naquele momento**: se uma decisão mudar, a página
não é apagada, ganha uma nota de "substituída por".

| # | Decisão | Em uma frase |
|---|---|---|
| [0001](0001-fila-entre-api-e-gateway.md) | Uma fila (RabbitMQ) entre a API e o gateway | A API salva e avisa a fila; o gateway entrega ao painel. Fila fora do ar não perde leitura. |
| [0002](0002-jwt-sem-estado-e-perfis.md) | JWT sem estado, perfis no token | Sem sessão guardada no servidor; renovação com teto de 12 horas. |
| [0003](0003-migracoes-com-flyway.md) | Esquema do banco por migrações (Flyway) | O Hibernate só confere; mudar uma entidade sem migração quebra o CI. |
| [0004](0004-alertas-no-servidor.md) | Alertas calculados e guardados no servidor | Um alerta por passagem do limite, com limite por máquina e reconhecimento. |
| [0005](0005-modo-demonstracao.md) | Modo demonstração dentro da API | Um simulador interno, episódios de falha e proteção dos usuários públicos. |
| [0006](0006-series-calculadas-no-servidor.md) | Séries por período calculadas no servidor | O painel recebe ~100 pontos por máquina, não milhares de leituras. |
| [0007](0007-hospedagem-gratuita.md) | Hospedagem 100% gratuita | O que isso custou em espera, e o que foi feito para reduzir. |
