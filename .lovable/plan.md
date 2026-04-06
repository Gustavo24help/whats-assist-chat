

## Plano: Filtrar serviços pela data de pagamento ao prestador (não pela data de criação da ficha)

### Problema atual
O Dashboard TV busca fichas por `created_at` da tabela `fichas_de_servico` e depois cruza com `transacoes_financeiras` para ver se está paga ao prestador. Isso significa que uma ficha criada em março mas paga em abril aparece em **março**, não em abril.

### Mudança
Inverter a lógica: buscar primeiro na tabela `transacoes_financeiras` filtrando por `data_pagamento_realizada` no período selecionado, e depois buscar os dados financeiros (valor_total, valor_mao_obra, valor_pecas) das fichas correspondentes.

### Alterações em `src/hooks/useDashboardTV.ts`

1. **Período atual e anterior** — substituir as queries de `fichasPagasRes` e `fichasPagasPrevRes`:
   - Em vez de buscar `fichas_de_servico` por `created_at` e depois cruzar com `transacoes_financeiras`, buscar diretamente em `transacoes_financeiras` onde `status_pagamento_prestador = 'pago'` e `data_pagamento_realizada` está no período.
   - Coletar os `ficha_id` resultantes.
   - Buscar os dados financeiros (valor_total, valor_mao_obra, valor_pecas) das fichas correspondentes em `fichas_de_servico`.

2. **Remover a lógica de cross-check** (linhas ~369-396) que hoje faz o batch lookup em `transacoes_financeiras` — ela se torna desnecessária pois a fonte primária já é essa tabela.

3. **Manter intactas** todas as outras queries (fsCriadas, agendados, executados, ads, conversas, NPS, etc.) — elas continuam usando `created_at` da ficha pois são métricas operacionais diferentes.

4. **Métricas de tempo** (tempoCicloCompleto) que hoje usam `created_at` da ficha finalizada — avaliar se também devem mudar. Recomendação: manter por `created_at` pois mede ciclo de processo, não financeiro.

### Fluxo da nova query

```text
transacoes_financeiras
  WHERE status_pagamento_prestador = 'pago'
  AND data_pagamento_realizada >= fromStr
  AND data_pagamento_realizada <= toStr
  → lista de ficha_ids

fichas_de_servico
  WHERE id IN (ficha_ids)
  → valor_total, valor_mao_obra, valor_pecas
  → calcula receita, lucro, qtd, ticket, margem
```

### Impacto
- **servicosFechados**, **receitaTotal**, **lucroBruto**, **ticketMedio**, **margemMedia**, **pagos** passam a ser contados pela data de pagamento ao prestador.
- Dados existentes não são alterados — apenas a forma de consulta muda.
- Celebração de metas também passa a considerar essa nova base.

