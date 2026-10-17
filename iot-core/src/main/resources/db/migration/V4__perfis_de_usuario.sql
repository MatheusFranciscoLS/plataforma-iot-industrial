-- Perfil de cada usuário: ADMIN, OPERADOR ou LEITURA.
-- Quem já existia antes desta migração é quem criou o sistema, então vira ADMIN;
-- usuários novos sem perfil explícito nascem como LEITURA (o padrão da coluna).

ALTER TABLE usuario ADD COLUMN perfil VARCHAR(20) NOT NULL DEFAULT 'LEITURA';

UPDATE usuario SET perfil = 'ADMIN';
