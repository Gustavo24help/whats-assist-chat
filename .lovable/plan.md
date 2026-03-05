

## Plano: Limpar opções do widget rotativo e adicionar alerta "Orçamento Enviado"

### Análise atual

As 22 opções em `ROTATING_WIDGET_OPTIONS` (TVMonitorSettings.tsx) são mapeadas no `renderBlock` (DashboardTV.tsx). Cruzando os IDs:

**Funcionam** (têm case no renderBlock com dados reais):
- `conversas-abertas` — Alertas Ficha Criada > 20min
- `receita-total`, `lucro-bruto`, `servicos-fechados`, `conversao-total` — KPIs
- `funil-cliques`, `funil-conversas`, `funil-fs`, `funil-agendados`, `funil-executados`, `funil-pagos` — Funil
- `taxa-agend-fs`, `taxa-pagos-agend`, `taxa-pagos-fs`, `taxa-pagos-cliques`, `taxa-conv-cliques`, `taxa-exec-agend` — Taxas
- `tempo-resposta`, `tempo-orcamento`, `tempo-fs-agendado`, `tempo-agendado-exec`, `tempo-ciclo` — Tempos

**Resultado:** Todos os 22 IDs têm case correspondente no renderBlock. Todos dependem de `data` do hook `useDashboardTV`. Preciso verificar quais campos de tempo realmente retornam dados válidos do hook.

### O que será feito

**1. Verificar quais métricas de tempo retornam dados reais**
- Verificar no hook `useDashboardTV` se `tempoRespostaMin`, `tempoOrcamentoMin`, `tempoFSAgendadoDias`, `tempoAgendadoExecDias`, `tempoCicloCompletoDias` são realmente calculados
- Remover das opções rotativas os que não produzem dados

**2. Adicionar widget "Orçamento Enviado > 30min"**
- **Arquivo: `src/pages/DashboardTV.tsx`**
  - Na query de `conversasAbertas` (ou em query separada), buscar fichas com status "Orçamento Enviado" e calcular tempo no status
  - Criar `renderOrcamentoEnviadoWidget()` similar ao `renderOpenConversationsWidget()` mas filtrando por status "Orçamento Enviado" e threshold de 30 minutos
  - Adicionar case `'alerta-orcamento-enviado'` no `renderBlock`

- **Arquivo: `src/components/dashboard/tv/TVMonitorSettings.tsx`**
  - Adicionar entrada em `ROTATING_WIDGET_OPTIONS`: `{ id: 'alerta-orcamento-enviado', icon: '📋', label: 'Alertas Orçamento Enviado', description: 'Fichas em "Orçamento Enviado" há mais de 30 min' }`

**3. Thresholds fixos (20min e 30min)**
- Os tempos de 20 minutos (Ficha Criada) e 30 minutos (Orçamento Enviado) nos widgets do Dashboard TV serão **hardcoded**, independentes das configurações de alertas de status em Settings. Assim, mesmo que o usuário altere os limites na aba de configurações, o Dashboard TV sempre usará esses thresholds fixos.

**4. Garantir que o intervalo de alternância funcione**
- O código do `useEffect` (linhas 147-162) já implementa a rotação com `setInterval`. Verificar que a dependência `monitorSettings.rotatingWidgetItems` é uma referência estável (array de localStorage). O intervalo parece correto — reseta o index a 0 e recria o timer quando muda.

### Arquivos a editar
- `src/components/dashboard/tv/TVMonitorSettings.tsx` — adicionar opção, remover as que não funcionam (se houver)
- `src/pages/DashboardTV.tsx` — adicionar widget de alerta para "Orçamento Enviado", buscar dados necessários

