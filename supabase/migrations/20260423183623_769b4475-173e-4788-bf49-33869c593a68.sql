CREATE OR REPLACE FUNCTION public.mark_client_unread_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.remetente = 'cliente' THEN
    UPDATE public.clientes
    SET marcado_nao_lido = true,
        ultima_mensagem_recebida = COALESCE(NEW.data_hora, now())
    WHERE telefone = NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_client_message_mark_unread ON public.mensagens;
CREATE TRIGGER on_new_client_message_mark_unread
AFTER INSERT ON public.mensagens
FOR EACH ROW
EXECUTE FUNCTION public.mark_client_unread_on_new_message();