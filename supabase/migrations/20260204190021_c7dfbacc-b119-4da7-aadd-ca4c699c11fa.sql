-- Tabela de backup para mensagens que falharam ao salvar
CREATE TABLE IF NOT EXISTS mensagens_backup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_sid TEXT,
  cliente_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  tentativas INTEGER DEFAULT 0,
  processado BOOLEAN DEFAULT false,
  erro_ultimo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para buscar pendentes rapidamente
CREATE INDEX idx_backup_queue_processado ON mensagens_backup_queue(processado, created_at) WHERE processado = false;

-- Índice para evitar duplicatas
CREATE INDEX idx_backup_queue_message_sid ON mensagens_backup_queue(message_sid) WHERE message_sid IS NOT NULL;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_mensagens_backup_queue_updated_at
  BEFORE UPDATE ON mensagens_backup_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE mensagens_backup_queue ENABLE ROW LEVEL SECURITY;

-- Policy para service role apenas (processamento interno)
CREATE POLICY "Service role full access" ON mensagens_backup_queue
  FOR ALL USING (true) WITH CHECK (true);