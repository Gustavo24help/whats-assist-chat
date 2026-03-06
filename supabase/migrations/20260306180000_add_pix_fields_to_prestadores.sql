ALTER TABLE public.prestadores
ADD COLUMN IF NOT EXISTS nome_pix TEXT,
ADD COLUMN IF NOT EXISTS chave_pix TEXT,
ADD COLUMN IF NOT EXISTS pix_ativo BOOLEAN NOT NULL DEFAULT true;

UPDATE public.prestadores
SET pix_ativo = true
WHERE pix_ativo IS NULL;
