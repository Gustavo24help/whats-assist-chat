ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS transcricao_texto text;
ALTER TABLE public.mensagens_prestadores ADD COLUMN IF NOT EXISTS transcricao_texto text;