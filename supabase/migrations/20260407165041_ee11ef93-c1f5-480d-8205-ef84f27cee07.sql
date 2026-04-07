
-- 1. Add ultima_mensagem_recebida to clientes
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS ultima_mensagem_recebida TIMESTAMPTZ;

-- 2. Create contas_receber table
CREATE TABLE contas_receber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id TEXT REFERENCES fichas_de_servico(id),
  cliente_telefone TEXT NOT NULL,
  cliente_nome TEXT,
  prestador_nome TEXT,
  valor_total NUMERIC DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  status TEXT DEFAULT 'aguardando',
  pagamento_link TEXT,
  asaas_id TEXT,
  asaas_status TEXT,
  requer_template BOOLEAN DEFAULT false,
  link_enviado_em TIMESTAMPTZ,
  link_reenvio_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage contas_receber"
  ON contas_receber FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Create whatsapp_envios_rastreamento table
CREATE TABLE whatsapp_envios_rastreamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_telefone TEXT,
  conta_receber_id UUID REFERENCES contas_receber(id),
  ficha_id TEXT,
  tipo_envio TEXT,
  template_sid TEXT,
  status TEXT DEFAULT 'enviado',
  criado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_envios_rastreamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage envios"
  ON whatsapp_envios_rastreamento FOR ALL TO authenticated USING (true) WITH CHECK (true);
