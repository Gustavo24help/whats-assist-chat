-- Adicionar coluna arquivado na tabela clientes
ALTER TABLE clientes 
ADD COLUMN arquivado boolean NOT NULL DEFAULT false;

-- Criar índice para melhorar performance de filtros
CREATE INDEX idx_clientes_arquivado ON clientes(arquivado);