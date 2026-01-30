-- Tabela para armazenar métricas do Google Ads (sincronizadas via Make.com)
CREATE TABLE public.google_ads_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia DATE NOT NULL,
  impressoes INTEGER DEFAULT 0,
  cliques INTEGER DEFAULT 0,
  conversoes INTEGER DEFAULT 0,
  custo DECIMAL(10,2) DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0,
  cpa DECIMAL(10,2) DEFAULT 0,
  campanha TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(data_referencia, campanha)
);

-- Habilitar RLS
ALTER TABLE public.google_ads_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Admins e Supervisores podem visualizar
CREATE POLICY "Admins e supervisores podem ver métricas" 
ON public.google_ads_metrics 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- Policy: Sistema pode inserir (via Edge Function com service_role)
CREATE POLICY "Sistema pode inserir métricas" 
ON public.google_ads_metrics 
FOR INSERT 
WITH CHECK (true);

-- Policy: Sistema pode atualizar (para upsert)
CREATE POLICY "Sistema pode atualizar métricas" 
ON public.google_ads_metrics 
FOR UPDATE 
USING (true);

-- Índice para consultas por período
CREATE INDEX idx_google_ads_metrics_data ON public.google_ads_metrics(data_referencia DESC);

-- Trigger para updated_at
CREATE TRIGGER update_google_ads_metrics_updated_at
BEFORE UPDATE ON public.google_ads_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();