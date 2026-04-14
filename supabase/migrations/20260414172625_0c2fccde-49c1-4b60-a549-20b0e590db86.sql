
CREATE OR REPLACE FUNCTION public.trigger_auto_finalizacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  -- CASO 1: Status mudou PARA "Agendado" ou "Finalizado"
  IF NEW.status IN ('Agendado', 'Finalizado') AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
    
    IF NEW.pagamento_realizado = true THEN
      RAISE LOG '[trigger_auto_finalizacao] Ficha % já tem pagamento realizado, pulando', NEW.id;
      RETURN NEW;
    END IF;

    IF COALESCE(NEW.valor_total, 0) <= 0 THEN
      RAISE LOG '[trigger_auto_finalizacao] Ficha % sem valor total, pulando (retry quando valor for preenchido)', NEW.id;
      RETURN NEW;
    END IF;

    IF NEW.pagamento_link IS NOT NULL AND NEW.pagamento_link != '' THEN
      RAISE LOG '[trigger_auto_finalizacao] Ficha % já tem link de pagamento, pulando', NEW.id;
      RETURN NEW;
    END IF;

    SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO _anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

    IF _supabase_url IS NULL OR _anon_key IS NULL THEN
      RAISE LOG '[trigger_auto_finalizacao] Secrets não encontradas';
      RETURN NEW;
    END IF;

    RAISE LOG '[trigger_auto_finalizacao] Disparando para ficha % (status: %)', NEW.id, NEW.status;

    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/auto-finalizacao',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _anon_key),
      body := jsonb_build_object('ficha_id', NEW.id)
    );

    RETURN NEW;
  END IF;

  -- CASO 2: valor_total mudou em ficha Agendado/Finalizado SEM link ainda (retry)
  IF NEW.status IN ('Agendado', 'Finalizado')
     AND OLD.valor_total IS DISTINCT FROM NEW.valor_total
     AND COALESCE(NEW.valor_total, 0) > 0
     AND (NEW.pagamento_link IS NULL OR NEW.pagamento_link = '')
     AND NEW.pagamento_realizado IS NOT TRUE THEN

    SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO _anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

    IF _supabase_url IS NULL OR _anon_key IS NULL THEN
      RETURN NEW;
    END IF;

    RAISE LOG '[trigger_auto_finalizacao] RETRY: valor_total atualizado na ficha % (status: %, valor: %)', NEW.id, NEW.status, NEW.valor_total;

    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/auto-finalizacao',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _anon_key),
      body := jsonb_build_object('ficha_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$function$;
