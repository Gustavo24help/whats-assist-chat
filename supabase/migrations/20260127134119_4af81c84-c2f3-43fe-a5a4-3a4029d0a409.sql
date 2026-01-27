CREATE OR REPLACE FUNCTION schedule_bot_reactivation()
RETURNS TRIGGER AS $$
DECLARE
  bot_disabled boolean;
BEGIN
  -- Se o status mudou
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Verificar se o bot está desabilitado para este cliente
    SELECT NOT COALESCE(bot_habilitado, true) INTO bot_disabled
    FROM clientes
    WHERE telefone = NEW.telefone_cliente;
    
    -- Se bot está desabilitado, agendar reativação
    IF bot_disabled THEN
      -- Primeiro, remover agendamentos anteriores (reinicia o contador)
      DELETE FROM bot_reactivation_schedule 
      WHERE telefone_cliente = NEW.telefone_cliente 
        AND executed = false;
      
      -- Definir intervalo baseado no status
      IF NEW.status = 'Perdido' THEN
        -- Perdido: reativa em 24 horas
        INSERT INTO bot_reactivation_schedule (
          telefone_cliente,
          ficha_id,
          scheduled_at
        ) VALUES (
          NEW.telefone_cliente,
          NEW.id,
          NOW() + INTERVAL '24 hours'
        );
        
        RAISE LOG '[schedule_bot_reactivation] Agendada reativação em 24 HORAS para % (ficha: %, status: Perdido)', 
          NEW.telefone_cliente, NEW.id;
      ELSE
        -- Outros status: reativa em 10 dias
        INSERT INTO bot_reactivation_schedule (
          telefone_cliente,
          ficha_id,
          scheduled_at
        ) VALUES (
          NEW.telefone_cliente,
          NEW.id,
          NOW() + INTERVAL '10 days'
        );
        
        RAISE LOG '[schedule_bot_reactivation] Agendada reativação em 10 DIAS para % (ficha: %, status: %)', 
          NEW.telefone_cliente, NEW.id, NEW.status;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;