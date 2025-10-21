-- Remover qualquer constraint que impeça inserção manual de orçamentos
-- Garantir que apenas ficha_nome e prestador_cpf são obrigatórios
ALTER TABLE orcamentos 
  ALTER COLUMN valor_total DROP NOT NULL,
  ALTER COLUMN valor_mao_obra DROP NOT NULL,
  ALTER COLUMN valor_pecas DROP NOT NULL,
  ALTER COLUMN observacoes DROP NOT NULL,
  ALTER COLUMN categoria DROP NOT NULL;

-- Garantir que data_criacao tem default automático
ALTER TABLE orcamentos 
  ALTER COLUMN data_criacao SET DEFAULT now();

-- Adicionar suporte a vídeo e áudio no tipo de mensagem
ALTER TYPE tipo_mensagem_enum ADD VALUE IF NOT EXISTS 'imagem';
ALTER TYPE tipo_mensagem_enum ADD VALUE IF NOT EXISTS 'video';
ALTER TYPE tipo_mensagem_enum ADD VALUE IF NOT EXISTS 'audio';