
-- Add numero_twilio to existing tables
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS numero_twilio text;
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS numero_twilio text;

-- Backfill existing clients
UPDATE clientes SET numero_twilio = 'whatsapp:+554138911555' WHERE numero_twilio IS NULL;

-- Create prestadores_chat table
CREATE TABLE prestadores_chat (
  telefone text PRIMARY KEY,
  nome text NOT NULL DEFAULT 'Prestador',
  cpf text REFERENCES prestadores(cpf),
  status_conversa status_conversa_enum DEFAULT 'aberta',
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  ultima_interacao timestamptz DEFAULT now(),
  numero_twilio text,
  arquivado boolean DEFAULT false,
  marcado_nao_lido boolean DEFAULT false,
  notas_internas text
);

ALTER TABLE prestadores_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atendentes podem ver prestadores_chat" ON prestadores_chat FOR SELECT USING (true);
CREATE POLICY "Atendentes podem inserir prestadores_chat" ON prestadores_chat FOR INSERT WITH CHECK (true);
CREATE POLICY "Atendentes podem atualizar prestadores_chat" ON prestadores_chat FOR UPDATE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE prestadores_chat;

-- Create mensagens_prestadores table
CREATE TABLE mensagens_prestadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_telefone text NOT NULL REFERENCES prestadores_chat(telefone) ON DELETE CASCADE,
  ficha_id text REFERENCES fichas_de_servico(id),
  remetente text NOT NULL,
  texto text,
  arquivo_url text,
  tipo tipo_mensagem_enum DEFAULT 'texto',
  status status_mensagem_enum DEFAULT 'enviado',
  data_hora timestamptz DEFAULT now(),
  numero_twilio text,
  message_sid text,
  enviado_por_id uuid,
  reply_to_message_id uuid
);

CREATE INDEX idx_mensagens_prestadores_telefone ON mensagens_prestadores(prestador_telefone);
CREATE INDEX idx_mensagens_prestadores_ficha ON mensagens_prestadores(ficha_id);
CREATE INDEX idx_mensagens_prestadores_data ON mensagens_prestadores(data_hora DESC);
CREATE INDEX idx_mensagens_prestadores_sid ON mensagens_prestadores(message_sid);

ALTER TABLE mensagens_prestadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atendentes podem ver mensagens_prestadores" ON mensagens_prestadores FOR SELECT USING (true);
CREATE POLICY "Atendentes podem inserir mensagens_prestadores" ON mensagens_prestadores FOR INSERT WITH CHECK (true);
CREATE POLICY "Atendentes podem atualizar mensagens_prestadores" ON mensagens_prestadores FOR UPDATE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE mensagens_prestadores;

-- Create conversa_ficha_vinculo table
CREATE TABLE conversa_ficha_vinculo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id text NOT NULL REFERENCES fichas_de_servico(id),
  cliente_telefone text,
  prestador_telefone text,
  vinculado_em timestamptz DEFAULT now(),
  vinculado_por text,
  ativo boolean DEFAULT true
);

CREATE INDEX idx_vinculo_ficha ON conversa_ficha_vinculo(ficha_id);
CREATE INDEX idx_vinculo_cliente ON conversa_ficha_vinculo(cliente_telefone);
CREATE INDEX idx_vinculo_prestador ON conversa_ficha_vinculo(prestador_telefone);

ALTER TABLE conversa_ficha_vinculo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atendentes podem ver vinculos" ON conversa_ficha_vinculo FOR SELECT USING (true);
CREATE POLICY "Atendentes podem criar vinculos" ON conversa_ficha_vinculo FOR INSERT WITH CHECK (true);
CREATE POLICY "Atendentes podem atualizar vinculos" ON conversa_ficha_vinculo FOR UPDATE USING (true);
