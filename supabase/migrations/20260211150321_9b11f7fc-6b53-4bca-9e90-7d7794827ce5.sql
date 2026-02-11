
-- Adicionar colunas de controle de lock na tabela twilio_sync_control
ALTER TABLE public.twilio_sync_control 
ADD COLUMN IF NOT EXISTS sync_in_progress boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sync_started_at timestamptz;
