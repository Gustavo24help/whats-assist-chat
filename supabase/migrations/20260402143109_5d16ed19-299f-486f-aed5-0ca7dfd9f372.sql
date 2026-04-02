
CREATE OR REPLACE FUNCTION public.schedule_bot_reactivation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  bot_disabled boolean;
  ultima_msg timestamptz;
  reactivation_time timestamptz;
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
      
      -- Buscar última mensagem (enviada ou recebida) do cliente
      SELECT MAX(data_hora) INTO ultima_msg
      FROM mensagens
      WHERE cliente_id = NEW.telefone_cliente;
      
      -- Se não houver mensagem, usar NOW() como fallback
      IF ultima_msg IS NULL THEN
        ultima_msg := NOW();
      END IF;
      
      -- Calcular reativação: 24h após última mensagem
      -- Para Agendado/Visita Técnica: 10 dias após última mensagem
      IF NEW.status IN ('Agendado', 'Visita Técnica') THEN
        reactivation_time := ultima_msg + INTERVAL '10 days';
        
        -- Garantir que não agenda no passado
        IF reactivation_time < NOW() THEN
          reactivation_time := NOW() + INTERVAL '10 days';
        END IF;
        
        INSERT INTO bot_reactivation_schedule (telefone_cliente, ficha_id, scheduled_at)
        VALUES (NEW.telefone_cliente, NEW.id, reactivation_time);
        
        RAISE LOG '[schedule_bot_reactivation] Agendada reativação em 10 DIAS após última msg para % (ficha: %, status: %, ultima_msg: %, scheduled_at: %)', 
          NEW.telefone_cliente, NEW.id, NEW.status, ultima_msg, reactivation_time;
      ELSE
        reactivation_time := ultima_msg + INTERVAL '24 hours';
        
        -- Garantir que não agenda no passado
        IF reactivation_time < NOW() THEN
          reactivation_time := NOW() + INTERVAL '24 hours';
        END IF;
        
        INSERT INTO bot_reactivation_schedule (telefone_cliente, ficha_id, scheduled_at)
        VALUES (NEW.telefone_cliente, NEW.id, reactivation_time);
        
        RAISE LOG '[schedule_bot_reactivation] Agendada reativação 24H após última msg para % (ficha: %, status: %, ultima_msg: %, scheduled_at: %)', 
          NEW.telefone_cliente, NEW.id, NEW.status, ultima_msg, reactivation_time;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
