-- Adicionar coluna para atendente atribuído
ALTER TABLE clientes 
ADD COLUMN atendente_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Adicionar coluna para notas internas
ALTER TABLE clientes 
ADD COLUMN notas_internas TEXT;

-- Índice para performance
CREATE INDEX idx_clientes_atendente ON clientes(atendente_id);