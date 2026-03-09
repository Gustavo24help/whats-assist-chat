CREATE OR REPLACE FUNCTION public.track_chat_assumido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Chat assumed
  IF NEW.atendente_id IS NOT NULL AND (OLD.atendente_id IS NULL OR OLD.atendente_id IS DISTINCT FROM NEW.atendente_id) THEN
    INSERT INTO public.user_internal_history (user_id, history_type, description, reference_id, created_by, metadata)
    VALUES (
      NEW.atendente_id,
      'chat_assumido',
      'Assumiu chat do cliente ' || NEW.nome || ' (' || NEW.telefone || ')',
      NEW.telefone,
      NEW.atendente_id,
      jsonb_build_object(
        'cliente_nome', NEW.nome,
        'cliente_telefone', NEW.telefone,
        'atendente_anterior', OLD.atendente_id
      )
    );
  END IF;

  -- Status conversa changed to fechada
  IF NEW.status_conversa IS DISTINCT FROM OLD.status_conversa AND NEW.status_conversa = 'fechada' AND OLD.atendente_id IS NOT NULL THEN
    INSERT INTO public.user_internal_history (user_id, history_type, description, reference_id, created_by, metadata)
    VALUES (
      COALESCE(NEW.atendente_id, OLD.atendente_id),
      'chat_fechado',
      'Fechou chat do cliente ' || NEW.nome || ' (' || NEW.telefone || ')',
      NEW.telefone,
      COALESCE(NEW.atendente_id, OLD.atendente_id),
      jsonb_build_object(
        'cliente_nome', NEW.nome,
        'cliente_telefone', NEW.telefone
      )
    );
  END IF;

  RETURN NEW;
END;
$function$