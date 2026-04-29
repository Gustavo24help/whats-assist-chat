-- 1) Atualizar trigger notify_chat_takeover para respeitar flag de "redistribuição silenciosa"
CREATE OR REPLACE FUNCTION public.notify_chat_takeover()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _new_operator_name text;
  _assigner_name text;
  _assigner_id uuid;
  _ficha_id text;
  _ficha_nome text;
  _skip_notif text;
BEGIN
  -- Only fire when atendente_id changes
  IF NEW.atendente_id IS NOT NULL 
     AND OLD.atendente_id IS DISTINCT FROM NEW.atendente_id THEN

    -- Se a sessão sinalizou redistribuição em massa, não emitir notificações.
    -- A flag é local à transação (set_config(..., true)).
    BEGIN
      _skip_notif := current_setting('app.skip_takeover_notif', true);
    EXCEPTION WHEN OTHERS THEN
      _skip_notif := NULL;
    END;

    IF _skip_notif = 'true' THEN
      RETURN NEW;
    END IF;
    
    _assigner_id := auth.uid();
    
    -- Get new operator name
    SELECT COALESCE(full_name, 'Operador') INTO _new_operator_name
    FROM profiles WHERE id = NEW.atendente_id;
    
    -- Get active ficha info
    SELECT id, COALESCE(nome_ficha, id) INTO _ficha_id, _ficha_nome
    FROM fichas_de_servico WHERE telefone_cliente = NEW.telefone
    ORDER BY created_at DESC LIMIT 1;
    
    -- 1) Notify the PREVIOUS operator (existing behavior)
    IF OLD.atendente_id IS NOT NULL THEN
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
    
    -- 2) Notify the NEW operator if assigned BY someone else
    IF _assigner_id IS NOT NULL AND _assigner_id IS DISTINCT FROM NEW.atendente_id THEN
      SELECT COALESCE(full_name, 'Alguém') INTO _assigner_name
      FROM profiles WHERE id = _assigner_id;
      
      INSERT INTO notificacoes (usuario_destino, tipo, referencia_id, titulo, descricao)
      VALUES (
        NEW.atendente_id,
        'chat_atribuido',
        NEW.telefone,
        '📌 Conversa atribuída a você',
        _assigner_name || ' atribuiu você à conversa de ' || NEW.nome || 
        CASE WHEN _ficha_nome IS NOT NULL THEN ' (Ficha: ' || _ficha_nome || ')' ELSE '' END
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2) RPC para redistribuir chats em massa SEM disparar notificações
-- Recebe lista de telefones e o novo atendente; usa SET LOCAL para que o trigger
-- veja a flag dentro da MESMA transação.
CREATE OR REPLACE FUNCTION public.redistribute_chats_silent(
  _telefones text[],
  _target_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer;
BEGIN
  -- Flag local à transação - trigger lê isso e pula notificações
  PERFORM set_config('app.skip_takeover_notif', 'true', true);

  UPDATE public.clientes
  SET atendente_id = _target_user_id
  WHERE telefone = ANY(_telefones);

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- Permitir execução para usuários autenticados (e anon, pois RLS é aberta nas tabelas operacionais)
GRANT EXECUTE ON FUNCTION public.redistribute_chats_silent(text[], uuid) TO authenticated, anon;