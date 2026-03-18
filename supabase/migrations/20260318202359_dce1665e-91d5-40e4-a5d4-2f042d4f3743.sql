
-- Add 'chefe' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'chefe';

-- Add pagamento_visto_por_chefe field to fichas_de_servico
ALTER TABLE public.fichas_de_servico 
ADD COLUMN IF NOT EXISTS pagamento_visto_por_chefe boolean DEFAULT false;
