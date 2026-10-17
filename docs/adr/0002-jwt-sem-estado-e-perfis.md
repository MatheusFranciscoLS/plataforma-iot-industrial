# 0002. JWT sem estado e perfis no token

## O problema

Dois serviços diferentes (a API Java e o gateway Node) precisam saber quem é o usuário, e a hospedagem gratuita dorme os
serviços: guardar sessões na memória de um deles não serve.

## A decisão

- O login (`POST /api/auth/login`) devolve um **JWT assinado** com o nome do usuário, o **perfil** (`ADMIN`, `OPERADOR` ou `LEITURA`)
  e a hora do login original. O gateway confere a assinatura com a mesma chave (`JWT_SECRET`), sem perguntar nada à API.
- A regra de acesso fica na API (`SecurityConfig`): o painel só usa o perfil do token para mostrar ou esconder botões.
- O token vale 2 horas. O painel pede um novo (`POST /api/auth/renovar`) quando faltam 15 minutos. A renovação relê o perfil
  no banco, recusa usuário apagado e tem um **teto de 12 horas** desde o login: um token roubado não se renova para sempre.
- Sem token a resposta é **401**; com token mas sem permissão, **403**. O painel só desloga no 401.
- Token sem a marca de perfil (os antigos) vale só como `LEITURA`.

## O que ficou de bom

- Nenhuma sessão guardada: a API pode reiniciar à vontade e o gateway valida sozinho.
- Os dois serviços compartilham uma única credencial; a chave vem de variável de ambiente e a API se recusa a subir se ela tiver menos de 32 bytes.

## O que ficou de ruim

- Não dá para "derrubar" um token já emitido: trocar a senha ou apagar o usuário só tem efeito na renovação ou quando o token vence (no máximo 2 horas).
- Uma mudança de perfil também só vale na próxima renovação.
- Quem tem a chave `JWT_SECRET` forja tokens de qualquer usuário. A chave padrão do repositório é pública; a API avisa no log enquanto ela estiver em uso.

## O que foi descartado

- **Sessão no servidor (Redis ou banco):** permitiria derrubar sessões, mas traz mais uma peça gratuita para hospedar.
- **Refresh token separado:** mais seguro contra roubo, porém exige guardar o refresh token no servidor. O token válido, com teto de sessão, resolveu o que o painel precisa.
