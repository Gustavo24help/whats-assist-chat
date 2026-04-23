

# Plano corrigido: Refatoração de KPIs do Dashboard Executivo

## 1. Pontos da proposta anterior que foram REJEITADOS e como isso muda o plano

| Ponto rejeitado | Correção aplicada agora |
|---|---|
| Conversas Iniciadas = "telefones únicos novos no período" / "1ª ficha histórica do telefone" | **Removido**. Cliente recorrente que abre nova demanda também conta. |
| Forçar diferenciação artificial entre Conversas Iniciadas e FS Criadas | **Reconhecido**: as duas métricas vão ficar **iguais** com a estrutura atual. Será explicitado na UI (tooltip) e na documentação. |
| Usar `created_at` como proxy de eventos de outras fases (Agendado, Finalizado) | **Removido**. Vamos usar `ficha_status_historico` para os eventos. |
| Manter `getPreviousPeriodRange` (janela imediatamente anterior) | **Substituído** pelos 3 modos pedidos. |

## 2. Diagnóstico — o que está errado hoje

**`useOperationalKPIs.ts` (atual)**:
- Comparação: pega N dias **imediatamente anteriores** (errado para sazonalidade).
- **Conversas Iniciadas**: RPC `calculate_conversas_iniciadas` conta "1ª mensagem histórica do cliente + fichas subsequentes". Subconta brutalmente — cliente recorrente cuja 1ª msg foi em 2024 não conta como nova demanda hoje.
- **Visita Agendada**: filtra `data_visita_tecnica IS NOT NULL` por `created_at` da ficha → mistura ato de criar com ato de agendar visita.
- **Serviço Agendado**: filtra `status='Agendado' AND created_at IN período` → **gravemente incorreto**. Hoje só existem 7 fichas no status `Agendado` (a maioria já passou para `Finalizado`), enquanto o **histórico** mostra 192 fichas que tiveram evento "Agendado".
- **Finalizado e Pago**: filtra `status='Finalizado' AND pagamento_realizado=true AND created_at IN período` → mede "fichas criadas no período que hoje estão finalizadas e pagas", **não** "fichas finalizadas no período".
- **Valor Total OS**: mesmo problema do anterior.

## 3. Achados de banco que sustentam o plano

- `ficha_status_historico` tem **boa cobertura** desde 02/02/2026 (310 eventos `Agendado`, 363 `Finalizado`, 96 `Visita Técnica`).
- Para fichas anteriores a 02/02/2026, o histórico não existe → será necessário **fallback explícito** (usar `created_at` da ficha apenas se `status` atual já for o procurado **e** não houver registro de histórico).
- `transacoes_financeiras` tem 302 registros pagos com `data_pagamento_realizada` populada — cobertura suficiente para o KPI.
- Clientes recorrentes são comuns (1 cliente com 12 fichas no período observado) — confirma que **cada ficha = nova demanda**.

## 4. Definição final de cada KPI

| KPI | Evento âncora | Fonte | Observação |
|---|---|---|---|
| **Conversas Iniciadas** | `created_at` da ficha | `fichas_de_servico` | Cada nova ficha = nova demanda comercial. **Vai ficar igual a FS Criadas** com a estrutura atual. Será documentado e exibido como tooltip na UI explicando a equivalência. |
| **FS Criadas** | `created_at` | `fichas_de_servico` | Sem mudança conceitual. |
| **Visita Agendada** | `created_at` em `ficha_status_historico` com `status_novo='Visita Técnica'`. **Fallback**: `created_at` da ficha se status atual = 'Visita Técnica' e não houver histórico. | `ficha_status_historico` + `fichas_de_servico` | Mede o ato de marcar visita. |
| **Serviço Agendado** | `created_at` em `ficha_status_historico` com `status_novo='Agendado'`. **Fallback** análogo. | idem | Mede o ato de agendar (não a data futura `hora_inicio_agendamento`). |
| **Serviço Finalizado** *(NOVO card)* | `created_at` em `ficha_status_historico` com `status_novo='Finalizado'`. **Fallback** análogo. | idem | |
| **Finalizado e Pago pelo Cliente** | data de finalização (acima) **AND** `fichas_de_servico.pagamento_realizado=true` | join | |
| **Pago ao Prestador** *(NOVO card)* | `data_pagamento_realizada` | `transacoes_financeiras` | Filtros via `ficha_id`. |
| **Valor Total OS** | data de finalização (sum `valor_total` das fichas finalizadas + pagas no período) | join | Conceito: "valor de OS efetivamente fechada". |
| **Valor Mão de Obra** *(NOVO card)* | data de finalização, sum `COALESCE(valor_final_mao_obra, valor_mao_obra)` | join | |
| **Valor Peças** *(NOVO card)* | data de finalização, sum `COALESCE(valor_final_pecas, valor_pecas)` | join | |

### Observação sobre KPIs de Valor — divergência conceitual a sinalizar

Existem **três conceitos distintos** de valor:
1. **Vendido**: `valor_total` no `created_at` da ficha (oferta inicial).
2. **Finalizado**: `valor_total` ancorado na data de finalização (encerramento).
3. **Pago pelo cliente**: ancorado em pagamento (mas não temos timestamp dedicado no banco — `pagamento_realizado` é boolean sem data).

**Decisão**: usar conceito **Finalizado** (ancora em data de finalização + `pagamento_realizado=true`), pois é o que tem evento confiável e alinha com regras financeiras já em uso (memória `mem://finance/scheduling-and-visibility-logic`). Documentado na UI via tooltip.

### Pontos sinalizados que dependem de validação adicional

