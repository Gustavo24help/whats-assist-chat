

# Ajuste Manual de Data de Finalização

## Problema
Quando um serviço é finalizado em final de semana ou feriado, a data registrada (via `ficha_status_historico.data_inicio` e `transacoes_financeiras.data_execucao`) fica incorreta, afetando o cálculo de prazo de pagamento (2 dias úteis) e relatórios.

## Solução

### 1. Novo componente: `AjustarDataFinalizacaoDialog.tsx`
Dialog que aparece apenas para fichas com status "Finalizado". Campos:
- **Data de finalização real** (datepicker, obrigatório)
- **Justificativa** (textarea, obrigatório)
- **Prestador** (exibido read-only, puxado da ficha)
- **Operador** (capturado automaticamente via `auth.uid()`)

Ao confirmar:
1. Atualiza `ficha_status_historico` onde `ficha_id = X` e `status_novo = 'Finalizado'`: seta `data_inicio` para a nova data
2. Atualiza `transacoes_financeiras` onde `ficha_id = X`: seta `data_execucao` para a nova data e recalcula `data_pagamento_prevista` (2 dias úteis a partir da nova data)
3. Registra o ajuste em `ficha_status_historico` como nota ou em uma nova coluna de auditoria

### 2. Migration: tabela de auditoria `ajustes_data_finalizacao`
```sql
CREATE TABLE ajustes_data_finalizacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id text NOT NULL,
  data_anterior timestamptz NOT NULL,
  data_nova timestamptz NOT NULL,
  justificativa text NOT NULL,
  prestador_id text,
  prestador_nome text,
  ajustado_por uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
```
Com RLS para authenticated users poderem inserir e selecionar.

### 3. Botão no `FichaServicoTab.tsx`
Ao lado do botão "Confirmar Financeiro", mostrar botão "Ajustar Data Finalização" apenas quando `ficha.status === 'Finalizado'`. Ícone de calendário.

### 4. Botão na listagem `/fichas` (`Fichas.tsx`)
Na row de cada ficha finalizada, um pequeno ícone/botão de calendário para abrir o mesmo dialog.

### 5. Recálculo compatível
A função `calcularDataPagamento` já existe em `PopupConfirmacaoFinanceira.tsx`. Será extraída ou reutilizada para recalcular `data_pagamento_prevista` com base na nova data, mantendo consistência com o fluxo financeiro existente.

### Detalhes técnicos
- Migration cria tabela `ajustes_data_finalizacao` com RLS
- Updates em `ficha_status_historico` e `transacoes_financeiras` feitos via Supabase client
- O trigger `update_updated_at_column` preserva `updated_at` manual (já documentado)
- A `data_pagamento_prevista` é recalculada client-side usando `isBusinessDay` e salva via update

