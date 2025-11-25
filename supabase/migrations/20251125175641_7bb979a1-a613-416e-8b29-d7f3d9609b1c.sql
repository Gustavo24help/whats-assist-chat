-- Adicionar coluna preferencia_horario_cliente na tabela fichas_de_servico
ALTER TABLE public.fichas_de_servico 
ADD COLUMN IF NOT EXISTS preferencia_horario_cliente TEXT;