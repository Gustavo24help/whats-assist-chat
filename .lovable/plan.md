## Objetivo
Dashboard operacional dedicado para medir recompra, LTV/CAC, cohorts trimestrais e influência dos prestadores na recorrência (ou sumiço) dos clientes da 24help.

## Esclarecimentos confirmados
- **B2B/B2C**: `customers` não tem `cnpj`. Vamos derivar do campo `cpf`: se o texto tiver **>11 dígitos numéricos** (após remover pontuação), é CNPJ → **B2B**. Caso contrário → **B2C** (inclui clientes sem documento).
- **Dedupe de cliente** (mesma pessoa/empresa contada uma vez):
  - B2B: mesmo `cnpj` OU mesmo `telefone` OU mesmo `nome` normalizado.
  - B2C: mesmo `cpf` OU mesmo `telefone`. Nome sozinho NÃO funde.
- **NPS**: `nps_respostas.nota` (0–10), juntado por `ficha_id` ↔ `customer_services.ficha_id`. Classificação NPS: ≥9 promotor, 7–8 neutro, ≤6 detrator.
- **Serviço válido**: `status IN ('finalizado','em_garantia')` (mesmo critério de `recalc_customer_aggregates`).
- **Valor do serviço**: `COALESCE(final_value, quoted_value, 0)`.
- **CAC**: R$ 80 fixo por cliente novo; R$ 0 nas recompras.

## Rota e navegação
- Nova página `src/pages/DashboardRecorrencia.tsx` + rota `/dashboard/recorrencia` em `App.tsx`, protegida por `ProtectedRoute` com mesmas roles do Dashboard atual (admin, chefe, admin_ti).
- Item no sidebar dentro do grupo de Dashboards.

## Camada de dados (Supabase)
Para evitar trazer base inteira ao front, criar **uma migration** com helpers + RPCs:

1. **Função `public.customer_dedup_key(customer customers)`** (immutable): retorna a chave canônica do cliente.
   - Se `length(regexp_replace(cpf,'\D','','g')) > 11` → `'cnpj:' || digits` (B2B por CNPJ).
   - Senão se `cpf` válido (11 dígitos) → `'cpf:' || digits`.
   - Senão se `phone` → `'tel:' || digits(phone)`.
   - Senão → `'id:' || id` (não funde).
2. **Função `public.customer_segment(customer customers)`** → `'B2B'` | `'B2C'`.
3. **View `public.v_customer_canonical`**: agrupa `customers` por `customer_dedup_key`, expondo um `canonical_id` (menor `id`) + nome, segmento, telefone, primeira/última data.
4. **View `public.v_customer_services_enriched`**: `customer_services` + `canonical_id` + `segmento` + `valor = COALESCE(final_value, quoted_value, 0)` + `is_valid = status IN ('finalizado','em_garantia')` + `nps_nota` (LEFT JOIN `nps_respostas` por `ficha_id`).
5. **RPC `public.recurrence_summary(p_start, p_end, p_segment)`**: retorna JSON com todos os cards executivos + série mensal + buckets de tempo até recorrência.
6. **RPC `public.recurrence_cohorts(p_segment)`**: cohorts trimestrais (Jan–Mar/Abr–Jun/Jul–Set/Out–Dez), com retenção 30/60/90/180/365 e LTV médio. Janelas cujo prazo ainda não fechou retornam `NULL` (não 0).
7. **RPC `public.recurrence_provider_first(p_segment)`**: por prestador do **primeiro** serviço — clientes iniciados, voltaram, taxa, LTV médio, receita recorrente, NPS médio.
8. **RPC `public.recurrence_provider_last_dormant(p_segment)`**: por prestador do **último** serviço de recorrentes que viraram `dormindo_180d`/`perdido_365d`.
9. **RPC `public.recurrence_reactivation_tags(p_segment, p_limit, p_offset)`**: lista paginada com tags (alerta_90d, dormindo_180d, perdido_365d, promotor_sem_recompra, alto_valor_sem_recompra) + cliente, último prestador, dias sem serviço, LTV, NPS.

Todas as RPCs `SECURITY DEFINER`, `SET search_path = public`, `STABLE`, com `GRANT EXECUTE TO authenticated`.

## Front-end (TypeScript + shadcn + Recharts)

