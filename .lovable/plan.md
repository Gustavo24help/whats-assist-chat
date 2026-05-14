
## Problema

No dashboard, **Pago ao Prestador = 15** (período 01–14/05/26). Em Contas a Pagar (mesmo período), **Pagos = 23**.

São métricas diferentes medindo coisas diferentes:

| Onde | O que conta hoje | Filtro de data |
|---|---|---|
| Dashboard | Fichas em Finalizado/Garantia/Retorno onde **o cliente pagou** (`pagamento_realizado=true`) | `fichas.created_at` no período |
| Contas a Pagar → Pagos | Registros em `transacoes_financeiras` onde **nós pagamos o prestador** (`status_pagamento_prestador='pago'`) | `data_pagamento_realizada` no período |

Confirmação no banco para 01–14/05/2026:
- Lógica atual do dashboard: **14** fichas (≈15 do print)
- Lógica de Contas a Pagar: **23** pagamentos

A diferença é estrutural: o pagamento ao prestador ocorre ~2 dias úteis após a finalização, então boa parte dos 23 pagos em maio veio de fichas criadas em abril. E várias fichas criadas em maio com cliente já pago ainda não tiveram o prestador pago.

O rótulo "Pago ao Prestador" no dashboard é enganoso — ele na prática mede "fichas faturadas no período cujo cliente já pagou", não "quantos prestadores pagamos no período".

## Objetivo

Fazer o card **Pago ao Prestador** do dashboard usar exatamente a mesma definição de Contas a Pagar, para que os números batam.

## Mudança proposta

Em `src/hooks/useOperationalKPIs.ts`, substituir a fonte do KPI `pagoAoPrestador` (e a comparação correspondente) por uma consulta a `transacoes_financeiras`:

```sql
SELECT count(*) FROM transacoes_financeiras
WHERE status_pagamento_prestador = 'pago'
  AND data_pagamento_realizada >= :from
  AND data_pagamento_realizada <= :to
```

- Período atual usa `from`/`to` já calculados por `getDateRange` (que agora considera o dia de hoje no caso `month`).
- Período de comparação usa o mesmo intervalo deslocado pela lógica existente (`previous-month`, `previous-period`, `avg-3-months`), exatamente como os demais KPIs.
- Excluir `FS4-260127` (mesma exclusão usada hoje) via `not('ficha_id', 'eq', ...)`.

## Impacto controlado (sem efeito colateral)

Só muda **o número e a variação do card "Pago ao Prestador"** no funil executivo. Não afeta:

- `valorPagoPrestadores` (KPI financeiro em R$, no bloco financeiro) — continua somando MO + Peças das fichas financeiras do período por `created_at`. Esse KPI é uma métrica de custo do volume produzido no período, conceito diferente do "fluxo de caixa pago no período".
- `valorLiquido24help`, `margemBruta24help`, `valorTotalOS`, `valorMaoObra`, `valorPecas` — inalterados.
- Nenhum dado armazenado, nenhuma alteração em `transacoes_financeiras`, nenhum trigger.
- Drilldown do KPI: o `KPIDrillDownDialog` para `pagoAoPrestador` precisa apontar para os mesmos registros (transações pagas no período), em vez das fichas atuais. Atualizar a query de drilldown em `useKPIDrillDown.ts` para listar fichas cujo `transacoes_financeiras.data_pagamento_realizada` esteja no período e `status_pagamento_prestador='pago'`. Sem mudança nas colunas exibidas.

## Tooltip

Atualizar o tooltip do card para deixar explícito:
> "Quantidade de prestadores pagos no período (data do pagamento realizada). Mesma base de Contas a Pagar → Pagos."

## Arquivos a alterar

- `src/hooks/useOperationalKPIs.ts` — nova consulta para `pagoAoPrestador` (atual + comparação) usando `transacoes_financeiras`.
- `src/hooks/useKPIDrillDown.ts` — drilldown do KPI `pagoAoPrestador` passa a usar `transacoes_financeiras.data_pagamento_realizada` no período.
- `src/components/dashboard/ExecutiveDashboardSection.tsx` — atualizar `tooltip` do card "Pago ao Prestador".

## Validação após implementar

1. Filtrar dashboard em "Este mês" → card "Pago ao Prestador" deve mostrar **23** (igual a Contas a Pagar).
2. Conferir mês anterior (abril) — número do dashboard deve bater com o que aparece em Contas a Pagar quando o usuário filtra abril.
3. Demais cards do funil e do bloco financeiro inalterados.
