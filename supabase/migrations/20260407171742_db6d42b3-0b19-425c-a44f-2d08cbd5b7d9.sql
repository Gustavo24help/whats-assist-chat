
-- Trigger function: chama auto-finalizacao via pg_net quando status muda para Finalizado
CREATE OR REPLACE FUNCTION public.trigger_auto_finalizacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
  _service_key text;
BEGIN
  -- Só dispara quando status muda PARA "Finalizado" (e não era Finalizado antes)
  IF NEW.status = 'Finalizado' AND (OLD.status IS NULL OR OLD.status != 'Finalizado') THEN
    
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

    -- Buscar URL e chave do Supabase
    SELECT decrypted_secret INTO _supabase_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    
    SELECT decrypted_secret INTO _anon_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

    IF _supabase_url IS NULL OR _anon_key IS NULL THEN
      RAISE LOG '[trigger_auto_finalizacao] Secrets não encontradas, usando env';
      RETURN NEW;
    END IF;

    RAISE LOG '[trigger_auto_finalizacao] Disparando auto-finalizacao para ficha %', NEW.id;

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
$$;

-- Criar trigger na tabela fichas_de_servico
DROP TRIGGER IF EXISTS trigger_auto_finalizacao ON fichas_de_servico;
CREATE TRIGGER trigger_auto_finalizacao
  AFTER UPDATE ON fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_finalizacao();
