-- Remover a FK existente que aponta para auth.users
ALTER TABLE mensagens DROP CONSTRAINT IF EXISTS mensagens_enviado_por_id_fkey;

-- Adicionar nova FK que aponta para profiles (que tem o mesmo ID do auth.users)
ALTER TABLE mensagens 
ADD CONSTRAINT mensagens_enviado_por_id_fkey 
FOREIGN KEY (enviado_por_id) REFERENCES profiles(id);