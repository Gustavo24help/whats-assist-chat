-- Atualizar função para agendar reativação do bot para TODOS os status exceto "Perdido"
-- Antes: só agendava quando status = 'Finalizado'
-- Agora: agenda para qualquer status diferente de 'Perdido'

CREATE OR REPLACE FUNCTION schedule_bot_reactivation()
RETURNS TRIGGER AS $$
DECLARE
  bot_disabled boolean;
BEGIN
  -- Se o status mudou (não é a mesma coisa) E o novo status NÃO é "Perdido"
  -- Isso garante que quando uma ficha sair de qualquer status para outro (exceto Perdido),
  -- a reativação será agendada se o bot estiver desabilitado
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status != 'Perdido' THEN
    -- Verificar se o bot está desabilitado para este cliente
    SELECT NOT COALESCE(bot_habilitado, true) INTO bot_disabled
    FROM clientes
    WHERE telefone = NEW.telefone_cliente;
    
    -- Se bot está desabilitado, agendar reativação para 10 DIAS depois
    IF bot_disabled THEN
      -- Primeiro, remover agendamentos anteriores para este cliente (qualquer ficha)
      -- para evitar múltiplos agendamentos
      DELETE FROM bot_reactivation_schedule 
      WHERE telefone_cliente = NEW.telefone_cliente 
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
      
      RAISE LOG '[schedule_bot_reactivation] Agendada reativação em 10 dias para % (ficha: %, status: %)', 
        NEW.telefone_cliente, NEW.id, NEW.status;
    END IF;
  END IF;
  
  -- Se mudou para "Perdido", cancelar agendamentos pendentes
  IF NEW.status = 'Perdido' AND (OLD.status IS NULL OR OLD.status != 'Perdido') THEN
    DELETE FROM bot_reactivation_schedule 
    WHERE telefone_cliente = NEW.telefone_cliente 
      AND executed = false;
      
    RAISE LOG '[schedule_bot_reactivation] Cancelados agendamentos para % (ficha marcada como Perdido)', 
      NEW.telefone_cliente;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;