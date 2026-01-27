-- Adicionar campos de auditoria avançada na tabela bot_historico
ALTER TABLE bot_historico ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE bot_historico ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE bot_historico ADD COLUMN IF NOT EXISTS request_id TEXT;

-- Adicionar índice para facilitar buscas por request_id
CREATE INDEX IF NOT EXISTS idx_bot_historico_request_id ON bot_historico(request_id);