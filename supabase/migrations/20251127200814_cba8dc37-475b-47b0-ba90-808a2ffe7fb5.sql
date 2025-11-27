-- Adicionar coluna data_version para versionamento de formato de dados
ALTER TABLE fichas_de_servico 
ADD COLUMN IF NOT EXISTS data_version integer DEFAULT 1;

-- Marcar registros existentes como versão 1 (formato antigo - já corrigido manualmente)
UPDATE fichas_de_servico SET data_version = 1 WHERE data_version IS NULL;

-- Comentário explicativo
COMMENT ON COLUMN fichas_de_servico.data_version IS 
'Versão do formato de dados: 1=formato antigo (datetime sem conversão timezone), 2=formato novo (datetime com timezone UTC-3)';