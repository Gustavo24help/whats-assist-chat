## Refatoração do Funil de Conversão

Objetivo: remover dependência de dados do Google Ads (Impressões/Cliques) e exibir um funil enxuto de 4 etapas baseado nos dados operacionais já existentes, respeitando o filtro de período do dashboard.

### Etapas do novo funil

1. **Conversas Iniciadas / FS Criadas** — usa `fsCriadas` (mesmo número de hoje, apenas relabel).
2. **FS com Orçamento** — nova métrica `fsComOrcamento`: contagem **distinta** de fichas (criadas no período) que satisfaçam **uma das condições**:
   - existe registro em `orcamentos` cujo `ficha_nome` = ficha.id, **OU**
   - `fichas_de_servico.valor_total > 0` E `formulario_orcamento_data_primeiro_envio IS NOT NULL`.
3. **Serviços Agendados (bruto)** — nova métrica `servicoAgendadoBruto`: usa `fetchFichasComEvento('Agendado', ...)` **sem** excluir status atual `Perdido` (conta todos que algum dia foram agendados, mesmo que perdidos depois).
4. **Serviços Finalizados** — usa `servicoFinalizado` existente.

### Mudanças técnicas

**`src/hooks/useOperationalKPIs.ts`**
- Adicionar campos a `WindowMetrics`: `fsComOrcamento`, `servicoAgendadoBruto`.
- Adicionar a `OperationalKPIs` (e `FALLBACK_OPERATIONAL_KPIS`) os mesmos campos + variações.
- Em `fetchMetricsForWindow`:
  - Continuar chamando `fetchFichasComEvento('Agendado', ..., ['Perdido'])` para **manter** `servicoAgendado` atual (usado em outras seções como `ConversionRatesSection` e funil legado).
  - Adicionar nova chamada `fetchFichasComEvento('Agendado', ..., [])` → `servicoAgendadoBruto`.
  - Adicionar query nova para `fsComOrcamento`:
    1. Buscar IDs de fichas criadas no período (já temos `fsCriadasRes` via head/count — trocar para `select('id, valor_total, formulario_orcamento_data_primeiro_envio')` quando precisarmos da lista; manter o count separado para preservar `fsCriadas`).
    2. Buscar `orcamentos.ficha_nome` no mesmo período (ou via IN nas fichas).
    3. Aplicar regra: ficha qualifica se está em `orcamentos` OU `valor_total > 0 && formulario_orcamento_data_primeiro_envio != null`.
    4. Contar distintos.
- **Salvaguarda de dados**: nenhuma métrica existente é alterada — apenas adicionamos novas. `servicoAgendado` (líquido, sem Perdido) continua igual para não quebrar `ConversionRatesSection`, gráficos e KPIs operacionais.

**`src/components/dashboard/DashboardContent.tsx`**
- Remover do `funnelData` os passos `impressions` e `clicks`.
- Remover `useGoogleAdsMetrics` e `isLoadingAds` deste componente (Google Ads continua disponível na seção `GoogleAdsSection`, sem mudança).
- Novo `funnelData` com 4 itens:
  - `Conversas Iniciadas / FS Criadas` → `kpiData.fsCriadas`
  - `FS com Orçamento` → `kpiData.fsComOrcamento`
  - `Serviços Agendados` → `kpiData.servicoAgendadoBruto`
  - `Serviços Finalizados` → `kpiData.servicoFinalizado`
- Cores: manter paleta brand (green → yellow → coral) para preservar o visual atual.

**`src/components/dashboard/ConversionFunnel.tsx`**
- Nenhuma mudança estrutural. O componente já é genérico e renderiza N etapas com taxa entre etapas. Apenas receberá 4 itens em vez de 5.

### Garantias de não-regressão

- `servicoAgendado` (líquido) **permanece intacto** → `ConversionRatesSection`, gráficos e métricas operacionais não mudam.
- `useGoogleAdsMetrics` **não é removido** do projeto — apenas deixa de alimentar o funil. `GoogleAdsSection` continua funcionando normalmente quando os dados voltarem do Make.com.
- Filtro de período (`period`, `customDateRange`, `comparisonMode`, `comparisonRange`) continua sendo propagado pelo hook `useOperationalKPIs`, então as 4 etapas respeitam a mesma janela.
- Nenhuma migração de banco de dados necessária.

### Arquivos a modificar

- `src/hooks/useOperationalKPIs.ts`
- `src/components/dashboard/DashboardContent.tsx`