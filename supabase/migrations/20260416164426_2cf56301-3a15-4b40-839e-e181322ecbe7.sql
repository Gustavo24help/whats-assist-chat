
CREATE OR REPLACE FUNCTION public.trigger_auto_finalizacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url text := 'https://halqtsowfqkczvlvwmdd.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhbHF0c293ZnFrY3p2bHZ3bWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjY3OTQsImV4cCI6MjA3NjU0Mjc5NH0.1rp-MWsVfWcBgCzptore5R3RKHHHHkKV2OrRdi9hwdQ';
BEGIN
  -- CASO 1: Status mudou PARA "Finalizado" APENAS
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'Finalizado' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM NEW.status)) THEN
    
    IF NEW.status != 'Finalizado' THEN
      RETURN NEW;
    END IF;

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

    RAISE LOG '[trigger_auto_finalizacao] Disparando para ficha % (status: %)', NEW.id, NEW.status;

    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/auto-finalizacao',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _anon_key),
      body := jsonb_build_object('ficha_id', NEW.id)
    );

    RETURN NEW;
  END IF;

  -- CASO 2: valor_total mudou em ficha Finalizado SEM link ainda (retry)
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'Finalizado'
     AND OLD.valor_total IS DISTINCT FROM NEW.valor_total
     AND COALESCE(NEW.valor_total, 0) > 0
     AND (NEW.pagamento_link IS NULL OR NEW.pagamento_link = '')
     AND NEW.pagamento_realizado IS NOT TRUE THEN

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
