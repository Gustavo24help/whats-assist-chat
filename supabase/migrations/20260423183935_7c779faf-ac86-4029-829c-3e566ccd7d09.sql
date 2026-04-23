ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS marcado_nao_lido_manual_em timestamptz;