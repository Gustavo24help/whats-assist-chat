-- Índices para tabela mensagens (CRÍTICO - maior impacto na performance)
CREATE INDEX IF NOT EXISTS idx_mensagens_cliente_id ON mensagens (cliente_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_cliente_data ON mensagens (cliente_id, data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_remetente ON mensagens (remetente, cliente_id);

-- Índices para tabela fichas_de_servico
CREATE INDEX IF NOT EXISTS idx_fichas_telefone_cliente ON fichas_de_servico (telefone_cliente);
CREATE INDEX IF NOT EXISTS idx_fichas_status ON fichas_de_servico (status);

-- Índice para orçamentos por ficha
CREATE INDEX IF NOT EXISTS idx_orcamentos_ficha ON orcamentos (ficha_nome);