# Documentação técnica — Dashboard (Visão Executiva)

## Objetivo desta tela
O Dashboard em `src/pages/Dashboard.tsx` é a visão executiva voltada para acompanhamento diário/gerencial dos principais KPIs do funil e de marketing. Ele foi desenhado para:
- dar leitura rápida de saúde operacional;
- comparar período atual vs período anterior;
- permitir filtros por intervalo e por dimensões operacionais (categoria, prestador, cliente);
- facilitar auditoria de cálculo quando houver divergência de números.

---

## Arquitetura (de ponta a ponta)

1. **Página principal** (`Dashboard.tsx`)
   - Define período selecionado (`today`, `7days`, `30days`, `month`, `custom`).
   - Encapsula o conteúdo com `DashboardLayoutProvider`.
   - Renderiza `Header`, `Sidebar` e `DashboardContent`.

2. **Orquestração dos blocos** (`DashboardContent.tsx`)
   - Lê blocos ativos do contexto (`useDashboardLayout`).
   - Ordena blocos por `order`.
   - Renderiza seções conforme `id` do bloco:
     - `operational-kpis`
     - `conversion-funnel`
     - `google-ads`
     - `charts`
     - `export`

3. **Fontes de dados principais (hooks React Query)**
   - `useOperationalKPIs` (tabela `fichas_de_servico` + RPC `calculate_conversas_iniciadas`).
   - `useGoogleAdsMetrics` (tabela `google_ads_metrics`).

4. **Visualização**
   - Cards de KPI (`KPICard`) com valor, variação e ícone.
   - Blocos organizados por seção e com fallback para zero/nulo quando não há dados.

---

## Blocos e origem dos dados

### 1) Métricas Operacionais
**Componente:** `OperationalKPIsSection.tsx`  
**Hook:** `useOperationalKPIs.ts`

#### O que calcula
- `conversasIniciadas`
- `fsCriadas`
- `visitaAgendada`
- `servicoAgendado`
- `servicoAgendadoTotal` = `servicoAgendado + finalizadoPago`
- `finalizadoPago`
- `valorTotalOS`
- `taxaAgendamento` = `servicoAgendadoTotal / fsCriadas`
- `taxaFinalizacao` = `finalizadoPago / fsCriadas`
- Variações vs período anterior para cada métrica

#### De onde vem
- **`fichas_de_servico`**
  - contagens com `select('*', { count: 'exact', head: true })`;
  - soma de `valor_total` para finalizados pagos.
- **RPC `calculate_conversas_iniciadas`**
  - cálculo de conversas iniciado no banco.

#### Regras relevantes
- Sempre compara com período anterior equivalente (`getPreviousPeriodRange`).
- Se período anterior for zero, variação vira `null` (evita falso `+100%`).
- Filtro por `categoria_id`, `prestador_id`, `telefone_cliente` é aplicado de forma centralizada (`buildFichaQuery`).

#### Por que foi feito assim
- **Contagem por banco** evita trazer payload desnecessário.
- **RPC para conversas** centraliza regra de negócio em SQL (menos lógica duplicada no front).
- **Variação com `null`** evita interpretação errada de crescimento sem base histórica.

---

### 2) Funil de Conversão
**Componente:** `ConversionRatesSection` + `ConversionFunnel` (chamados por `DashboardContent.tsx`).

#### O que mostra
- Taxas de avanço no funil a partir de `fsCriadas`, `servicoAgendadoTotal` e `finalizadoPago`.

#### De onde vem
- Reaproveita dados de `useOperationalKPIs` já carregados no `DashboardContent`.

#### Por que foi feito assim
- Evita duplicidade de query.
- Garante consistência: cards operacionais e funil usam a mesma base numérica.

---

### 3) Google Ads
**Componente:** `GoogleAdsSection.tsx`  
**Hook:** `useGoogleAdsMetrics.ts`

#### O que calcula
- `impressoes`, `cliques`, `conversoes`, `custo`
- derivados: `ctr`, `cpa`, `clicksPerConversion`
- variação de cada métrica vs período anterior

#### De onde vem
- **`google_ads_metrics`** por `data_referencia`.
- Agregação feita no front (`aggregateMetrics`) após carregar o período.

#### Regras relevantes
- `periodDays` calcula tamanho da janela e busca o período imediatamente anterior.
- Fórmulas:
  - `ctr = cliques / impressoes * 100`
  - `cpa = custo / conversoes`
  - `clicksPerConversion = cliques / conversoes`
- Sem base anterior, variação = `null`.

#### Por que foi feito assim
- Métricas de Ads geralmente são aditivas e fáceis de agregar em memória.
- Permite ajustes de visualização sem alterar SQL a cada mudança pequena.

---

### 4) Layout/Blocos customizáveis
**Contexto:** `DashboardLayoutContext.tsx`

#### O que controla
- Quais blocos estão ativos (`enabled`)
- Ordem (`order`)
- Estado de customização (`isCustomizing`)

#### Persistência
- `localStorage` em `dashboard-layout-v1`.
- Merge com `DEFAULT_BLOCKS` para suportar blocos novos sem quebrar layouts antigos.

#### Por que foi feito assim
- Evita dependência de backend para preferências visuais.
- Mantém experiência individual por navegador/estação.

---

## Pontos de atenção para debug e qualidade

1. **Filtro temporal por `created_at`**
   - Quase todos os KPIs operacionais usam `created_at` da ficha.
   - Se o negócio quiser “quando o status aconteceu” (ex.: quando virou finalizado), será necessário migrar parte da lógica para `ficha_status_historico`.

2. **Variações `null` não são erro**
   - Indicam ausência de base anterior.
   - Na UI devem ser tratadas como “sem comparação” e não “0%”.

3. **Diferença de significado: `servicoAgendado` vs `servicoAgendadoTotal`**
   - `servicoAgendado`: só status Agendado.
   - `servicoAgendadoTotal`: agendado + finalizado/pago (usado no funil).
   - Divergência aqui é comum em análises rápidas.

4. **Fallbacks zerados**
   - Dashboard usa fallback com zeros para não exibir dados fake em loading/erro parcial.
   - Em incidentes, confirmar se está vendo fallback ou dado real.

---

## Checklist rápido para investigar número “estranho”

1. Confirmar período atual e período anterior aplicado no filtro.
2. Validar se filtro de categoria/prestador/cliente está ativo.
3. Conferir se a métrica está baseada em `created_at` (e não evento de status).
4. Reexecutar query equivalente no banco para a mesma janela.
5. Verificar se variação `null` foi interpretada corretamente na camada visual.
