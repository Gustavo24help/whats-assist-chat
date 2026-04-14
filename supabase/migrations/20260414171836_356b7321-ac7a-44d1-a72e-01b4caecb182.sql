
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
  -- Dispara quando status muda PARA "Agendado" ou "Finalizado"
  IF NEW.status IN ('Agendado', 'Finalizado') AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
    
    -- Pular se pagamento já realizado
    IF NEW.pagamento_realizado = true THEN
      RAISE LOG '[trigger_auto_finalizacao] Ficha % já tem pagamento realizado, pulando', NEW.id;
      RETURN NEW;
    END IF;

    -- Pular se valor total é 0 ou nulo
    IF COALESCE(NEW.valor_total, 0) <= 0 THEN
      RAISE LOG '[trigger_auto_finalizacao] Ficha % sem valor total, pulando', NEW.id;
      RETURN NEW;
    END IF;

    -- Pular se link já foi enviado (evita reenvio ao mudar Agendado→Finalizado)
    IF NEW.pagamento_link IS NOT NULL AND NEW.pagamento_link != '' THEN
      RAISE LOG '[trigger_auto_finalizacao] Ficha % já tem link de pagamento, pulando', NEW.id;
      RETURN NEW;
    END IF;

    -- Buscar URL e chave do Supabase
    SELECT decrypted_secret INTO _supabase_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    
    SELECT decrypted_secret INTO _anon_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

    IF _supabase_url IS NULL OR _anon_key IS NULL THEN
      RAISE LOG '[trigger_auto_finalizacao] Secrets não encontradas, usando env';
      RETURN NEW;
    END IF;

    RAISE LOG '[trigger_auto_finalizacao] Disparando auto-finalizacao para ficha % (status: %)', NEW.id, NEW.status;

    -- Chamar edge function via pg_net (fire and forget)
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/auto-finalizacao',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key
      ),
      body := jsonb_build_object('ficha_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$function$;
