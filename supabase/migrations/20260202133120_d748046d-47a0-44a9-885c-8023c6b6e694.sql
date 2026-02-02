-- Adicionar coluna de controle para webhook pendente
ALTER TABLE fichas_de_servico 
ADD COLUMN IF NOT EXISTS webhook_pendente BOOLEAN DEFAULT false;

-- Comentário para documentação
COMMENT ON COLUMN fichas_de_servico.webhook_pendente IS 'True se o webhook de criação ainda não foi enviado/confirmado com sucesso';