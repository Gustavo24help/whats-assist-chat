
ALTER TABLE public.ficha_status_historico
  ADD COLUMN IF NOT EXISTS alterado_por uuid,
  ADD COLUMN IF NOT EXISTS alterado_por_nome text;

CREATE OR REPLACE FUNCTION public.registrar_mudanca_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.ficha_status_historico
    SET data_fim = now()
    WHERE ficha_id = NEW.id
      AND data_fim IS NULL;

    IF v_uid IS NOT NULL THEN
      SELECT full_name INTO v_nome FROM public.profiles WHERE id = v_uid;
    END IF;

    INSERT INTO public.ficha_status_historico
      (ficha_id, status_anterior, status_novo, data_inicio, alterado_por, alterado_por_nome)
    VALUES
      (NEW.id, OLD.status, NEW.status, now(), v_uid, v_nome);
  END IF;

  RETURN NEW;
END;
$function$;
