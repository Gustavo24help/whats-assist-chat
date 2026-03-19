

# Atualização: Encerrar envio de orçamentos ao mudar para "Perdido"

## Mudanças

### 1. FichaCard.tsx — Renomear textos
- Badge "Encerrado" → **"Envio de Orçamentos Encerrado"**
- Botão "Reativar" → **"Reabrir Envio de Orçamentos"**

### 2. Migração SQL — Trigger para fechar formulário automaticamente
Criar trigger `BEFORE UPDATE` na tabela `fichas_de_servico` que, ao detectar mudança de status para **"Agendado"**, **"Orçamento Aprovado / Agendamento"** ou **"Perdido"**, define automaticamente:
- `formulario_orcamento_ativo = false`
- `formulario_orcamento_encerrado_em = NOW()`

```sql
CREATE OR REPLACE FUNCTION public.close_orcamento_on_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('Agendado', 'Orçamento Aprovado / Agendamento', 'Perdido')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.formulario_orcamento_ativo = true THEN
    NEW.formulario_orcamento_ativo := false;
    NEW.formulario_orcamento_encerrado_em := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_close_orcamento_on_status
  BEFORE UPDATE ON fichas_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION close_orcamento_on_status();
```

### Arquivos modificados
- `src/components/FichaCard.tsx` — labels renomeados
- Migração SQL — trigger automático para 3 status

