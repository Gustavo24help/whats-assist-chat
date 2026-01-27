
# Plano: Ajustar Logica de Reativacao do Bot

## Resumo das Alteracoes

A logica atual precisa ser corrigida para:

| Status | Tempo de Reativacao |
|--------|---------------------|
| Qualquer (exceto Perdido) | 10 dias |
| Perdido | 24 horas |

E a cada mudanca de status, o contador reinicia.

---

## Alteracao Necessaria

### Arquivo: Nova migracao SQL

Atualizar a funcao `schedule_bot_reactivation()` para:

1. **Quando status muda para qualquer coisa EXCETO Perdido:**
   - Deletar agendamentos pendentes anteriores
   - Criar novo agendamento para 10 dias

2. **Quando status muda para Perdido:**
   - Deletar agendamentos pendentes anteriores
   - Criar novo agendamento para 24 horas (nao mais cancelar)

---

## Codigo SQL da Migracao

```sql
CREATE OR REPLACE FUNCTION schedule_bot_reactivation()
RETURNS TRIGGER AS $$
DECLARE
  bot_disabled boolean;
BEGIN
  -- Se o status mudou
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Verificar se o bot esta desabilitado para este cliente
    SELECT NOT COALESCE(bot_habilitado, true) INTO bot_disabled
    FROM clientes
    WHERE telefone = NEW.telefone_cliente;
    
    -- Se bot esta desabilitado, agendar reativacao
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
        
        RAISE LOG '[schedule_bot_reactivation] Agendada reativacao em 24 HORAS para % (ficha: %, status: Perdido)', 
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
        
        RAISE LOG '[schedule_bot_reactivation] Agendada reativacao em 10 DIAS para % (ficha: %, status: %)', 
          NEW.telefone_cliente, NEW.id, NEW.status;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

---

## Fluxo de Funcionamento

```text
+------------------+     +-----------------------+     +----------------------+
| Bot Desativado   | --> | Mudanca de Status     | --> | Perdido?             |
| (bot_habilitado  |     | (qualquer)            |     |                      |
|  = false)        |     |                       |     +----------+-----------+
+------------------+     +-----------------------+                |
                                                         Sim      |      Nao
                                                    +-------------+-------------+
                                                    |                           |
                                            +-------v-------+           +-------v-------+
                                            | Agenda para   |           | Agenda para   |
                                            | 24 HORAS      |           | 10 DIAS       |
                                            +---------------+           +---------------+
```

---

## Importante

- A cada mudanca de status, o agendamento anterior e cancelado e um novo e criado
- Isso significa que se uma ficha mudar de status varias vezes, o bot so sera reativado apos o ultimo agendamento
- O bot so e reativado se estiver desabilitado no momento da mudanca de status

