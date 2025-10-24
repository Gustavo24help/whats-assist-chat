-- Adicionar campo de mapeamento de variáveis na tabela whatsapp_templates
ALTER TABLE whatsapp_templates 
ADD COLUMN IF NOT EXISTS variable_mapping jsonb DEFAULT '[]'::jsonb;

-- Adicionar campo de ficha ativa na tabela clientes
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS ficha_ativa_id text;

-- Adicionar foreign key para ficha ativa (soft reference, não força integridade)
COMMENT ON COLUMN clientes.ficha_ativa_id IS 'ID da ficha de serviço atualmente ativa para este cliente';