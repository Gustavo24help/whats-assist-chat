-- Adicionar coluna recibo_url na tabela fichas_de_servico
ALTER TABLE public.fichas_de_servico 
ADD COLUMN recibo_url TEXT;