
-- Add ativo, nome_pix, chave_pix columns to prestadores table
-- ativo = whether the prestador is active (default true, preserving existing data)
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS nome_pix text DEFAULT NULL;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS chave_pix text DEFAULT NULL;
