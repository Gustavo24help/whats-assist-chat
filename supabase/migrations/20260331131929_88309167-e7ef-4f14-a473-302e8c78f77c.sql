CREATE OR REPLACE FUNCTION public.schedule_bot_reactivation()
RETURNS TRIGGER AS $$
DECLARE
  bot_disabled boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT NOT COALESCE(bot_habilitado, true) INTO bot_disabled
    FROM clientes
    WHERE telefone = NEW.telefone_cliente;
    
    IF bot_disabled THEN
      -- Cancelar agendamentos anteriores
      DELETE FROM bot_reactivation_schedule 
      WHERE telefone_cliente = NEW.telefone_cliente 
        AND executed = false;
      
      IF NEW.status IN ('Agendado', 'Visita Técnica') THEN
        -- Agendado/Visita Técnica: reativa em 10 dias
        INSERT INTO bot_reactivation_schedule (telefone_cliente, ficha_id, scheduled_at)
        VALUES (NEW.telefone_cliente, NEW.id, NOW() + INTERVAL '10 days');
        
        RAISE LOG '[schedule_bot_reactivation] Agendada reativação em 10 DIAS para % (ficha: %, status: %)', 
          NEW.telefone_cliente, NEW.id, NEW.status;
      ELSE
        -- Todos os outros status: reativa em 24 horas
        INSERT INTO bot_reactivation_schedule (telefone_cliente, ficha_id, scheduled_at)
        VALUES (NEW.telefone_cliente, NEW.id, NOW() + INTERVAL '24 hours');
        
        RAISE LOG '[schedule_bot_reactivation] Agendada reativação em 24 HORAS para % (ficha: %, status: %)', 
          NEW.telefone_cliente, NEW.id, NEW.status;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;