## Problema

No Dashboard, o KPI **Pago ao Prestador** mostra **52 pagamentos / R$ 25.659,55** para abr/2026, enquanto a aba **Financeiro → Pagamento Prestadores → Pagos** mostra **48 pagos / R$ 12.372,50** no mesmo período.

## Causa raiz (confirmada via consulta no banco)

O hook `useOperationalKPIs` calcula o KPI assim (linhas 588‑614 de `src/hooks/useOperationalKPIs.ts`):

- Lê `transacoes_financeiras` onde `status_pagamento_prestador = 'pago'` e `data_pagamento_realizada` cai no período.
- Conta linhas e soma `valor_a_pagar_prestador` cru.

Já a aba Financeiro (`PagamentoPrestadoresTabV2`) aplica regras adicionais que o Dashboard ignora:

1. **Filtra por status da ficha** `IN ('Finalizado', 'Garantia', 'Retorno')` e exige `valor_total > 0` e `prestador_id` preenchido.
2. **Exclui a ficha** `FS4-260127` (lista `EXCLUDED_FICHAS`).
3. **Recalcula o líquido** via `calcFinanceiro` em vez de confiar em `valor_a_pagar_prestador`:
   - `liquidoPrestador = mao_obra + taxa_visita_padrao` (+ `pecas` apenas se NÃO `material_pago_24help`).
4. Considera **uma transação por ficha** (mapa `transMap` faz upsert por `ficha_id`).

Conferência no banco para abr/2026:
- 52 transações pagas, soma `valor_a_pagar_prestador` cru = R$ 25.659,55.
- 4 dessas têm a ficha em status `Perdido` (legado), somando ~R$ 13.287,05 — exatamente o delta para chegar em R$ 12.372,50 / 48.

## O que vou alterar

Apenas o KPI no Dashboard. **Não toco no Financeiro** (que já é a fonte de verdade). **Não altero dados existentes** — só lógica de leitura.

### Arquivo: `src/hooks/useOperationalKPIs.ts` (bloco "Pago a Prestadores")

Substituir o cálculo atual por uma rotina que reproduz a regra do Financeiro:

1. Buscar `transacoes_financeiras` pagas com `data_pagamento_realizada` no período (igual hoje), trazendo `ficha_id` e `valor_a_pagar_prestador`.
2. Buscar as `fichas_de_servico` correspondentes (`in('id', fichaIds)`) com os campos: `status, valor_total, valor_mao_obra, valor_pecas, prestador_id, material_pago_24help`.
3. Buscar `prestadores` para pegar `taxa_visita_padrao` por CPF.
4. Manter apenas as fichas que satisfazem a mesma regra do Financeiro:
   - `status IN ('Finalizado', 'Garantia', 'Retorno')`
   - `valor_total > 0`
   - `prestador_id` não nulo
   - não estar em `EXCLUDED_FICHAS`
   - obedecer aos filtros de Dashboard (categoria, prestador, cliente) já existentes
5. Para cada ficha válida, recalcular `liquidoPrestador` da mesma forma que `calcFinanceiro`:
   - `mao_obra + taxa_visita_padrao` (+ `pecas` se `material_pago_24help` for false).
6. `pagoAoPrestador` = nº de fichas válidas; `valorPagoPrestadores` = soma desses líquidos.
7. **Fallback de segurança**: se `taxa_visita_padrao` não estiver cadastrada para o prestador, usar `0` (mesmo comportamento atual do Financeiro), garantindo que nenhum cálculo histórico vire `NaN`.

### Constantes e helpers compartilhados

Para evitar divergência futura entre Dashboard e Financeiro, vou:

- Extrair `EXCLUDED_FICHAS` e a função `calcFinanceiro` para um módulo único `src/lib/financeiroPrestador.ts` (re‑exporta o que já existe em `PagamentoPrestadoresTabV2.tsx`).
- O Financeiro passa a importar daí (sem mudar comportamento) e o Dashboard usa o mesmo helper.

## Impacto / Salvaguardas

- **Nada é gravado**: só mudanças na leitura.
- **Dados existentes intactos**: `transacoes_financeiras` e fichas não são alteradas.
- **Comparação histórica**: a função do KPI também é usada para o período anterior (`avg('pagoAoPrestador')`, `avg('valorPagoPrestadores')`); a nova regra é aplicada igualmente aos dois lados, mantendo coerência da variação %.
- **Outros KPIs**: blocos como `valorLiquido24help` e `margemBruta24help` continuam usando suas próprias somas (linhas 543‑581) — não são afetados.
- **Drill‑down** (`useKPIDrillDown.ts`): vou conferir se ele usa a mesma regra; se não, ajusto também para listar as mesmas fichas que entram no KPI.

## Resultado esperado

Para abr/2026 o KPI passa a exibir **48 pagamentos / R$ 12.372,50**, batendo exatamente com a aba Financeiro. Lançamentos legados em fichas `Perdido` deixam de inflar o número.
