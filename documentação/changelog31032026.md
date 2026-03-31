## 📋 Changelog — 31/03/2026

### Correções aplicadas

1. **Bug de data de pagamento prevista (crítico)**: O sistema calculava a data de pagamento do prestador a partir da data atual (`new Date()`) em vez da data real de finalização do serviço (obtida de `ficha_status_historico`). Isso causava datas de pagamento incorretas quando a confirmação financeira era feita dias após a finalização. Corrigido em:
   - `PopupConfirmacaoFinanceira.tsx` — busca `data_inicio` do histórico de status "Finalizado"
   - `PagamentoPrestadoresTab.tsx` — mesmo fix para marcação rápida de pagamento
   - `TrocaPrestadorPagamentoDialog.tsx` — mesmo fix para troca de prestador com pagamento

2. **Dados corrigidos**: `FS11-260316` tinha `data_pagamento_prevista` = 31/03 (errado), corrigido para 27/03 (2 dias úteis após finalização em 25/03).

3. **Formulário público de orçamento**: Corrigido erro "Ficha não encontrada" causado por queries diretas bloqueadas por RLS. Criada Edge Function `public-orcamento-data` como proxy seguro usando `service_role`.

4. **Bot reativação 24h**: Corrigido `reactivate-bots-24h` para processar corretamente agendamentos pendentes da tabela `bot_reactivation_schedule`.

### Regra de negócio reforçada

- **Data de pagamento ao prestador**: Sempre calculada como 2 dias úteis após a **data real de finalização** do serviço (campo `data_inicio` do registro "Finalizado" em `ficha_status_historico`), nunca a partir do momento da confirmação financeira.

---