```
src/
  pages/DashboardRecorrencia.tsx
  hooks/
    useRecurrenceSummary.ts
    useRecurrenceCohorts.ts
    useRecurrenceProviders.ts
    useRecurrenceReactivation.ts
  components/dashboard/recorrencia/
    FiltrosBar.tsx          (período + B2C/B2B/Todos + segmento opcional)
    CardsExecutivos.tsx     (15 cards do escopo)
    GraficoRecorrenciaMensal.tsx  (BarChart + LineChart Recharts)
    CohortsTrimestrais.tsx  (heatmap em tabela com gradiente)
    TempoAteRecorrencia.tsx (barras por bucket)
    NpsRecorrencia.tsx      (cards + barras promotores/neutros/detratores; estado vazio se sem dados)
    TagsReativacao.tsx      (DataTable paginada com filtro por tag)
    PrestadoresRecorrencia.tsx (3 tabelas: 1º prestador que retém, 1º prestador que perde, último prestador antes do sumiço)
```

- Cache via React Query (`@tanstack/react-query` já no app), invalidando por mudança de filtro.
- Estados: loading (skeletons shadcn), empty, error (toast + retry).
- Tooltips em cada KPI explicando a fórmula.
- Layout denso, mesmo padrão visual de `src/pages/Dashboard.tsx` (Plus Jakarta Sans, bg neutro, cards com `border` + `shadow-sm`, paleta brand).
- Linguagem dos prestadores usa "indício" / "tendência", **nunca** causalidade.

## Filtros globais (topo)
- Período (presets: 30d, 90d, este trimestre, este ano, ano anterior, customizado).
- Segmento: Todos / B2C / B2B.
- Prestador (autocomplete, opcional).
- Categoria/SKU (autocomplete, opcional — usa `sku`).
- Os filtros alimentam todas as 4 RPCs.

## Tags de reativação (regras)
- `recorrente_alerta_90d`: `is_valid_count >= 2` AND `last_valid_service_at < now() - 90d` AND ≥ now()-180d.
- `recorrente_dormindo_180d`: idem 180–365d.
- `recorrente_perdido_365d`: idem > 365d.
- `promotor_sem_recompra`: `is_valid_count = 1` AND NPS ≥ 9.
- `alto_valor_sem_recompra`: `is_valid_count = 1` AND `valor_primeiro_servico > avg_ticket_global * 1.5` AND `created_at < now() - 90d`.

## Critérios de aceite (mapeados ao escopo)
- Filtro Todos/B2C/B2B no topo aplicado em todos os blocos. ✓
- B2B = >11 dígitos no `cpf`; B2C = ≤11 dígitos ou nulo. ✓
- Dedupe usa CNPJ/CPF/telefone (B2B aceita nome). ✓
- Recorrência mensal = clientes do mês com qualquer serviço **anterior ao período**, não só 2º serviço. ✓
- Cliente recorrente = ≥2 serviços válidos no histórico. ✓
- Receita recorrente = soma dos serviços do período feitos por clientes recorrentes. ✓
- CAC R$80 fixo em LTV líquido e LTV/CAC. ✓
- Cohorts trimestrais pelo primeiro serviço válido, com janelas incompletas exibindo `—`. ✓
- Seção de prestadores: primeiro prestador (voltou × não voltou) + último prestador antes do sumiço para dormentes/perdidos. ✓
- NPS apenas se houver dado real; sem dado → empty state profissional. ✓
- Não quebra dashboards existentes. ✓
- Termos de domínio em português na UI. ✓

## Detalhes técnicos
- Migrations em **2 arquivos** separados (helpers/views primeiro, depois RPCs) para revisão clara.
- Cada RPC é determinística e pode rodar em poucos segundos sobre a base atual (`customer_services` ~milhares de linhas).
- Cohorts e somas pesadas resolvidas no Postgres (RPCs); o front só plota.
- Sem `pg_dump`, sem dados fictícios.
- Sem alterações em tabelas existentes (apenas leitura). Só `CREATE FUNCTION/VIEW/RPC`.
- Edge functions: nenhuma — tudo via RPC do PostgREST.

## Fora do escopo desta entrega
- Editar `customers` para adicionar coluna `cnpj` (a derivação por dígitos cobre o caso).
- Exportar relatórios em PDF/Excel (pode entrar em iteração seguinte).
- Margem real por serviço (não há campo confiável em `customer_services`).

Quando aprovado, sigo com: (1) migration de views/funções, (2) migration de RPCs, (3) hooks + página + componentes.