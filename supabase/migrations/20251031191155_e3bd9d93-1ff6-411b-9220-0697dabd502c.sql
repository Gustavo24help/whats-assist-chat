-- Alterar o default do campo pagamento_gerar_link para true
ALTER TABLE public.fichas_de_servico 
ALTER COLUMN pagamento_gerar_link SET DEFAULT true;

-- Atualizar fichas existentes que tenham pagamento_gerar_link como false ou null
UPDATE public.fichas_de_servico 
SET pagamento_gerar_link = true 
WHERE pagamento_gerar_link IS NULL OR pagamento_gerar_link = false;