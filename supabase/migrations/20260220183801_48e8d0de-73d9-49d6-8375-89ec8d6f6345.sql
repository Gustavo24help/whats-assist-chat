
-- Tabela de Metas do Dashboard
CREATE TABLE public.dashboard_metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL DEFAULT 'diarias' CHECK (tipo IN ('diarias', 'mensais')),
  
  -- Metas Financeiras
  valor_os NUMERIC(10,2) DEFAULT 0,
  lucro_bruto NUMERIC(10,2) DEFAULT 0,
  ticket_medio NUMERIC(10,2) DEFAULT 0,
  
  -- Metas de Quantidade
  quantidade_servicos INTEGER DEFAULT 0,
  quantidade_fs INTEGER DEFAULT 0,
  quantidade_agendados INTEGER DEFAULT 0,
  
  -- Metas de Conversão (%)
  taxa_fs_agendado NUMERIC(5,2) DEFAULT 0,
  taxa_agendado_pago NUMERIC(5,2) DEFAULT 0,
  taxa_conversao_total NUMERIC(5,2) DEFAULT 0,
  
  -- Metas de Tempo (minutos)
  tempo_resposta_max INTEGER DEFAULT 60,
  tempo_orcamento_max INTEGER DEFAULT 120,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Apenas um registro por tipo
  UNIQUE(tipo)
);

-- Enable RLS
ALTER TABLE public.dashboard_metas ENABLE ROW LEVEL SECURITY;

-- Policies - apenas admins e supervisores podem gerenciar metas
CREATE POLICY "Admins e supervisores podem ver metas"
  ON public.dashboard_metas FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admins podem inserir metas"
  ON public.dashboard_metas FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar metas"
  ON public.dashboard_metas FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_dashboard_metas_updated_at
  BEFORE UPDATE ON public.dashboard_metas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default values
INSERT INTO public.dashboard_metas (tipo, valor_os, lucro_bruto, ticket_medio, quantidade_servicos, quantidade_fs, quantidade_agendados, taxa_fs_agendado, taxa_agendado_pago, taxa_conversao_total, tempo_resposta_max, tempo_orcamento_max)
VALUES 
  ('diarias', 16200, 5000, 400, 40, 200, 50, 25, 85, 10, 60, 120),
  ('mensais', 486000, 150000, 400, 1200, 6000, 1500, 25, 85, 10, 60, 120);
