-- Adicionar colunas para rastreamento de status de mensagens
ALTER TABLE mensagens 
ADD COLUMN IF NOT EXISTS message_sid TEXT,
ADD COLUMN IF NOT EXISTS status_atualizado_em TIMESTAMPTZ DEFAULT NOW();

-- Índice para busca rápida por MessageSid
CREATE INDEX IF NOT EXISTS idx_mensagens_message_sid ON mensagens(message_sid);

-- Comentários para documentação
COMMENT ON COLUMN mensagens.message_sid IS 'ID único da mensagem retornado pela Twilio para rastreamento de status';
COMMENT ON COLUMN mensagens.status_atualizado_em IS 'Timestamp da última atualização de status da mensagem';