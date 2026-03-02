# Documentação técnica — Dashboard TV

## Objetivo desta tela
O `DashboardTV` é um painel de acompanhamento contínuo para monitor (TV), com foco em:
- leitura rápida de metas e desempenho operacional;
- atualização automática em intervalos regulares;
- alertas sonoros/visuais para eventos relevantes;
- layout livre de widgets (edição visual por usuário).

---

## Fluxo geral

1. **Página** `src/pages/DashboardTV.tsx`
   - Mantém estado de filtros de período/comparação.
   - Chama `useDashboardTV(filters)` para dados consolidados.
   - Carrega listas auxiliares (`prestadores`, `categorias`) via `useQuery`.
   - Renderiza widgets dinâmicos em canvas livre.

2. **Hook de dados** `src/hooks/useDashboardTV.ts`
   - Resolve período atual + período de comparação.
   - Executa múltiplas queries em paralelo (`Promise.all`).
   - Agrega indicadores, metas, variações e métricas de tempo.
   - Retorna payload único (`TVDashboardData`) para a tela.

3. **Layout visual** `src/contexts/TVFreeformContext.tsx`
   - Define `DEFAULT_WIDGETS` (posições/tamanhos iniciais).
   - Salva cache local em `localStorage`.
   - Carrega e salva layout padrão na tabela `tv_layouts` por usuário.

---

## Dados: o que é calculado e de onde vem

## 1) KPIs principais
### Métricas
- `receitaTotal`, `lucroBruto`, `servicosFechados`, `ticketMedio`, `margemMedia`, `pagos`.

### Fonte
- Tabela `fichas_de_servico` com filtros:
  - `status = 'Finalizado'`
  - `pagamento_realizado = true`
  - intervalo por `created_at`

### Regras
- `receitaTotal` = soma de `valor_total`.
- `lucroBruto`:
  - se houver `valor_mao_obra/valor_pecas`, usa `receita - mão de obra - peças`;
  - senão aplica fallback de margem estimada (`receita * 0.23`).

### Por que
- painel TV precisa de valor simples e direto, priorizando velocidade de leitura;
- fallback evita zerar lucro quando dados de custo não foram preenchidos.

---

## 2) Funil operacional/comercial
### Métricas
- `cliquesAnuncios`, `conversasIniciadas`, `fsCriadas`, `agendados`, `executados`, `pagos`.

### Fontes
- `google_ads_metrics` (`cliques`).
- RPC `calculate_conversas_iniciadas`.
- `fichas_de_servico` para contagens por status.

### Regras
- `agendados` soma:
  - fichas com status em `['Agendado', 'Visita Técnica']`
  - + `servicosFechados` (pagos/finalizados)
- `executados`: status em `['Em andamento', 'Finalizado']`.

### Por que
- a TV privilegia acompanhamento do avanço total da operação; por isso parte do funil é “expandida” para incluir etapas já concluídas.

---

## 3) Taxas de conversão exibidas
Calculadas em `DashboardTV.tsx` a partir do payload do hook:
- `taxaAgendFS = agendados / fsCriadas`
- `taxaPagosFS = pagos / fsCriadas`
- `taxaPagosAgend = pagos / agendados`
- `taxaPagosCliques = pagos / cliquesAnuncios`
- `taxaConvCliques = conversasIniciadas / cliquesAnuncios`
- `taxaExecAgend = executados / agendados`
- `conversaoTotal` usa `pagos / cliques`, com fallback para `pagos / conversas`.

**Motivo de implementação:** separar “coleta/consolidação” (hook) de “apresentação” (página), facilitando ajustes visuais sem refazer queries.

---

## 4) Metas
### Fonte
- Tabela `dashboard_metas` com `tipo = 'diarias'`.

### Uso
- metas de receita, quantidade e taxas abastecem widgets e barras/progresso.
- também alimentam gatilhos de celebração.

### Celebração
- Quando `receitaTotal >= metas.valor_os`, dispara:
  - mensagem de celebração;
  - som (`playCelebrationFanfare`);
  - trava de repetição por dia em `localStorage` (`tv-celebration-log-v1`).

### Por que
- evita comemoração repetida em cada refresh.

---

## 5) Métricas de tempo
### Fonte
- `ficha_status_historico` (eventos de mudança de status).
- `fichas_de_servico` para ciclo completo.

### Exemplos
- FS → Agendado
- Agendado → Em andamento/Executado
- Ciclo completo

### Por que
- tempo de processo precisa olhar para transições de status, não apenas estado final.

---

## 6) Conversas abertas e SLA de resposta
### Fonte
- `fichas_de_servico` (fichas com status não fechado).
- `mensagens` para encontrar última mensagem por cliente.

### Regras
- exclui status fechados (`Agendado`, `Finalizado`, `Perdido`, `Garantia`, `Não foi adiante`).
- ordena por maior tempo sem resposta.
- considera “aguardando resposta” quando última mensagem não é da operação (`atendente`, `bot`, número institucional).

### Por que
- monitorar backlog de atendimento e urgência em tempo real.

---

## Atualização, polling e UX para monitor

- `useDashboardTV`:
  - `staleTime: 300000` (5 min)
  - `refetchInterval: 600000` (10 min)
- Há contador regressivo e marca de última atualização na tela.
- Skeletons enquanto carrega.
- Alertas sonoros:
  - `playPaymentDing` quando aumenta quantidade de pagos.
  - `playCelebrationFanfare` em batimento de meta.

**Razão:** equilíbrio entre atualidade e custo de consulta, mantendo leitura contínua em TV.

---

## Layout livre (Freeform)

### Como funciona
- Cada widget possui `id`, posição (`x`, `y`), dimensão (`width`, `height`), `zIndex`, lock e modo de escala.
- Edição permite arrastar, redimensionar, ocultar e salvar.

### Persistência
1. **Cache local imediato** (rápido): `localStorage`.
2. **Persistência por usuário** (durável): tabela `tv_layouts`.
   - carrega layout default no mount;
   - ao sair do modo edição, salva automaticamente.

### Por que
- TV precisa startup rápido (cache local).
- Times diferentes precisam layout consistente por usuário/ambiente (persistência no banco).

---

## Pontos críticos para auditoria e caça a bugs

1. **Semelhança entre indicadores pode confundir**
   - ex.: `agendados` no TV inclui finalizados pagos; validar definição antes de comparar com outros relatórios.

2. **Janelas de comparação avançadas**
   - modos como `business_days_cumulative`, `weekday_compare`, `specific_day` alteram o range atual automaticamente.
   - divergências normalmente vêm de interpretação do período, não de erro de soma.

3. **Métricas de tempo com limites (`limit(200)`)**
   - em alto volume, pode subamostrar eventos mais antigos no período.

4. **Travas de celebração no navegador**
   - celebração diária usa `localStorage`; limpando storage, comportamento reinicia.

5. **Dependência de qualidade de preenchimento**
   - sem `valor_mao_obra` e `valor_pecas`, lucro usa estimativa de 23%.

---

## Checklist de investigação rápida

1. Confirmar filtro de período/comparação ativo.
2. Confirmar se há filtro por prestador/categoria.
3. Validar se o KPI usa `created_at` ou histórico de status.
4. Conferir se a divergência é definição (ex.: agendados expandido) e não cálculo.
5. Checar se layout/widget está oculto por configuração do usuário.
