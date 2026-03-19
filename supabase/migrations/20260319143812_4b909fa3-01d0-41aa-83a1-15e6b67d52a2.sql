CREATE OR REPLACE FUNCTION public.close_orcamento_on_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('Agendado', 'Orçamento Aprovado / Agendamento', 'Perdido')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.formulario_orcamento_ativo = true THEN
    NEW.formulario_orcamento_ativo := false;
    NEW.formulario_orcamento_encerrado_em := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trg_close_orcamento_on_status
  BEFORE UPDATE ON fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION close_orcamento_on_status();