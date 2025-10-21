-- Garantir que data_criacao tem valor padrão automático
ALTER TABLE public.orcamentos 
ALTER COLUMN data_criacao SET DEFAULT now();