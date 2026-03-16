-- Trigger: ao criar uma nova ficha de serviço, atualizar ficha_ativa_id do cliente
CREATE OR REPLACE FUNCTION public.update_ficha_ativa_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE clientes
  SET ficha_ativa_id = NEW.id
  WHERE telefone = NEW.telefone_cliente;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_ficha_ativa_on_insert
  AFTER INSERT ON public.fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ficha_ativa_on_insert();