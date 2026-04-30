ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS ficha_id text;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS cliente_telefone text;
CREATE INDEX IF NOT EXISTS idx_system_logs_ficha_id ON public.system_logs (ficha_id) WHERE ficha_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_logs_cliente_telefone ON public.system_logs (cliente_telefone) WHERE cliente_telefone IS NOT NULL;