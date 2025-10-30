-- Corrigir função com search_path seguro
CREATE OR REPLACE FUNCTION schedule_bot_reactivation()
RETURNS TRIGGER AS $$
DECLARE
  bot_disabled boolean;
BEGIN
  -- Se ficha mudou para "Finalizado" E não era "Finalizado" antes
  IF NEW.status = 'Finalizado' AND (OLD.status IS NULL OR OLD.status != 'Finalizado') THEN
    -- Verificar se o bot está desabilitado para este cliente
    SELECT NOT COALESCE(bot_habilitado, true) INTO bot_disabled
    FROM clientes
    WHERE telefone = NEW.telefone_cliente;
    
    -- Se bot está desabilitado, agendar reativação para 12h depois
    IF bot_disabled THEN
      INSERT INTO bot_reactivation_schedule (
        telefone_cliente,
        ficha_id,
        scheduled_at
      ) VALUES (
        NEW.telefone_cliente,
        NEW.id,
        NOW() + INTERVAL '12 hours'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;