-- Função trigger BEFORE INSERT que captura duplicatas vindas de integrações externas (Make/US2)
CREATE OR REPLACE FUNCTION public.handle_ficha_duplicate_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.fichas_de_servico%ROWTYPE;
BEGIN
  -- Se já existe ficha com este id, tratamos como evento de automação duplicada
  SELECT * INTO v_existing
  FROM public.fichas_de_servico
  WHERE id = NEW.id;

  IF NOT FOUND THEN
    RETURN NEW; -- segue insert normal
  END IF;

  -- 1) Log de auditoria (warn / automation) — não pode quebrar o trigger
  BEGIN
    INSERT INTO public.system_logs (nivel, categoria, mensagem, detalhes, url)
    VALUES (
      'warn',
      'automation',
      'Tentativa de INSERT duplicado em fichas_de_servico: ' || NEW.id,
      jsonb_build_object(
        'ficha_id', NEW.id,
        'origem_provavel', 'make_us2',
        'payload_recebido', to_jsonb(NEW),
        'ficha_existente_resumida', jsonb_build_object(
          'id', v_existing.id,
          'status', v_existing.status,
          'id_zoho', v_existing.id_zoho,
          'telefone_cliente', v_existing.telefone_cliente,
          'created_at', v_existing.created_at
        )
      ),
      'trigger://handle_ficha_duplicate_insert'
    );
  EXCEPTION WHEN OTHERS THEN
    -- nunca falhar por causa do log
    NULL;
  END;

  -- 2) Merge silencioso: só preenche campos hoje VAZIOS na ficha existente
  --    (jamais sobrescreve dados operacionais já preenchidos)
  UPDATE public.fichas_de_servico f
  SET
    id_zoho = COALESCE(f.id_zoho, NEW.id_zoho),
    descricao = CASE
      WHEN (f.descricao IS NULL OR f.descricao = '') THEN NEW.descricao
      ELSE f.descricao
    END,
    categoria_id = COALESCE(f.categoria_id, NEW.categoria_id),
    telefone_cliente = COALESCE(f.telefone_cliente, NEW.telefone_cliente),
    nome_cliente = CASE
      WHEN (f.nome_cliente IS NULL OR f.nome_cliente = '') THEN NEW.nome_cliente
      ELSE f.nome_cliente
    END,
    preferencia_horario_cliente = CASE
      WHEN (f.preferencia_horario_cliente IS NULL OR f.preferencia_horario_cliente = '')
        THEN NEW.preferencia_horario_cliente
      ELSE f.preferencia_horario_cliente
    END
  WHERE f.id = NEW.id;

  -- 3) Aborta o INSERT sem gerar erro 409
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_ficha_duplicate_insert ON public.fichas_de_servico;

CREATE TRIGGER trg_handle_ficha_duplicate_insert
BEFORE INSERT ON public.fichas_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.handle_ficha_duplicate_insert();