1. **Conversas Iniciadas = FS Criadas** com a estrutura atual. Se quiser distinguir conceitualmente, será necessário um evento separado (ex.: criar tabela de "conversas iniciadas") — fora do escopo (não alterar schema).
2. **Fallback de histórico** para fichas pré-fevereiro/2026: usar `created_at` da ficha apenas como aproximação. Pode subcontar levemente em períodos antigos. Aceitável pois cobertura é boa para 2026.
3. **Pago pelo Cliente sem timestamp**: a coluna `pagamento_realizado` é booleana. Usaremos a data de finalização como âncora. Se quiser ancorar na data efetiva do pagamento Asaas, seria necessário consultar `contas_receber.data_pagamento` ou `transacoes_financeiras.data_pagamento_realizada` do lado cliente — sinalizado.

## 5. Modos de comparação (substituem o atual)

### A — Mesmo período do mês anterior (default)
Subtrai 1 mês mantendo dias. Quando dia não existe (29/fev), faz **clamp** ao último dia do mês.

### B — Média do mesmo período dos 3 meses anteriores
Calcula M-1, M-2, M-3 com mesmos dias, executa 3 queries por KPI, soma e divide por 3. Variação = `(atual - média) / média`.

### C — Personalizada
Usuário escolhe intervalo via popover de calendário.

## 6. Implementação técnica (sem alterar tabelas)

### 6.1 `src/hooks/useOperationalKPIs.ts` — reescrita
- Tipo novo: `ComparisonMode = 'previous-month' | 'avg-3-months' | 'custom'` + `comparisonRange?`.
- Função `getComparisonRanges(from, to, mode, customRange)` retorna `{from, to}[]` (1 ou 3 períodos).
- Função `runKpiQueriesForWindow(from, to, filters)` reutilizável para cada janela.
- **Conversas Iniciadas**: passa a usar a mesma query de FS Criadas (count em `fichas_de_servico` por `created_at`). RPC antiga ignorada (mantida no banco intocada).
- **KPIs ancorados em histórico** (Visita Agendada, Serviço Agendado, Serviço Finalizado): query em `ficha_status_historico` com inner join em `fichas_de_servico` (para herdar filtros de categoria/prestador/cliente). Pega `MIN(created_at)` por `ficha_id` agrupado em JS para deduplicar (caso ficha entre/saia do status várias vezes). Soma com fallback (fichas pré-histórico cujo status atual já bate).
- **Pago ao Prestador**: query direta em `transacoes_financeiras` por `data_pagamento_realizada`, com inner join em `fichas_de_servico` para herdar filtros.
- **Variação**: para modo "média 3 meses" usa média; para os outros usa valor único.

### 6.2 Novo componente `src/components/dashboard/ComparisonModeSelector.tsx`
Dropdown com 3 opções + popover de calendário quando "Personalizada".

### 6.3 `src/components/dashboard/Header.tsx`
Aceita props `comparisonMode`, `comparisonRange`, `onComparisonChange`. Renderiza `ComparisonModeSelector` ao lado do dropdown de período.

### 6.4 `src/pages/Dashboard.tsx`
Estado novo: `comparisonMode`, `comparisonRange`. Passa para `Header` e `DashboardContent`.

### 6.5 `src/components/dashboard/DashboardContent.tsx`
Recebe `comparisonMode`, `comparisonRange`, propaga para `OperationalKPIsSection` e `ConversionRatesSection`.

### 6.6 `src/components/dashboard/OperationalKPIsSection.tsx`
- Recebe props de comparação.
- Adiciona 4 cards novos: **Serviço Finalizado**, **Pago ao Prestador**, **Valor Mão de Obra**, **Valor Peças**.
- Grid passa para `lg:grid-cols-5` (2 linhas) para acomodar 10 cards.
- Cada `KPICard` ganha tooltip com explicação da fonte/evento usado.

### 6.7 `src/components/dashboard/ConversionRatesSection.tsx`
Já consome `useOperationalKPIs` indireto via `DashboardContent`. Garantir que recebe os mesmos números corrigidos (inner join, dedup) — sem mudar API do componente.

### 6.8 `documentação/dashboard.md` + memória
Atualizar regra de cada KPI.

## 7. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useOperationalKPIs.ts` | Reescrito: novos eventos âncora, comparação multi-modo, novos KPIs |
| `src/components/dashboard/ComparisonModeSelector.tsx` | **Novo** |
| `src/components/dashboard/Header.tsx` | Render do selector |
| `src/pages/Dashboard.tsx` | Estado `comparisonMode`/`comparisonRange` |
| `src/components/dashboard/DashboardContent.tsx` | Propaga props |
| `src/components/dashboard/OperationalKPIsSection.tsx` | Novos cards, tooltips |
| `src/components/dashboard/KPICard.tsx` | Suporte a `tooltip` opcional |
| `documentação/dashboard.md` | Documentação atualizada |
| `mem://features/operational-kpis-definitions` | Memória atualizada |

**Sem migration. Sem coluna nova. Sem RPC nova. Sem alterar tabelas.**

## 8. Garantias de não quebrar dados/comportamento existente

- **Nenhuma escrita no banco**. Apenas leitura.
- RPC `calculate_conversas_iniciadas` permanece no banco (não removida) — caso algo externo dependa dela, continua funcionando.
- Fichas antigas sem histórico mantêm aproximação via `created_at` (fallback explícito).
- Filtros (categoria/prestador/cliente) preservados em todas as queries via inner joins.
- Variação `null` quando não há base de comparação (mantido).
- Tipo `OperationalKPIs` ganha campos novos; campos existentes mantêm nome (com origem corrigida) — componentes consumidores continuam funcionando.
- Fuso horário: nenhuma manipulação de hora — todas as datas tratadas em UTC com `toISOString()` como hoje.

