
-- Trigger: auto-mark client as unread when a new message from client arrives
-- Only marks if bot was already turned off at least once (operator is handling)
CREATE OR REPLACE FUNCTION public.mark_client_unread_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only for client messages (not from operator/bot)
  IF NEW.remetente = 'cliente' THEN
    UPDATE clientes
    SET marcado_nao_lido = true
    WHERE telefone = NEW.cliente_id
      AND bot_ja_desligado_alguma_vez = true;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_client_message_mark_unread ON public.mensagens;

CREATE TRIGGER on_new_client_message_mark_unread
  AFTER INSERT ON public.mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_client_unread_on_new_message();
