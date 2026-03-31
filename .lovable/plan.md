

# Alterar lógica de reativação automática do bot

## Regra atual
- Status "Perdido" → reativa em 24h
- Qualquer outro status → reativa em 10 dias

## Nova regra desejada
- **Qualquer mudança de status** → reativa em **24 horas**
- **EXCETO** `Agendado` e `Visita Técnica` → reativa em **10 dias** (bot fica desligado enquanto o serviço está agendado/em visita, a menos que 10 dias passem)
- Qualquer nova mudança de status cancela o agendamento anterior e reinicia o contador com a nova regra

## Alteração

**Uma migration SQL** para atualizar a função `schedule_bot_reactivation()`:

```sql
CREATE OR REPLACE FUNCTION schedule_bot_reactivation()
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
      ELSE
        -- Todos os outros status: reativa em 24 horas
        INSERT INTO bot_reactivation_schedule (telefone_cliente, ficha_id, scheduled_at)
        VALUES (NEW.telefone_cliente, NEW.id, NOW() + INTERVAL '24 hours');
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

## Resumo do comportamento

| Status | Tempo de reativação |
|--------|-------------------|
| Agendado | 10 dias |
| Visita Técnica | 10 dias |
| Todos os outros | 24 horas |

Qualquer mudança de status reinicia o contador. Reativação manual continua funcionando normalmente. Nenhum dado existente é alterado — apenas o comportamento futuro de agendamento.

## Arquivos
- Nova migration SQL (única alteração)

