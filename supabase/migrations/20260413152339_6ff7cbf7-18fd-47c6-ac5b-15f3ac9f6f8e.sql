
-- 1. Trigger to notify previous operator when their conversation is taken over
CREATE OR REPLACE FUNCTION public.notify_chat_takeover()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_operator_name text;
  _ficha_id text;
  _ficha_nome text;
BEGIN
  -- Only fire when atendente_id changes and previous atendente existed
  IF OLD.atendente_id IS NOT NULL 
     AND NEW.atendente_id IS NOT NULL 
     AND OLD.atendente_id IS DISTINCT FROM NEW.atendente_id THEN
    
    -- Get new operator name
    SELECT COALESCE(full_name, 'Operador') INTO _new_operator_name
    FROM profiles WHERE id = NEW.atendente_id;
    
    -- Get active ficha info
    SELECT id, COALESCE(nome_ficha, id) INTO _ficha_id, _ficha_nome
    FROM fichas_de_servico WHERE telefone_cliente = NEW.telefone
    ORDER BY created_at DESC LIMIT 1;
    
    -- Notify the PREVIOUS operator
    INSERT INTO notificacoes (usuario_destino, tipo, referencia_id, titulo, descricao)
    VALUES (
      OLD.atendente_id,
      'chat_assumido',
      NEW.telefone,
      '🔄 Conversa assumida',
      _new_operator_name || ' assumiu a conversa de ' || NEW.nome || 
      CASE WHEN _ficha_nome IS NOT NULL THEN ' (Ficha: ' || _ficha_nome || ')' ELSE '' END
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_notify_chat_takeover ON public.clientes;
CREATE TRIGGER trigger_notify_chat_takeover
  AFTER UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_takeover();
