-- 1) Trigger: ao mudar comparecimento_prestador, registra em prestador_historico
CREATE OR REPLACE FUNCTION public.track_comparecimento_prestador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prestador_cpf text;
BEGIN
  IF NEW.comparecimento_prestador IS DISTINCT FROM OLD.comparecimento_prestador
     AND NEW.comparecimento_prestador IS NOT NULL
     AND NEW.prestador_id IS NOT NULL THEN
    v_prestador_cpf := NEW.prestador_id;

    INSERT INTO public.prestador_historico (prestador_cpf, ficha_id, tipo_evento, descricao, criado_por, dados_extras)
    VALUES (
      v_prestador_cpf,
      NEW.id,
      'comparecimento',
      'Comparecimento marcado como "' || NEW.comparecimento_prestador || '" na ficha ' || COALESCE(NEW.nome_ficha, NEW.id),
      auth.uid(),
      jsonb_build_object(
        'comparecimento', NEW.comparecimento_prestador,
        'ficha_id', NEW.id,
        'nome_ficha', NEW.nome_ficha,
        'horario_agendamento', NEW.horario_agendamento,
        'data_evento', now()
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_comparecimento_prestador ON public.fichas_de_servico;
CREATE TRIGGER trg_track_comparecimento_prestador
AFTER UPDATE OF comparecimento_prestador ON public.fichas_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.track_comparecimento_prestador();

-- 2) Trigger: ao entrar em status-chave (Visita Técnica / Finalizado / Garantia / Retorno) registra evento no prestador
CREATE OR REPLACE FUNCTION public.track_marcos_servico_prestador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tipo_evento text;
  v_descricao text;
  v_data_evento timestamptz;
BEGIN
  IF NEW.prestador_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status::text = 'Visita Técnica' THEN
    v_tipo_evento := 'visita_tecnica';
    v_descricao := 'Visita Técnica iniciada na ficha ' || COALESCE(NEW.nome_ficha, NEW.id);
    v_data_evento := COALESCE(NEW.horario_visita_tecnica, now());
  ELSIF NEW.status::text = 'Finalizado' THEN
    v_tipo_evento := 'servico_executado';
    v_descricao := 'Serviço executado/finalizado na ficha ' || COALESCE(NEW.nome_ficha, NEW.id);
    v_data_evento := now();
  ELSIF NEW.status::text = 'Retorno' OR (NEW.tipo_agendamento = 'retorno' AND NEW.status::text = 'Agendado') THEN
    v_tipo_evento := 'retorno';
    v_descricao := 'Retorno registrado na ficha ' || COALESCE(NEW.nome_ficha, NEW.id);
    v_data_evento := COALESCE(NEW.data_retorno, now());
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.prestador_historico (prestador_cpf, ficha_id, tipo_evento, descricao, criado_por, dados_extras)
  VALUES (
    NEW.prestador_id,
    NEW.id,
    v_tipo_evento,
    v_descricao,
    auth.uid(),
    jsonb_build_object(
      'ficha_id', NEW.id,
      'nome_ficha', NEW.nome_ficha,
      'status', NEW.status,
      'data_evento', v_data_evento
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_marcos_servico_prestador ON public.fichas_de_servico;
CREATE TRIGGER trg_track_marcos_servico_prestador
AFTER UPDATE OF status ON public.fichas_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.track_marcos_servico_prestador();