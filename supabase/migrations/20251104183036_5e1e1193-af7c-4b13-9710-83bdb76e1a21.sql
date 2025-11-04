-- Adicionar coluna para marcar conversa como não lida
ALTER TABLE clientes 
ADD COLUMN marcado_nao_lido boolean DEFAULT false;