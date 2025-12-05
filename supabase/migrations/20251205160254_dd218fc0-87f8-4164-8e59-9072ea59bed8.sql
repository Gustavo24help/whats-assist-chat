-- Adicionar coluna para identificar quem enviou a mensagem
ALTER TABLE mensagens 
ADD COLUMN enviado_por_id uuid REFERENCES auth.users(id);

-- Criar índice para performance nas consultas
CREATE INDEX idx_mensagens_enviado_por ON mensagens(enviado_por_id);