-- Adicionar colunas para controle do bot na tabela clientes
ALTER TABLE clientes 
ADD COLUMN bot_habilitado boolean DEFAULT true,
ADD COLUMN data_bot_desabilitado timestamp with time zone;

-- Criar tabela para agendar reativação do bot
CREATE TABLE bot_reactivation_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_cliente text NOT NULL,
  ficha_id text NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  executed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Criar índice para consultas eficientes
CREATE INDEX idx_bot_reactivation_pending 
ON bot_reactivation_schedule (scheduled_at) 
WHERE executed = false;

-- Habilitar RLS na tabela bot_reactivation_schedule
ALTER TABLE bot_reactivation_schedule ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura por atendentes autenticados
CREATE POLICY "Atendentes podem ver agendamentos" 
ON bot_reactivation_schedule 
FOR SELECT 
USING (true);

-- Política para permitir inserção automática via trigger
CREATE POLICY "Sistema pode inserir agendamentos" 
ON bot_reactivation_schedule 
FOR INSERT 
WITH CHECK (true);

-- Política para permitir atualização automática via cron
CREATE POLICY "Sistema pode atualizar agendamentos" 
ON bot_reactivation_schedule 
FOR UPDATE 
USING (true);

-- Função para agendar reativação do bot quando ficha é finalizada
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para agendar reativação automaticamente
CREATE TRIGGER trigger_schedule_bot_reactivation
AFTER UPDATE ON fichas_de_servico
FOR EACH ROW
EXECUTE FUNCTION schedule_bot_reactivation();