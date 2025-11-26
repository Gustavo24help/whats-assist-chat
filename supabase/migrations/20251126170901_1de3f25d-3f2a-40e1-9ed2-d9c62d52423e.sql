-- Adicionar colunas para horário sugerido na tabela orcamentos
ALTER TABLE public.orcamentos 
ADD COLUMN pode_horario boolean,
ADD COLUMN horario_sugerido timestamp with time zone;