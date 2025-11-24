-- Remover a foreign key atual que aponta para auth.users
ALTER TABLE clientes 
DROP CONSTRAINT IF EXISTS clientes_atendente_id_fkey;

-- Criar nova foreign key apontando para profiles
ALTER TABLE clientes 
ADD CONSTRAINT clientes_atendente_id_fkey 
FOREIGN KEY (atendente_id) 
REFERENCES profiles(id) 
ON DELETE SET NULL;