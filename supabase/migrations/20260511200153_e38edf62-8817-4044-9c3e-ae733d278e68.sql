-- 1) Corrigir trigger de mensagens: o campo correto é tipo_remetente='atendente' (não remetente='operador')
CREATE OR REPLACE FUNCTION public.track_mensagem_enviada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo_remetente = 'atendente' AND NEW.enviado_por_id IS NOT NULL THEN
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
        'message_sid', NEW.message_sid,
        'operador_nome', NEW.operador_nome
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Novo: rastrear criação de fichas (quando há auth.uid disponível)
CREATE OR REPLACE FUNCTION public.track_ficha_criada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.user_internal_history (user_id, history_type, description, reference_id, created_by, metadata)
  VALUES (
    v_user_id,
    'ficha_criada',
    'Criou ficha ' || COALESCE(NEW.nome_ficha, NEW.id) || ' para ' || COALESCE(NEW.nome_cliente, NEW.telefone_cliente, 'cliente'),
    NEW.id,
    v_user_id,
    jsonb_build_object(
      'ficha_id', NEW.id,
      'nome_ficha', NEW.nome_ficha,
      'cliente_telefone', NEW.telefone_cliente,
      'nome_cliente', NEW.nome_cliente,
      'status_inicial', NEW.status,
      'categoria_id', NEW.categoria_id
    )
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_track_ficha_criada ON public.fichas_de_servico;
CREATE TRIGGER trigger_track_ficha_criada
AFTER INSERT ON public.fichas_de_servico
FOR EACH ROW EXECUTE FUNCTION public.track_ficha_criada();

-- 3) Novo: rastrear atribuição/troca de prestador
CREATE OR REPLACE FUNCTION public.track_prestador_atribuido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_nome_novo text;
  v_nome_old text;
BEGIN
  IF v_user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.prestador_id IS NOT DISTINCT FROM OLD.prestador_id THEN RETURN NEW; END IF;

  IF NEW.prestador_id IS NOT NULL THEN
    SELECT nome INTO v_nome_novo FROM public.prestadores WHERE cpf = NEW.prestador_id LIMIT 1;
  END IF;
  IF OLD.prestador_id IS NOT NULL THEN
    SELECT nome INTO v_nome_old FROM public.prestadores WHERE cpf = OLD.prestador_id LIMIT 1;
  END IF;

  INSERT INTO public.user_internal_history (user_id, history_type, description, reference_id, created_by, metadata)
  VALUES (
    v_user_id,
    'prestador_atribuido',
    CASE
      WHEN OLD.prestador_id IS NULL THEN 'Atribuiu prestador ' || COALESCE(v_nome_novo, NEW.prestador_id) || ' à ficha ' || COALESCE(NEW.nome_ficha, NEW.id)
      WHEN NEW.prestador_id IS NULL THEN 'Removeu prestador ' || COALESCE(v_nome_old, OLD.prestador_id) || ' da ficha ' || COALESCE(NEW.nome_ficha, NEW.id)
      ELSE 'Trocou prestador na ficha ' || COALESCE(NEW.nome_ficha, NEW.id) || ': ' || COALESCE(v_nome_old, OLD.prestador_id) || ' → ' || COALESCE(v_nome_novo, NEW.prestador_id)
    END,
    NEW.id,
    v_user_id,
    jsonb_build_object(
      'ficha_id', NEW.id,
      'nome_ficha', NEW.nome_ficha,
      'prestador_anterior', OLD.prestador_id,
      'prestador_anterior_nome', v_nome_old,
      'prestador_novo', NEW.prestador_id,
      'prestador_novo_nome', v_nome_novo
    )
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_track_prestador_atribuido ON public.fichas_de_servico;
CREATE TRIGGER trigger_track_prestador_atribuido
AFTER UPDATE ON public.fichas_de_servico
FOR EACH ROW EXECUTE FUNCTION public.track_prestador_atribuido();

-- 4) Novo: rastrear mudança de horário/agendamento
CREATE OR REPLACE FUNCTION public.track_agendamento_alterado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.horario_agendamento IS NOT DISTINCT FROM OLD.horario_agendamento THEN RETURN NEW; END IF;

  INSERT INTO public.user_internal_history (user_id, history_type, description, reference_id, created_by, metadata)
  VALUES (
    v_user_id,
    'agendamento_alterado',
    CASE
      WHEN OLD.horario_agendamento IS NULL THEN 'Definiu agendamento da ficha ' || COALESCE(NEW.nome_ficha, NEW.id) || ' para ' || to_char(NEW.horario_agendamento AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
      WHEN NEW.horario_agendamento IS NULL THEN 'Removeu agendamento da ficha ' || COALESCE(NEW.nome_ficha, NEW.id)
      ELSE 'Alterou agendamento da ficha ' || COALESCE(NEW.nome_ficha, NEW.id) || ': ' || to_char(OLD.horario_agendamento AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' → ' || to_char(NEW.horario_agendamento AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
    END,
    NEW.id,
    v_user_id,
    jsonb_build_object(
      'ficha_id', NEW.id,
      'nome_ficha', NEW.nome_ficha,
      'horario_anterior', OLD.horario_agendamento,
      'horario_novo', NEW.horario_agendamento,
      'tipo_agendamento', NEW.tipo_agendamento
    )
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_track_agendamento_alterado ON public.fichas_de_servico;
CREATE TRIGGER trigger_track_agendamento_alterado
AFTER UPDATE ON public.fichas_de_servico
FOR EACH ROW EXECUTE FUNCTION public.track_agendamento_alterado();
