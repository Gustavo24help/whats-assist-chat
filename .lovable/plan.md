

# Plan: Planilhas internas, Financeiro cleanup, UI redesign, Prestador banco field, and fixes

## 1. Fix build error in Avisos.tsx
Line 161 references `avisosData` which doesn't exist — should be `avisosBase`.

## 2. Populate internal spreadsheets with real data

### PlanilhaControleFinanceiro.tsx
Replace the static empty table with live data from `transacoes_financeiras` joined with `fichas_de_servico` and `prestadores`. Columns match the existing headers (Data contratação, Data execução, Data pgto, ID, Nome prestador, CPF, CNPJ, Pix, Categoria, Nome cliente, Pagamento sim/não, Fone cliente, CPF/CNPJ cliente, Origem lead, Forma pgto, Conf pgto, Adiant cliente, Adiant prestador, Tx visita, MO, Peças, Taxa 24help, Total OS, Líquido prestador, Desconto, Lucro bruto, Rentab).

Data sources: `transacoes_financeiras` for financial data, `fichas_de_servico` for ficha metadata, `prestadores` for prestador info.

### PlanilhaControlePagamentos.tsx
Replace static table with live data. Columns: N. Ficha, Cliente, Prestador, Data conclusão, Valor, Valor MO, Cliente pagou?, Data pgto prestador, Pagamento feito?, Link ASAAS, Valor pago.

Data from `fichas_de_servico` + `transacoes_financeiras` + `prestadores`.

### Sync: When "Cliente Pagou" or "Pagar" is clicked in Financeiro
- `marcarPagou` in PagamentoClientesTabV2 already updates `pagamento_realizado` on fichas and `status_pagamento_cliente` on transacoes — this reflects in Planilha Pagamentos "Cliente pagou?" column.
- `marcarPago` in PagamentoPrestadoresTabV2 already updates `status_pagamento_prestador` on transacoes — this reflects in Planilha Pagamentos "Pagamento feito?" column.
- Both planilhas read live data, so changes are reflected on reload.

## 3. Clean up Financeiro UI data
- In PagamentoClientesTabV2 and PagamentoPrestadoresTabV2, the data already comes from `fichas_de_servico` filtered by status. No static/mock data to clean. The "cleanup" is already in place — only real fichas with status "Finalizado" and `valor_total > 0` appear.

## 4. Redesign Financeiro UI (less colorful, more like the reference image)

### PagamentoPrestadoresTabV2 redesign
Based on the reference image, each row should be a clean card with:
- Left: Avatar initials + prestador name + code + ficha badge + category badge + "Cliente Pagou" status badge
- Center: "Valor a Pagar" prominent + bank/PIX info below + NPS score + evaluation score
- Right: "Detalhes" and "Pagar" buttons
- Less colorful backgrounds — use subtle borders instead of colored cards
- Remove the heavy colored summary cards at top, use cleaner stats

### PagamentoClientesTabV2 redesign
Similar clean card approach — less border-l-4 color accents, cleaner layout.

## 5. Add `banco` field to PrestadorManagement form
The `prestadores` table already has a `banco` column. The `PrestadorManagement` component's `Prestador` interface and form don't include it. Add:
- `banco` to the interface
- Input field in the dialog form
- Include in save/upsert logic

## 6. Verify TrocarPrestadorDialog flow
Current flow review:
- ✅ Requires motivo (mandatory)
- ✅ Updates `prestador_id`, `prestador_anterior_id`, `motivo_troca_prestador` on ficha
- ✅ Records in `prestador_historico` for the previous prestador
- ⚠️ Does NOT record in `prestador_historico` for the NEW prestador (should add)
- ⚠️ Does NOT record in `ficha_status_historico` (but this is a prestador change, not status change — OK)
- ⚠️ Financial: When a ficha has prestador swapped, the Financeiro shows the CURRENT prestador. If both prestadores need payment entries, we need to handle creating a transacao for the old prestador (partial work) and the new one. Currently only the current prestador appears in Financeiro since it reads `prestador_id`.

### Fix for TrocarPrestadorDialog:
- Add `prestador_historico` entry for the NEW prestador too (assigned event)
- The financial handling for dual-prestador payments is complex — for now, the old prestador's work should be recorded if they had already done partial work, but typically the swap means the old one didn't complete, so only the new one gets paid. Keep current behavior (only current prestador in Financeiro).

## Files to create/edit

1. **Edit** `src/pages/Avisos.tsx` — fix `avisosData` → `avisosBase` (line 161)
2. **Rewrite** `src/pages/PlanilhaControleFinanceiro.tsx` — fetch from `transacoes_financeiras` + related tables
3. **Rewrite** `src/pages/PlanilhaControlePagamentos.tsx` — fetch from `fichas_de_servico` + `transacoes_financeiras` + `prestadores`
4. **Rewrite** `src/components/financeiro/PagamentoPrestadoresTabV2.tsx` — cleaner UI per reference
5. **Rewrite** `src/components/financeiro/PagamentoClientesTabV2.tsx` — cleaner UI
6. **Edit** `src/components/PrestadorManagement.tsx` — add `banco` field to interface + form + upsert
7. **Edit** `src/components/TrocarPrestadorDialog.tsx` — add historico entry for new prestador

## No database changes needed
All required tables and columns already exist.

