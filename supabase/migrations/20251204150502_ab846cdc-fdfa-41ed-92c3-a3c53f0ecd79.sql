-- Adicionar coluna para rastrear se o bot já foi desligado alguma vez
ALTER TABLE clientes 
ADD COLUMN bot_ja_desligado_alguma_vez boolean DEFAULT false;

-- Marcar TODOS os clientes existentes como já tendo tido o bot desligado
UPDATE clientes 
SET bot_ja_desligado_alguma_vez = true;