
## Objetivo

Substituir o componente `ConversionFunnel` (atualmente com **dados hardcoded** e formato de barras horizontais) por um **funil visual real** que consome dados reais filtrados pelo período selecionado no Dashboard.

---

## Mudanças

### 1. Remover os 3 KPIs do topo
Apagar os cards "Conversão Total", "Maior Gargalo" e "Maior Melhoria" do componente `ConversionFunnel.tsx` (linhas 112-139), bem como toda a lógica auxiliar que existe só para esses cards (cálculo de `bottleneck`, `bestImprovement`, `totalConversion`, `sortedRates`, badges de "Gargalo" e "Melhoria" nas linhas).

### 2. Renomear etapas do funil
| Atual | Novo |
|---|---|
| Impressões | **Impressões** (Google Ads) |
| Cliques | **Cliques no anúncio** (Google Ads) |
| Conversas Iniciadas | **Conversas Iniciadas** (já existe) |
| Fichas de Serviço | **FS Criadas** |
| Serviços Fechados | **Serviços Finalizados** |

### 3. Ligar aos dados reais (com filtro de data)
Hoje os números são fixos (`125000`, `4875`, etc.). Vou:

- Tornar `ConversionFunnel` um **componente "burro"** que recebe `funnelData` por props.
- No `DashboardContent.tsx`, montar os dados a partir dos hooks que já existem **e que já respeitam o filtro de período/custom range**:
  - `useGoogleAdsMetrics(period, customDateRange)` → fornece `impressoes` e `cliques` + variações.
  - `useOperationalKPIs({ period, customRange, comparisonMode, comparisonRange })` → já está em uso no `DashboardContent` e fornece `conversasIniciadas`, `fsCriadas`, `servicoFinalizado` + `variations.*`.
- Passar como prop um array com `{ id, label, value, variation, color, bgColor }` para cada etapa.
- Eliminar `previousValue` (já temos `variation` calculada nos hooks; manter coerência com o resto do dashboard).

> Esses dois hooks **já recebem o `period` e `customDateRange` selecionados no header do Dashboard**, então o funil vai responder ao filtro automaticamente. Não há mudança em hook, query, RPC ou tabela — apenas consumo dos dados que já existem.

### 4. Visual em formato de funil real
Trocar o layout atual (linhas 142-256) — que são **barras horizontais alinhadas à esquerda** com largura proporcional — por um **funil simétrico centralizado** afunilando de cima para baixo:

- Cada etapa vira um **trapézio/segmento horizontal centralizado**, com largura proporcional ao valor (a maior = 100%, mínima de ~15% para legibilidade).
- O segmento de cima é o mais largo (Impressões) e cada próximo é mais estreito.
- Implementação leve sem libs novas: usar `div` com `clip-path: polygon(...)` para o efeito de afunilamento, ou flex centralizado com largura % calculada e bordas inclinadas. **Sem instalar dependência nova.**
- Dentro de cada segmento: nome da etapa + valor formatado (`125k`, `4.9k`, etc.).
- Ao lado/abaixo de cada segmento: badge de variação `+X%` / `-X%` (verde/vermelho) usando os ícones já importados (`TrendingUp`, `TrendingDown`).
- Entre dois segmentos consecutivos: pequeno indicador da **taxa de conversão da etapa N para N+1** (`Taxa: X.X%`), que já é calculada hoje.
- Cores: manter paleta de marca (brand-green → brand-yellow → brand-coral) já em uso, respeitando o `cardMode` do `useVisualMode` (white / tinted / gradient).
- Estados de loading: usar `Skeleton` enquanto qualquer um dos dois hooks está carregando.

### 5. Garantia de não quebrar nada (project-knowledge)
- **Não altero** `useOperationalKPIs`, `useGoogleAdsMetrics`, tabela `google_ads_metrics`, RPCs ou edge functions. Os dados continuam exatamente os mesmos no resto do app (KPIs operacionais, GoogleAdsSection, charts).
- **Não altero** `DashboardContent` em nada além do bloco `case 'conversion-funnel'` (montagem das props do funil).
- Preservo o comportamento atual de filtro de período: tudo no Dashboard já passa `period` + `customDateRange` para os hooks, e o funil agora usa os mesmos.
- Se algum dado retornar `0` ou `undefined` (ex: sem dados de Google Ads no período), o segmento mostra `0` e variação `—`, sem quebrar o cálculo de proporção (usa `Math.max(value, 1)` para evitar divisão por zero no width).

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/dashboard/ConversionFunnel.tsx` | Reescrita: remove 3 KPIs do topo, recebe dados via props, novo visual em funil. |
| `src/components/dashboard/DashboardContent.tsx` | Adicionar uso de `useGoogleAdsMetrics`, montar props e passar para `<ConversionFunnel data={...} isLoading={...} />`. |

Nenhuma mudança de banco, edge function ou hook.

---

## Resultado esperado

- Os 3 cards do topo (Conversão Total / Maior Gargalo / Maior Melhoria) somem.
- O funil aparece em formato afunilado real, com 5 etapas: **Impressões**, **Cliques no anúncio**, **Conversas Iniciadas**, **FS Criadas**, **Serviços Finalizados**.
- Cada etapa mostra valor real e variação real, respondendo ao filtro de data do Dashboard (Hoje / 7d / 30d / Mês / Custom).
- Demais blocos do Dashboard (Operacionais, Taxas de Conversão, Google Ads, Charts, Export) permanecem inalterados.
