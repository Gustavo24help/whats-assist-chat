ALTER TABLE public.prestadores
ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

UPDATE public.prestadores
SET ativo = true
WHERE ativo IS NULL;
