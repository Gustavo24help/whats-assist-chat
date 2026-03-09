
-- Add metadata column to user_internal_history for rich details
ALTER TABLE public.user_internal_history ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 1. Trigger: operator sends a message
CREATE OR REPLACE FUNCTION public.track_mensagem_enviada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.remetente = 'operador' AND NEW.enviado_por_id IS NOT NULL THEN
    INSERT INTO public.user_internal_history (user_id, history_type, description, reference_id, created_by, metadata)
    VALUES (
      NEW.enviado_por_id,
      'mensagem_enviada',
      'Mensagem enviada para cliente ' || NEW.cliente_id,
      NEW.id::text,
      NEW.enviado_por_id,
      jsonb_build_object(
        'cliente_id', NEW.cliente_id,
        'ficha_id', NEW.ficha_id,
        'tipo', NEW.tipo,
        'message_sid', NEW.message_sid
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_track_mensagem_enviada
  AFTER INSERT ON public.mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.track_mensagem_enviada();

-- 2. Trigger: chat assumed (atendente_id changes on clientes)
CREATE OR REPLACE FUNCTION public.track_chat_assumido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Status conversa changed to fechado
  IF NEW.status_conversa IS DISTINCT FROM OLD.status_conversa AND NEW.status_conversa = 'fechado' AND OLD.atendente_id IS NOT NULL THEN
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
$$;

CREATE TRIGGER trigger_track_chat_assumido
  AFTER UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.track_chat_assumido();

-- 3. Trigger: ficha status change
CREATE OR REPLACE FUNCTION public.track_ficha_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.user_internal_history (user_id, history_type, description, reference_id, created_by, metadata)
    VALUES (
      v_user_id,
      'ficha_status',
      'Alterou ficha ' || NEW.id || ' de "' || COALESCE(OLD.status::text, 'null') || '" para "' || COALESCE(NEW.status::text, 'null') || '"',
      NEW.id,
      v_user_id,
      jsonb_build_object(
        'ficha_id', NEW.id,
        'status_anterior', OLD.status,
        'status_novo', NEW.status,
        'nome_ficha', NEW.nome_ficha,
        'cliente_telefone', NEW.telefone_cliente,
        'prestador_id', NEW.prestador_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_track_ficha_status_change
  AFTER UPDATE ON public.fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.track_ficha_status_change();

-- 4. Trigger: transação financeira criada
CREATE OR REPLACE FUNCTION public.track_transacao_criada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.criado_por IS NOT NULL THEN
    INSERT INTO public.user_internal_history (user_id, history_type, description, reference_id, created_by, metadata)
    VALUES (
      NEW.criado_por,
      'transacao_criada',
      'Criou transação financeira para ficha ' || NEW.ficha_id || ' - Prestador: ' || NEW.prestador_nome || ' - Valor: R$ ' || ROUND(NEW.valor_cliente_final, 2),
      NEW.ficha_id,
      NEW.criado_por,
      jsonb_build_object(
        'ficha_id', NEW.ficha_id,
        'prestador_nome', NEW.prestador_nome,
        'valor_cliente', NEW.valor_cliente_final,
        'valor_prestador', NEW.valor_a_pagar_prestador,
        'lucro', NEW.valor_lucro_bruto,
        'categoria', NEW.categoria
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_track_transacao_criada
  AFTER INSERT ON public.transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.track_transacao_criada();

-- 5. Trigger: pagamento status change
CREATE OR REPLACE FUNCTION public.track_pagamento_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_desc text := '';
BEGIN
  v_user_id := COALESCE(NEW.atualizado_por, auth.uid());
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  IF OLD.status_pagamento_cliente IS DISTINCT FROM NEW.status_pagamento_cliente THEN
    v_desc := 'Status pgto cliente: ' || OLD.status_pagamento_cliente || ' → ' || NEW.status_pagamento_cliente;
  END IF;
  IF OLD.status_pagamento_prestador IS DISTINCT FROM NEW.status_pagamento_prestador THEN
    IF v_desc <> '' THEN v_desc := v_desc || ' | '; END IF;
    v_desc := v_desc || 'Status pgto prestador: ' || OLD.status_pagamento_prestador || ' → ' || NEW.status_pagamento_prestador;
  END IF;

  IF v_desc = '' THEN RETURN NEW; END IF;

  INSERT INTO public.user_internal_history (user_id, history_type, description, reference_id, created_by, metadata)
  VALUES (
    v_user_id,
    'pagamento_atualizado',
    'Ficha ' || NEW.ficha_id || ' - ' || v_desc,
    NEW.ficha_id,
    v_user_id,
    jsonb_build_object(
      'ficha_id', NEW.ficha_id,
      'prestador_nome', NEW.prestador_nome,
      'status_cliente_anterior', OLD.status_pagamento_cliente,
      'status_cliente_novo', NEW.status_pagamento_cliente,
      'status_prestador_anterior', OLD.status_pagamento_prestador,
      'status_prestador_novo', NEW.status_pagamento_prestador
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_track_pagamento_status
  AFTER UPDATE ON public.transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.track_pagamento_status();

-- 6. Trigger: bot toggled
CREATE OR REPLACE FUNCTION public.track_bot_toggle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.executado_por_id IS NOT NULL THEN
    INSERT INTO public.user_internal_history (user_id, history_type, description, reference_id, created_by, metadata)
    VALUES (
      NEW.executado_por_id,
      'bot_toggle',
      NEW.acao || ' bot para ' || NEW.telefone_cliente || COALESCE(' (origem: ' || NEW.origem || ')', ''),
      NEW.ficha_id,
      NEW.executado_por_id,
      jsonb_build_object(
        'telefone_cliente', NEW.telefone_cliente,
        'acao', NEW.acao,
        'origem', NEW.origem,
        'ficha_id', NEW.ficha_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_track_bot_toggle
  AFTER INSERT ON public.bot_historico
  FOR EACH ROW
  EXECUTE FUNCTION public.track_bot_toggle();
