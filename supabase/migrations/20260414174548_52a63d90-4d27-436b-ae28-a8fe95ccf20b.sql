
-- Criar a trigger que estava faltando
CREATE TRIGGER trigger_auto_finalizacao_on_update
  BEFORE UPDATE ON public.fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_finalizacao();
