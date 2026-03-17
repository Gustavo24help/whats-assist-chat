-- Trigger: reativar conversa (fechada → aberta) ao inserir nova mensagem
CREATE OR REPLACE FUNCTION public.reactivate_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE clientes
  SET status_conversa = 'aberta'
  WHERE telefone = NEW.cliente_id
    AND status_conversa = 'fechada';
  RETURN NEW;
END;
$$;

CREATE TRIGGER reactivate_conversation_on_new_message
AFTER INSERT ON public.mensagens
FOR EACH ROW
EXECUTE FUNCTION public.reactivate_conversation_on_message();