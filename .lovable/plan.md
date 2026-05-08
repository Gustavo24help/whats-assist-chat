## Problema

No bloco "Financeiro" do Dashboard, os 3 valores principais não fecham:

- Valor Total OS: R$ 2.576
- Pago a Prestador: R$ 2.135
- Líquido 24help: R$ 939 ❌ (deveria ser 2.576 − 2.135 = 441)

Causa: hoje cada KPI usa uma **base de fichas diferente** e duas **fontes diferentes** para o valor do prestador:

| KPI | Base de fichas hoje | Fonte do valor prestador |
|---|---|---|
| Total OS / MO / Peças | Finalizadas + `pagamento_realizado=true` no período | — |
| Líquido 24help / Take Rate | Status Finalizado/Garantia/Retorno no período | `valor_a_pagar_prestador` (transações) |
| Pago a Prestador | Transações com `status_pagamento_prestador='pago'` no período | `calcFinanceiroPrestador` (MO + peças + taxa visita) |

Por isso "MO + Peças" (1.890 + 40 = 1.930) também não bate com "Pago a Prestador" (2.135).

## Solução

Unificar o bloco Financeiro em **uma única base de fichas** e **uma única fonte para o valor pago ao prestador**, garantindo que: `Líquido 24help = Total OS − Pago a Prestador − Material pago pela 24help`.

### Regras unificadas (todas as 6 cards do bloco Financeiro)

**Base única:** fichas com `pagamento_realizado = true` E `status ∈ {Finalizado, Garantia, Retorno}` cujo `created_at` cai no período selecionado.
(É a mesma base que já alimenta hoje o "Valor Total OS", então o número 2.576 não muda.)

**Fórmulas:**

```text
Total OS          = Σ valor_total da ficha
Mão de Obra       = Σ valor_final_mao_obra (fallback valor_mao_obra)
Peças             = Σ valor_final_pecas    (fallback valor_pecas)
Pago a Prestador  = Σ valor_a_pagar_prestador da transacoes_financeiras
                    (1 transação por ficha, mesma da ficha da base)
Material 24help   = Σ valor_material das transações em que material_pago_24help=true
Líquido 24help    = Total OS − Pago a Prestador − Material 24help
% Take Rate       = Líquido 24help / Total OS × 100
```

Isso garante a identidade contábil visível na tela: **Líquido = Total OS − Pago a Prestador − Material pago pela empresa**.

### Tooltips revisados (cada card)

- **Valor Total OS** — "Soma dos valores das ordens de serviço pagas (status Finalizado/Garantia/Retorno) no período."
- **Pago a Prestador** — "Valor líquido devido aos prestadores nas mesmas OS (campo `valor_a_pagar_prestador` da transação financeira). Quando a 24help paga o material, esse valor não inclui peças."
- **Líquido 24help** — "Total OS − Pago a Prestador − Material pago pela 24help. É o que sobra para a empresa antes de impostos e custos operacionais."
- **% Take Rate 24help** — "Líquido 24help ÷ Total OS."
- **Mão de Obra / Peças** — "Decomposição das mesmas OS (informativo, não soma com os outros)."

### Comparativo (variação %)

A mesma base unificada é aplicada ao período de comparação, então as setinhas continuam consistentes.

### Salvaguarda de dados

- **Não altera** nenhum dado em banco — só muda o cálculo de leitura no hook `useOperationalKPIs.ts`.
- **Não muda** a aba Contas a Pagar nem a aba Contas a Receber: elas continuam com a mesma base por data de pagamento, que é o correto para fluxo de caixa. O bloco Financeiro do Dashboard passa a ser por OS realizada (DRE-style), e isso fica explícito no subtítulo do bloco.
- Atualizar o subtítulo: "vs mesmo período do mês anterior" → manter, e adicionar legenda pequena: *"Por data da OS paga (created_at)"* para deixar claro o critério.

## Detalhes técnicos

Arquivos:
- `src/hooks/useOperationalKPIs.ts` — substituir o bloco "KPIs Financeiros (nova regra)" (linhas ~514-586 e o bloco "Pago a Prestadores" ~588-686) por um único cálculo sobre `finalizadasPagas`. Buscar transações em chunks de 200 IDs usando `valor_a_pagar_prestador, valor_material, material_pago_24help`. Manter `EXCLUDED_FICHAS_PAGAMENTO`.
- Sem mudanças em UI (`ExecutiveKPIBlocks.tsx`), só os tooltips.
- Sem mudanças em SQL / migrations.

## Validação após implementar

1. Conferir no Dashboard que `Total OS − Pago a Prestador − Material 24help` = `Líquido 24help` (até centavos).
2. Comparar Total OS antes/depois: deve ficar **igual** (2.576).
3. Conferir que aba Contas a Pagar (`/contas-pagar`) não sofreu alteração visual nem numérica.
4. Conferir que `% Take Rate` agora bate com a divisão simples mostrada.
