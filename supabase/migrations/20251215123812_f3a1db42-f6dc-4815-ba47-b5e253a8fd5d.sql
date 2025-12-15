-- Add payment control fields to fichas_de_servico
ALTER TABLE public.fichas_de_servico
ADD COLUMN IF NOT EXISTS pagamento_link TEXT NULL,
ADD COLUMN IF NOT EXISTS pagamento_realizado BOOLEAN DEFAULT false;