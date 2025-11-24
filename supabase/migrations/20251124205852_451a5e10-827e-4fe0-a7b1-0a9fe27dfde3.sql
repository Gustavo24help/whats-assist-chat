-- Adicionar campos para controle de formulário de orçamento
ALTER TABLE fichas_de_servico 
ADD COLUMN IF NOT EXISTS formulario_orcamento_ativo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS formulario_orcamento_data_primeiro_envio TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS formulario_orcamento_encerrado_em TIMESTAMP WITH TIME ZONE;

-- Criar função para verificar e encerrar formulários automaticamente
CREATE OR REPLACE FUNCTION check_and_close_orcamento_forms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Encerrar formulários que tiveram primeiro orçamento há mais de 2 horas
  UPDATE fichas_de_servico
  SET 
    formulario_orcamento_ativo = false,
    formulario_orcamento_encerrado_em = NOW()
  WHERE 
    formulario_orcamento_ativo = true 
    AND formulario_orcamento_data_primeiro_envio IS NOT NULL
    AND formulario_orcamento_data_primeiro_envio < NOW() - INTERVAL '2 hours'
    AND formulario_orcamento_encerrado_em IS NULL;
END;
$$;

-- Criar trigger para marcar data do primeiro orçamento
CREATE OR REPLACE FUNCTION mark_first_orcamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se é o primeiro orçamento desta ficha, marcar a data
  UPDATE fichas_de_servico
  SET formulario_orcamento_data_primeiro_envio = NOW()
  WHERE id = NEW.ficha_nome
    AND formulario_orcamento_data_primeiro_envio IS NULL;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS on_orcamento_created ON orcamentos;
CREATE TRIGGER on_orcamento_created
  AFTER INSERT ON orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION mark_first_orcamento();