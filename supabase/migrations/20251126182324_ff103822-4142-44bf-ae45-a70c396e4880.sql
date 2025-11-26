-- Remover constraint de foreign key entre orcamentos e fichas_de_servico
-- Isso permite que orçamentos sejam salvos mesmo quando a ficha ainda não existe
ALTER TABLE public.orcamentos 
DROP CONSTRAINT IF EXISTS orcamentos_ficha_id_fkey;