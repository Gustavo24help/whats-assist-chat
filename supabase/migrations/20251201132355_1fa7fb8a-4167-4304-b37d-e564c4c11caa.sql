-- Adicionar coluna para identificar quando o bot foi desligado manualmente
ALTER TABLE public.clientes 
ADD COLUMN bot_desligado_manualmente boolean DEFAULT false;

-- Atualizar registros existentes onde o bot está desabilitado para marcar como manual
-- (assumindo que todos os que estão desabilitados agora foram feitos manualmente)
UPDATE public.clientes 
SET bot_desligado_manualmente = true 
WHERE bot_habilitado = false;