# 0003. Esquema do banco por migrações (Flyway)

## O problema

No começo o Hibernate criava e alterava as tabelas sozinho (`ddl-auto=update`). Isso é cômodo, mas não deixa histórico, não dá
para repetir num banco novo com a certeza de que dá o mesmo resultado, e pode alterar um banco de produção sem ninguém ver.

## A decisão

- O esquema é criado e alterado por **scripts versionados** em `iot-core/src/main/resources/db/migration` (`V1` a `V4` até agora), executados pelo Flyway na subida.
- O Hibernate só **confere** (`ddl-auto=none` em produção; nos testes de migração, `validate`).
- O banco do demo já tinha as tabelas criadas antes do Flyway. Por isso `baseline-on-migrate` marca a versão 1 como feita
  e executa só as seguintes.

## Como isso é provado

- `MigracoesTest` cria o esquema só com as migrações num banco H2 e deixa o Hibernate conferir: **mudar uma entidade sem escrever a migração quebra o CI.**
- `BancoJaExistenteTest` reproduz o banco antigo do demo.
- No CI, as mesmas migrações rodam num **PostgreSQL 17 de verdade** (Testcontainers), nos dois pontos de partida: banco vazio e banco antigo do Hibernate,
  conferindo, por exemplo, que quem já existia antes dos perfis virou `ADMIN`.

## O que ficou de bom

- Qualquer ambiente chega ao mesmo esquema; a história de cada mudança fica no Git.
- Os testes com H2 sozinhos deixariam passar diferenças com o Postgres; os testes no Postgres real fecham essa brecha.

## O que ficou de ruim

- Toda mudança de entidade exige escrever o SQL à mão (e ele precisa funcionar nos dois bancos dos testes).
- Migração já aplicada não se edita: um erro vira uma migração nova.

## O que foi descartado

- **Continuar com `ddl-auto=update`:** sem histórico e com risco em produção.
- **`ddl-auto=create` nos testes e Flyway só em produção:** os testes não provariam as migrações.
