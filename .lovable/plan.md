

# Plano: Corrigir logica de dados dos 4 KPIs de Metas de Agendamento

## Contexto

Os 4 KPIs existem no Dashboard TV (`meta-diaria-os`, `meta-mensal-os`, `meta-diaria-receita`, `meta-mensal-receita`). A logica de dados atual tem dois problemas:

1. **Contagem mensal nao exclui "Perdido"**: A query em `metasIndependentes` conta todas as fichas que passaram por "Agendado" no mes, mesmo que o status atual seja "Perdido"
2. **Metas vem de `dashboard_metas` com calculo fixo (diaria × 22)**: O usuario quer metas por dia na tabela `daily_goals`, com meta mensal = soma das metas diarias do mes

## Mapeamento de status

O usuario menciona "Agendamento" mas o valor real no banco e `Agendado` (confirmado via query). O codigo atual ja usa o valor correto.

A tabela `ficha_status_historico` ja registra quando cada status mudou (campo `data_inicio`), entao nao precisa criar trigger.

## Etapa 1: Criar tabela `daily_goals`

```sql
CREATE TABLE public.daily_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  meta_agendamento_quantidade integer NOT NULL DEFAULT 0,
  meta_agendamento_valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;

-- Admins podem gerenciar metas
CREATE POLICY "Admins podem ver metas diarias"
  ON public.daily_goals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem inserir metas diarias"
  ON public.daily_goals FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar metas diarias"
  ON public.daily_goals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Atendentes e supervisores podem ver
CREATE POLICY "Atendentes podem ver metas diarias"
  ON public.daily_goals FOR SELECT TO authenticated
  USING (true);
```

A tabela `dashboard_metas` **nao sera alterada** — ela continua servindo os outros KPIs do TV.

## Etapa 2: Corrigir query `metasIndependentes` em `DashboardTV.tsx`

Alterar a query nas linhas 196-254 para:

**KPI 1 e 3 (Diario)**: Sem mudancas — ja busca corretamente fichas que entraram em "Agendado" hoje via `ficha_status_historico`.

**KPI 2 e 4 (Mensal)**: Apos obter `agendMesIds`, filtrar fichas cujo status atual ≠ "Perdido":
```ts
// Buscar status atual das fichas agendadas no mes
const { data: fichasMes } = await supabase
  .from('fichas_de_servico')
  .select('id, status, valor_total')
  .in('id', agendMesIds)
  .neq('status', 'Perdido');

const agendMesFiltrados = fichasMes || [];
agendamentosMes = agendMesFiltrados.length;
valorAgendMes = agendMesFiltrados.reduce((s, f) => s + (f.valor_total || 0), 0);
```

**Metas**: Adicionar queries para `daily_goals`:
```ts
const [metaDiaria, metasMes] = await Promise.all([
  supabase.from('daily_goals').select('*').eq('date', hoje).maybeSingle(),
  supabase.from('daily_goals').select('meta_agendamento_quantidade, meta_agendamento_valor')
    .gte('date', mesFromDate).lte('date', mesTo),
]);
```

Retornar no objeto:
```ts
metaDiariaQtd: metaDiaria?.meta_agendamento_quantidade ?? 0,
metaDiariaValor: metaDiaria?.meta_agendamento_valor ?? 0,
metaMensalQtd: soma das meta_agendamento_quantidade do mes,
metaMensalValor: soma das meta_agendamento_valor do mes,
```

## Etapa 3: Atualizar renderizacao dos 4 KPIs no DashboardTV.tsx

Mudar o `target` de cada gauge para usar `metasIndependentes` em vez de `metas` (dashboard_metas):

```ts
case 'meta-diaria-os':
  target = metasIndependentes?.metaDiariaQtd ?? 0;

case 'meta-mensal-os':
  target = metasIndependentes?.metaMensalQtd ?? 0;

case 'meta-diaria-receita':
  target = metasIndependentes?.metaDiariaValor ?? 0;

case 'meta-mensal-receita':
  target = metasIndependentes?.metaMensalValor ?? 0;
```

## Arquivos a editar
1. **Migracao SQL** — criar tabela `daily_goals`
2. **`src/pages/DashboardTV.tsx`** — corrigir query `metasIndependentes` (excluir Perdido no mensal, buscar metas de `daily_goals`) e atualizar targets dos 4 gauges

## O que NAO sera alterado
- Visual, layout, cores, fontes
- `dashboard_metas` (continua existindo para outros KPIs)
- `FinanceiroKPIs.tsx` (nao e relacionado a estes 4 KPIs)
- `useDashboardTV.ts` (nao afetado)
- Nenhum dado existente sera modificado

