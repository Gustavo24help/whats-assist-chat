

## Correções na página /financeiro

### Mudanças planejadas

**1. Aba padrão: Prestadores**
- Em `Financeiro.tsx`, trocar `defaultValue="clientes"` para `defaultValue="prestadores"`.

**2. Data de pagamento = contratação + 2 dias úteis**
- Na `PagamentoPrestadoresTabV2.tsx`, importar `isBusinessDay` de `businessDays2026.ts` e criar helper `addBusinessDays(date, n)` que soma N dias úteis.
- Adicionar campo `data_pagamento_prevista` calculado como `created_at + 2 dias úteis` em cada item da lista.
- Exibir essa data na listagem de pendentes (ex: "Pgto: 18/03") e no diálogo de detalhes.
- Na `PagamentoClientesTabV2.tsx`, exibir a data de `updated_at` (ou contratação) formatada.

**3. Data de contratação visível nos detalhes**
- No dialog de detalhes de ambas as abas, adicionar linha "Data Contratação" com `created_at` formatado.

**4. Seleção múltipla com checkboxes + ações em lote**
- Adicionar state `selectedIds: Set<string>` em ambas as tabs.
- Renderizar `<Checkbox>` em cada card de pendente.
- Barra de ação fixa ao selecionar 1+: "X selecionados | Pagar Todos | Cancelar | Desmarcar".
- Botão "Mostrar Pop-ups" que abre o dialog de confirmação sequencialmente para cada selecionado (e também no individual, renomear o botão de Info para "Detalhes / Pop-up").

**5. Renomear "Cliente Pendente"**
- Na `PagamentoPrestadoresTabV2.tsx`, trocar `"Cliente Pendente"` por `"Pagamento do Cliente Pendente"`.

### Arquivos afetados
- `src/pages/Financeiro.tsx` — aba padrão
- `src/components/financeiro/PagamentoPrestadoresTabV2.tsx` — data pagamento, checkboxes, lote, rename badge
- `src/components/financeiro/PagamentoClientesTabV2.tsx` — data visível, checkboxes, lote
- `src/lib/businessDays2026.ts` — já tem helpers necessários (importar `getBusinessDaysInRange`)

