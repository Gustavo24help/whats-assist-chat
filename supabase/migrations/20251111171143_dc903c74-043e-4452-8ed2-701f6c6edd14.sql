-- Adicionar coluna para responder mensagens específicas
ALTER TABLE mensagens 
ADD COLUMN reply_to_message_id UUID REFERENCES mensagens(id) ON DELETE SET NULL;

-- Índice para melhorar performance de queries com replies
CREATE INDEX idx_mensagens_reply_to ON mensagens(reply_to_message_id);