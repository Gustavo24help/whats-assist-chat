
ALTER TABLE public.prestadores
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS conta text,
  ADD COLUMN IF NOT EXISTS taxa_visita_padrao numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS regiao_atuacao text;
