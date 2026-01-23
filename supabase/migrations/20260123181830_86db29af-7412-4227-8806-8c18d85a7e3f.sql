-- Adicionar campos estruturados para nome, bairro e cidade na tabela fichas_de_servico
ALTER TABLE fichas_de_servico ADD COLUMN IF NOT EXISTS nome_cliente TEXT;
ALTER TABLE fichas_de_servico ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE fichas_de_servico ADD COLUMN IF NOT EXISTS cidade TEXT;

-- Adicionar campos bairro e cidade na tabela clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cidade TEXT;

-- Criar índices para otimizar consultas no relatório de bairros
CREATE INDEX IF NOT EXISTS idx_fichas_bairro ON fichas_de_servico(bairro);
CREATE INDEX IF NOT EXISTS idx_fichas_cidade ON fichas_de_servico(cidade);
CREATE INDEX IF NOT EXISTS idx_clientes_bairro ON clientes(bairro);
CREATE INDEX IF NOT EXISTS idx_clientes_cidade ON clientes(cidade);