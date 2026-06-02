# Dashboard Executivo — Origem dos Dados

Documento de referência mapeando **cada métrica exibida no dashboard executivo** para sua origem real no banco (tabela, coluna, filtro e lógica de cálculo).

> **Regra geral de período:** quase todos os indicadores filtram por `fichas_de_servico.created_at` dentro do range selecionado no header do dashboard. Exceções estão explicitamente marcadas.

---

## 🔻 Funil de Conversão

Arquivo principal: `src/hooks/useOperationalKPIs.ts` + `src/components/ExecutiveDashboardSection.tsx`.

| Métrica | Tabela / Campo | Filtro / Lógica |
|---|---|---|
| **FS Criadas** | `fichas_de_servico` (count) | `created_at` no período |
| **Com Orçamento** | `fichas_de_servico` + `orcamentos` | Ficha que tem ≥1 linha em `orcamentos` **OU** `valor_total > 0` com `formulario_orcamento_data_primeiro_envio` preenchido |
| **Agendados** | `ficha_status_historico` (evento) + fallback `fichas_de_servico.status` | `status_novo = 'Agendado'` no período. **Exclui** fichas cujo status **atual** é `Perdido` |
| **Finalizados** | `ficha_status_historico` (evento) + fallback no status atual | `status_novo = 'Finalizado'` no período. **Exclui** fichas atualmente em `Perdido` |
| **Pago (cliente)** | `fichas_de_servico` | Subconjunto dos **Finalizados** com `pagamento_realizado = true` |
| **Taxa de fechamento global** | Calculada | `Pago (cliente) / FS Criadas × 100` |
| **Variações %** | Período anterior | Por padrão: **mesmo período do mês anterior** (configurável no seletor do header) |

**⚠️ Observação importante:** *Agendados* e *Finalizados* são contados a partir de **eventos de histórico** (`ficha_status_historico`), não do status atual da ficha. Isso garante que uma ficha que passou por "Agendado" e depois foi reagendada/cancelada **ainda conta** no funil daquele período.

---

## 💰 Financeiro

Arquivo: `src/components/ExecutiveDashboardSection.tsx`.

**Base de cálculo:** fichas com `pagamento_realizado = true` **E** `status IN ('Finalizado', 'Garantia', 'Retorno')` criadas no período.

| Métrica | Tabela / Campo | Fórmula |
|---|---|---|
| **Valor Total OS** | `fichas_de_servico.valor_total` | Σ `valor_total` |
| **Mão de Obra** | `valor_final_mao_obra` ?? `valor_mao_obra` | Σ (preferindo o valor "final" quando preenchido) |
| **Peças** | `valor_final_pecas` ?? `valor_pecas` | Σ (preferindo "final" quando preenchido) |
| **Pago a Prestadores** | Mão de Obra + Peças | Σ (Mão de Obra + Peças). **Quando `material_pago_24help = true`, as peças NÃO entram** (a 24help pagou o material direto) |
| **Líquido 24help** | Calculado | `Valor Total OS − Pago a Prestadores` |
| **% Take Rate** | Calculado | `Líquido 24help / Valor Total OS × 100` |

> Ver memória [`mem://finance/material-payment-responsibility-logic`](mem://finance/material-payment-responsibility-logic) e [`mem://logic/financial-reporting-formulas`](mem://logic/financial-reporting-formulas).

---

## 📊 Volume de Atendimento

Arquivo: `src/components/DashboardContent.tsx` (reaproveita `useOperationalKPIs`).

| Métrica | Origem | Observação |
|---|---|---|
| **Volume por status** | Mesma base dos KPIs operacionais | Filtra por `fichas_de_servico.created_at` |
| **Pago ao Prestador** | `transacoes_financeiras.data_pagamento_realizada` | ⚠️ **Diferente** do "Pago (cliente)" do funil. Aqui considera quando a 24help **efetivou o repasse** ao prestador (data da transação), não quando a ficha foi criada |

---

## 🏥 B2B vs B2C

Arquivo: `src/components/B2BvsB2CSection.tsx`.

**Fluxo:**
1. Busca `fichas_de_servico` paginadas (1000/página via `fetchAllPaginated`).
2. Faz lookup em `clientes` por telefone (fallback quando a ficha não tem `cliente_id`).
3. Classifica via helper `classificarCliente()` baseado em CNPJ (B2B) ou CPF (B2C).

| Métrica | Cálculo |
|---|---|
| **Contagem por segmento** | Count de fichas classificadas como B2B vs B2C |
| **Receita por segmento** | Σ `valor_total` das fichas com `pagamento_realizado = true` |
| **Ticket médio** | Receita / Quantidade de fichas pagas |
| **Clientes únicos** | Distinct por telefone/cliente_id dentro de cada segmento |

---

## 📌 Resumo das fontes principais

| Onde está | O que tem |
|---|---|
| `fichas_de_servico` | Status atual, valores, flags de pagamento, datas |
| `ficha_status_historico` | Eventos de mudança de status (fonte do funil) |
| `orcamentos` | Linhas de orçamento (qualifica "Com Orçamento") |
| `transacoes_financeiras` | Data efetiva do repasse ao prestador |
| `clientes` | Dados para classificação B2B/B2C |

## 🧭 Observações finais

- **Status histórico vs. status atual:** o funil usa eventos históricos; o card "Financeiro" usa o status **atual** (`Finalizado`/`Garantia`/`Retorno`).
- **Período:** sempre por `created_at` da ficha, exceto **Pago ao Prestador** (Volume), que usa `data_pagamento_realizada`.
- **Paginação:** todas as queries de listagem usam `fetchAllPaginated` para contornar o limite de 1000 do Supabase.
- **Exclusão de `Perdido`:** o funil ignora fichas cujo status **atual** é `Perdido`, mesmo que tenham passado por `Agendado` ou `Finalizado` no histórico.
