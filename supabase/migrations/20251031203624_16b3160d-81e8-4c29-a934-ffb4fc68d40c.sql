-- Alterar o default do campo status para 'Ficha Criada'
ALTER TABLE public.fichas_de_servico 
ALTER COLUMN status SET DEFAULT 'Ficha Criada'::status_ficha_enum;