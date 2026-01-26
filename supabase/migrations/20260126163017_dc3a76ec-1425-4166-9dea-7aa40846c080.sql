-- Atualizar a função para agendar reativação 10 dias após "Finalizado"
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
    
    -- Se bot está desabilitado, agendar reativação para 10 DIAS depois (antes era 12h)
    IF bot_disabled THEN
      -- Primeiro, remover agendamentos anteriores para este cliente/ficha
      DELETE FROM bot_reactivation_schedule 
      WHERE telefone_cliente = NEW.telefone_cliente 
        AND ficha_id = NEW.id 
        AND executed = false;
      
      -- Agendar nova reativação para 10 dias
      INSERT INTO bot_reactivation_schedule (
        telefone_cliente,
        ficha_id,
        scheduled_at
      ) VALUES (
        NEW.telefone_cliente,
        NEW.id,
        NOW() + INTERVAL '10 days'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;