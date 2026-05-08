import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  getDaysInMonth,
} from 'date-fns';
import { EXCLUDED_FICHAS_PAGAMENTO } from '@/lib/financeiroPrestador';

export type PeriodOption = 'today' | '7days' | '30days' | 'month' | 'custom';
export type ComparisonMode = 'previous-month' | 'avg-3-months' | 'custom';

export interface KPIFilters {
  period: PeriodOption;
  customRange?: { from: Date; to: Date };
  comparisonMode?: ComparisonMode;
  comparisonRange?: { from: Date; to: Date };
  categoriaId?: number;
  prestadorCpf?: string;
  clienteTelefone?: string;
}

export interface OperationalKPIs {
  // Quantidades
  conversasIniciadas: number;
  fsCriadas: number;
  fsComOrcamento: number;
  totalOrcamentos: number; // total de linhas em `orcamentos` no período
  mediaOrcamentosPorFS: number; // totalOrcamentos / fsComOrcamento
  visitaAgendada: number;
  servicoAgendado: number;
  servicoAgendadoBruto: number; // inclui fichas que viraram "Perdido" depois
  servicoAgendadoTotal: number; // legado p/ funil = agendado + finalizado/pago
  servicoFinalizado: number;
  finalizadoPago: number;
  pagoAoPrestador: number;
  // Valores
  valorTotalOS: number;
  valorMaoObra: number;
  valorPecas: number;
  // Financeiro (transações pagas no período)
  valorPagoPrestadores: number; // soma de valor_a_pagar_prestador
  valorLiquido24help: number; // soma de (valor_cliente_final - valor_a_pagar_prestador)
  margemBruta24help: number; // % = valorLiquido24help / valorPagoPrestadores * 100
  // Taxas
  taxaAgendamento: number;
  taxaFinalizacao: number;
  variations: {
    conversasIniciadas: number | null;
    fsCriadas: number | null;
    fsComOrcamento: number | null;
    totalOrcamentos: number | null;
    mediaOrcamentosPorFS: number | null;
    visitaAgendada: number | null;
    servicoAgendado: number | null;
    servicoAgendadoBruto: number | null;
    servicoFinalizado: number | null;
    finalizadoPago: number | null;
    pagoAoPrestador: number | null;
    valorTotalOS: number | null;
    valorMaoObra: number | null;
    valorPecas: number | null;
    valorPagoPrestadores: number | null;
    valorLiquido24help: number | null;
    margemBruta24help: number | null;
  };
}

// ============================================================
// Período principal
// ============================================================
const getDateRange = (
  period: PeriodOption,
  customRange?: { from: Date; to: Date },
) => {
  const now = new Date();

  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case '7days':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case '30days':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'month':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'custom':
      if (customRange) {
        return { from: startOfDay(customRange.from), to: endOfDay(customRange.to) };
      }
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    default:
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
  }
};

// Subtrai N meses preservando dia (com clamp p/ último dia se dia não existir)
const shiftMonthsClamped = (date: Date, monthsBack: number): Date => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const target = new Date(year, month - monthsBack, 1);
  const maxDay = getDaysInMonth(target);
  target.setDate(Math.min(day, maxDay));
  target.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
  return target;
};

// ============================================================
// Janelas de comparação (modos novos)
// ============================================================
export const getComparisonRanges = (
  from: Date,
  to: Date,
  mode: ComparisonMode,
  customRange?: { from: Date; to: Date },
): { from: Date; to: Date }[] => {
  switch (mode) {
    case 'previous-month':
      return [
        {
          from: startOfDay(shiftMonthsClamped(from, 1)),
          to: endOfDay(shiftMonthsClamped(to, 1)),
        },
      ];
    case 'avg-3-months':
      return [1, 2, 3].map((m) => ({
        from: startOfDay(shiftMonthsClamped(from, m)),
        to: endOfDay(shiftMonthsClamped(to, m)),
      }));
    case 'custom':
      if (customRange) {
        return [
          {
            from: startOfDay(customRange.from),
            to: endOfDay(customRange.to),
          },
        ];
      }
      // sem range definido → fallback "mês anterior"
      return [
        {
          from: startOfDay(shiftMonthsClamped(from, 1)),
          to: endOfDay(shiftMonthsClamped(to, 1)),
        },
      ];
    default:
      return [
        {
          from: startOfDay(shiftMonthsClamped(from, 1)),
          to: endOfDay(shiftMonthsClamped(to, 1)),
        },
      ];
  }
};

const calculateVariation = (current: number, previous: number): number | null => {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

// ============================================================
// Tipos internos
// ============================================================
type RawFichaFiltros = {
  categoriaId?: number;
  prestadorCpf?: string;
  clienteTelefone?: string;
};

type WindowMetrics = {
  conversasIniciadas: number;
  fsCriadas: number;
  fsComOrcamento: number;
  totalOrcamentos: number;
  mediaOrcamentosPorFS: number;
  visitaAgendada: number;
  servicoAgendado: number;
  servicoAgendadoBruto: number;
  servicoFinalizado: number;
  finalizadoPago: number;
  pagoAoPrestador: number;
  valorTotalOS: number;
  valorMaoObra: number;
  valorPecas: number;
  valorPagoPrestadores: number;
  valorLiquido24help: number;
  margemBruta24help: number;
};

const EMPTY_METRICS: WindowMetrics = {
  conversasIniciadas: 0,
  fsCriadas: 0,
  fsComOrcamento: 0,
  totalOrcamentos: 0,
  mediaOrcamentosPorFS: 0,
  visitaAgendada: 0,
  servicoAgendado: 0,
  servicoAgendadoBruto: 0,
  servicoFinalizado: 0,
  finalizadoPago: 0,
  pagoAoPrestador: 0,
  valorTotalOS: 0,
  valorMaoObra: 0,
  valorPecas: 0,
  valorPagoPrestadores: 0,
  valorLiquido24help: 0,
  margemBruta24help: 0,
};

// ============================================================
// Helpers de query
// ============================================================
function applyFichaFilters<Q extends { eq: (...args: any[]) => any }>(
  query: Q,
  filters: RawFichaFiltros,
): Q {
  let q: any = query;
  if (filters.categoriaId) q = q.eq('categoria_id', filters.categoriaId);
  if (filters.prestadorCpf) q = q.eq('prestador_id', filters.prestadorCpf);
  if (filters.clienteTelefone) q = q.eq('telefone_cliente', filters.clienteTelefone);
  return q;
}

// Para inner join via PostgREST: aplica filtros no recurso embutido
function applyEmbeddedFichaFilters<Q>(
  query: Q,
  filters: RawFichaFiltros,
  embedName = 'fichas_de_servico',
): Q {
  let q: any = query;
  if (filters.categoriaId) q = q.eq(`${embedName}.categoria_id`, filters.categoriaId);
  if (filters.prestadorCpf) q = q.eq(`${embedName}.prestador_id`, filters.prestadorCpf);
  if (filters.clienteTelefone) q = q.eq(`${embedName}.telefone_cliente`, filters.clienteTelefone);
  return q;
}

// Busca fichas DISTINCT que tiveram um determinado status no período
// (com fallback p/ created_at da ficha quando não há histórico).
//
// `excludeCurrentStatuses`: se a ficha atualmente está em algum desses status,
// ela é descartada da contagem mesmo que tenha tido o evento no período.
// Usado p/ regra de "Agendado": se a ficha foi agendada mas depois virou
// "Perdido", não contamos mais como agendamento.
async function fetchFichasComEvento(
  statusNovo: string,
  fromStr: string,
  toStr: string,
  filters: RawFichaFiltros,
  excludeCurrentStatuses: string[] = [],
): Promise<{
  fichas: Array<{
    id: string;
    valor_total: number | null;
    valor_mao_obra: number | null;
    valor_final_mao_obra: number | null;
    valor_pecas: number | null;
    valor_final_pecas: number | null;
    pagamento_realizado: boolean | null;
    status: string | null;
  }>;
}> {
  // 1. Busca eventos no histórico (inner join p/ herdar filtros da ficha)
  let histQ: any = supabase
    .from('ficha_status_historico')
    .select(
      `ficha_id,
       created_at,
       fichas_de_servico!inner(
         id,
         status,
         categoria_id,
         prestador_id,
         telefone_cliente,
         valor_total,
         valor_mao_obra,
         valor_final_mao_obra,
         valor_pecas,
         valor_final_pecas,
         pagamento_realizado,
         created_at
       )`,
    )
    .eq('status_novo', statusNovo)
    .gte('created_at', fromStr)
    .lte('created_at', toStr);
  histQ = applyEmbeddedFichaFilters(histQ, filters);
  const histRes = await histQ;
  const histRows = (histRes.data as any[]) || [];

  // Dedup por ficha_id
  const fichasFromHist = new Map<string, any>();
  for (const row of histRows) {
    const f = row.fichas_de_servico;
    if (!f) continue;
    if (!fichasFromHist.has(f.id)) {
      fichasFromHist.set(f.id, f);
    }
  }

  // 2. FALLBACK: fichas pré-histórico cujo status atual já é o procurado
  //    e cujo created_at caiu no período E que NÃO aparecem no histórico.
  let fbQ: any = supabase
    .from('fichas_de_servico')
    .select(
      'id, status, valor_total, valor_mao_obra, valor_final_mao_obra, valor_pecas, valor_final_pecas, pagamento_realizado, created_at',
    )
    .eq('status', statusNovo as any)
    .gte('created_at', fromStr)
    .lte('created_at', toStr);
  fbQ = applyFichaFilters(fbQ, filters);
  const fbRes = await fbQ;
  const fbRows = (fbRes.data as any[]) || [];

  // IDs já cobertos pelo histórico (qualquer evento, p/ não duplicar fichas
  // que tenham histórico fora do período mas que ainda têm status atual)
  const fichaIdsComQualquerHistorico = new Set<string>();
  if (fbRows.length > 0) {
    const idsToCheck = fbRows.map((f) => f.id);
    const chunks: string[][] = [];
    for (let i = 0; i < idsToCheck.length; i += 200) chunks.push(idsToCheck.slice(i, i + 200));
    for (const chunk of chunks) {
      const r = await supabase
        .from('ficha_status_historico')
        .select('ficha_id')
        .eq('status_novo', statusNovo)
        .in('ficha_id', chunk);
      for (const row of (r.data as any[]) || []) {
        fichaIdsComQualquerHistorico.add(row.ficha_id);
      }
    }
  }

  for (const f of fbRows) {
    if (fichasFromHist.has(f.id)) continue;
    if (fichaIdsComQualquerHistorico.has(f.id)) continue;
    fichasFromHist.set(f.id, f);
  }

  // 3. Aplica exclusão por status atual (regra de negócio):
  //    Ex.: para "Agendado", se a ficha hoje está como "Perdido", desconta.
  //    Status válidos a manter: Agendado, Em andamento, Finalizado, Garantia, Retorno.
  let fichas = Array.from(fichasFromHist.values());
  if (excludeCurrentStatuses.length > 0) {
    fichas = fichas.filter((f) => !excludeCurrentStatuses.includes(f.status));
  }

  return { fichas };
}

// ============================================================
// Coleta de métricas para uma janela
// ============================================================
async function fetchMetricsForWindow(
  from: Date,
  to: Date,
  filters: RawFichaFiltros,
): Promise<WindowMetrics> {
  const fromStr = from.toISOString();
  const toStr = to.toISOString();

  const [
    fsCriadasRes,
    fichasNoPeriodoRes,
    visitaFichas,
    agendadoFichas,
    agendadoBrutoFichas,
    finalizadoFichas,
    transacoesPagasRes,
    totalOrcamentosRes,
  ] = await Promise.all([
    // FS Criadas (= Conversas Iniciadas) — count direto
    (async () => {
      let q: any = supabase
        .from('fichas_de_servico')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fromStr)
        .lte('created_at', toStr);
      q = applyFichaFilters(q, filters);
      return await q;
    })(),
    // Fichas no período (com campos necessários para calcular fsComOrcamento e KPIs financeiros)
    (async () => {
      let q: any = supabase
        .from('fichas_de_servico')
        .select('id, valor_total, status, formulario_orcamento_data_primeiro_envio')
        .gte('created_at', fromStr)
        .lte('created_at', toStr);
      q = applyFichaFilters(q, filters);
      return await q;
    })(),
    // Visita Agendada — eventos de status (exclui fichas atualmente "Perdido")
    fetchFichasComEvento('Visita Técnica', fromStr, toStr, filters, ['Perdido']),
    // Serviço Agendado — eventos de status
    // Regra: se a ficha hoje está como "Perdido", o agendamento NÃO é contado.
    // Status válidos a manter: Agendado, Em andamento, Finalizado, Garantia, Retorno
    // (qualquer status que não seja "Perdido" preserva o agendamento histórico).
    fetchFichasComEvento('Agendado', fromStr, toStr, filters, ['Perdido']),
    // Serviço Agendado BRUTO — todos os eventos "Agendado" no período,
    // INCLUINDO fichas que depois viraram "Perdido". Usado no funil.
    fetchFichasComEvento('Agendado', fromStr, toStr, filters, []),
    // Serviço Finalizado — eventos de status (exclui fichas atualmente "Perdido")
    fetchFichasComEvento('Finalizado', fromStr, toStr, filters, ['Perdido']),
    // Transações financeiras vinculadas a fichas do período.
    // NÃO filtramos mais por status_pagamento_prestador / data_pagamento_realizada:
    // o KPI passa a refletir o financeiro da FS no mês em que foi criada,
    // independentemente de o repasse ao prestador já ter sido executado.
    // A consulta é feita em duas etapas (busca os IDs primeiro) para evitar
    // o erro `transacoes.created_at` no inner join e respeitar limites de URL.
    // Aqui devolvemos uma promessa "stub" com `data: null`; a busca real
    // acontece logo abaixo, depois que tivermos `fichasNoPeriodoRes`.
    Promise.resolve({ data: null as null }),
    // Total de orçamentos enviados no período (linhas em `orcamentos`).
    // A tabela usa `data_criacao` (não `created_at`) e referencia fichas por
    // `ficha_nome` (texto), não por `ficha_id`. Quando há filtros de ficha
    // fazemos a busca em duas etapas para evitar o inner join via FK inexistente.
    (async () => {
      const hasFichaFilters = !!(
        filters.categoriaId || filters.prestadorCpf || filters.clienteTelefone
      );

      if (!hasFichaFilters) {
        return await supabase
          .from('orcamentos')
          .select('id', { count: 'exact', head: true })
          .gte('data_criacao', fromStr)
          .lte('data_criacao', toStr);
      }

      // Com filtros: 1) buscar fichas elegíveis, 2) contar orçamentos cujo
      // ficha_nome esteja em chunks dessas fichas.
      let fq: any = supabase
        .from('fichas_de_servico')
        .select('id');
      fq = applyFichaFilters(fq, filters);
      const fr = await fq;
      const fichaIds: string[] = ((fr.data as Array<{ id: string }>) || []).map((f) => f.id);
      if (fichaIds.length === 0) return { count: 0 } as any;

      let total = 0;
      const chunkSize = 200;
      for (let i = 0; i < fichaIds.length; i += chunkSize) {
        const chunk = fichaIds.slice(i, i + chunkSize);
        const r = await supabase
          .from('orcamentos')
          .select('id', { count: 'exact', head: true })
          .in('ficha_nome', chunk)
          .gte('data_criacao', fromStr)
          .lte('data_criacao', toStr);
        total += r.count || 0;
      }
      return { count: total } as any;
    })(),
  ]);


  const fsCriadas = fsCriadasRes.count || 0;
  const visitaAgendada = visitaFichas.fichas.length;
  const servicoAgendado = agendadoFichas.fichas.length;
  const servicoAgendadoBruto = agendadoBrutoFichas.fichas.length;

  // ===== FS com Orçamento =====
  // Uma ficha conta se:
  //   (a) tem ao menos 1 registro em `orcamentos` (ficha_nome = ficha.id), OU
  //   (b) tem valor_total > 0 E formulario_orcamento_data_primeiro_envio != null
  //       (orçamento foi enviado ao cliente mesmo sem registro na tabela orcamentos)
  const fichasNoPeriodo = (fichasNoPeriodoRes.data as Array<{
    id: string;
    valor_total: number | null;
    status: string | null;
    formulario_orcamento_data_primeiro_envio: string | null;
  }>) || [];

  let fsComOrcamento = 0;
  if (fichasNoPeriodo.length > 0) {
    const fichaIds = fichasNoPeriodo.map((f) => f.id);
    // Busca em chunks para evitar URLs muito grandes
    const orcamentosFichaIds = new Set<string>();
    const chunkSize = 200;
    for (let i = 0; i < fichaIds.length; i += chunkSize) {
      const chunk = fichaIds.slice(i, i + chunkSize);
      const r = await supabase
        .from('orcamentos')
        .select('ficha_nome')
        .in('ficha_nome', chunk);
      for (const row of (r.data as Array<{ ficha_nome: string }>) || []) {
        orcamentosFichaIds.add(row.ficha_nome);
      }
    }

    fsComOrcamento = fichasNoPeriodo.filter((f) => {
      // Condição (a)
      if (orcamentosFichaIds.has(f.id)) return true;
      // Condição (b)
      if (
        Number(f.valor_total ?? 0) > 0 &&
        f.formulario_orcamento_data_primeiro_envio != null
      ) {
        return true;
      }
      return false;
    }).length;
  }

  // Para "Finalizado" - separar finalizadas vs finalizadas+pagas, e somar valores
  const servicoFinalizado = finalizadoFichas.fichas.length;
  const finalizadasPagas = finalizadoFichas.fichas.filter(
    (f) => f.pagamento_realizado === true,
  );
  const finalizadoPago = finalizadasPagas.length;

  // ===== Bloco Financeiro UNIFICADO =====
  // Base única: fichas com pagamento_realizado=true e status financeiro
  // (Finalizado/Garantia/Retorno) cujo created_at cai no período.
  // Garante a identidade contábil:
  //   Líquido 24help = Total OS − Pago a Prestador − Material pago pela 24help
  const STATUS_FINANCEIROS = new Set(['Finalizado', 'Garantia', 'Retorno']);
  const fichasFinanceiras = finalizadasPagas.filter(
    (f) => STATUS_FINANCEIROS.has((f.status as string) || '')
      && !EXCLUDED_FICHAS_PAGAMENTO.includes(f.id as string),
  );

  const valorTotalOS = fichasFinanceiras.reduce(
    (sum, f) => sum + Number(f.valor_total ?? 0),
    0,
  );
  const valorMaoObra = fichasFinanceiras.reduce(
    (sum, f) => sum + Number(f.valor_final_mao_obra ?? f.valor_mao_obra ?? 0),
    0,
  );
  const valorPecas = fichasFinanceiras.reduce(
    (sum, f) => sum + Number(f.valor_final_pecas ?? f.valor_pecas ?? 0),
    0,
  );

  // Buscar transações dessas mesmas fichas (1 transação por ficha — a primeira)
  let valorPagoPrestadores = 0;
  let somaValorMaterial24help = 0;
  let pagoAoPrestador = 0;

  if (fichasFinanceiras.length > 0) {
    const fichaIds = fichasFinanceiras.map((f) => f.id as string);
    const transMap = new Map<string, {
      valor_a_pagar_prestador: number | null;
      valor_material: number | null;
      material_pago_24help: boolean | null;
    }>();

    const CHUNK = 200;
    for (let i = 0; i < fichaIds.length; i += CHUNK) {
      const batch = fichaIds.slice(i, i + CHUNK);
      const r = await supabase
        .from('transacoes_financeiras')
        .select('ficha_id, valor_a_pagar_prestador, valor_material, material_pago_24help, created_at')
        .in('ficha_id', batch)
        .order('created_at', { ascending: true });
      const txs = (r.data as Array<{
        ficha_id: string | null;
        valor_a_pagar_prestador: number | null;
        valor_material: number | null;
        material_pago_24help: boolean | null;
      }>) || [];
      for (const t of txs) {
        if (!t.ficha_id) continue;
        // Mantém a PRIMEIRA transação por ficha (idempotente com order asc)
        if (!transMap.has(t.ficha_id)) {
          transMap.set(t.ficha_id, {
            valor_a_pagar_prestador: t.valor_a_pagar_prestador,
            valor_material: t.valor_material,
            material_pago_24help: t.material_pago_24help,
          });
        }
      }
    }

    for (const tx of transMap.values()) {
      valorPagoPrestadores += Number(tx.valor_a_pagar_prestador ?? 0);
      if (tx.material_pago_24help) {
        somaValorMaterial24help += Number(tx.valor_material ?? 0);
      }
    }
    pagoAoPrestador = transMap.size;
  }

  const valorLiquido24help =
    valorTotalOS - valorPagoPrestadores - somaValorMaterial24help;
  const margemBruta24help =
    valorTotalOS > 0
      ? Number(((valorLiquido24help / valorTotalOS) * 100).toFixed(1))
      : 0;

  // Total de orçamentos enviados no período (linhas em `orcamentos`)
  const totalOrcamentos = totalOrcamentosRes.count || 0;
  const mediaOrcamentosPorFS =
    fsComOrcamento > 0 ? Number((totalOrcamentos / fsComOrcamento).toFixed(2)) : 0;

  return {
    conversasIniciadas: fsCriadas, // mesma definição operacional
    fsCriadas,
    fsComOrcamento,
    totalOrcamentos,
    mediaOrcamentosPorFS,
    visitaAgendada,
    servicoAgendado,
    servicoAgendadoBruto,
    servicoFinalizado,
    finalizadoPago,
    pagoAoPrestador,
    valorTotalOS,
    valorMaoObra,
    valorPecas,
    valorPagoPrestadores,
    valorLiquido24help,
    margemBruta24help,
  };
}

// ============================================================
// Função principal
// ============================================================
async function fetchKPIs(filters: KPIFilters): Promise<OperationalKPIs> {
  const { from, to } = getDateRange(filters.period, filters.customRange);
  const mode: ComparisonMode = filters.comparisonMode || 'previous-month';
  const compRanges = getComparisonRanges(from, to, mode, filters.comparisonRange);

  const baseFilters: RawFichaFiltros = {
    categoriaId: filters.categoriaId,
    prestadorCpf: filters.prestadorCpf,
    clienteTelefone: filters.clienteTelefone,
  };

  const [current, ...comparisons] = await Promise.all([
    fetchMetricsForWindow(from, to, baseFilters),
    ...compRanges.map((r) => fetchMetricsForWindow(r.from, r.to, baseFilters)),
  ]);

  // Base de comparação = média (1 ou 3 valores)
  const avg = (key: keyof WindowMetrics): number => {
    if (comparisons.length === 0) return 0;
    const sum = comparisons.reduce((s, c) => s + (c[key] as number), 0);
    return sum / comparisons.length;
  };

  const safeMetrics: WindowMetrics = current ?? EMPTY_METRICS;

  const servicoAgendadoTotal = safeMetrics.servicoAgendado + safeMetrics.finalizadoPago;
  const taxaAgendamento =
    safeMetrics.fsCriadas > 0
      ? Number(((servicoAgendadoTotal / safeMetrics.fsCriadas) * 100).toFixed(1))
      : 0;
  const taxaFinalizacao =
    safeMetrics.fsCriadas > 0
      ? Number(((safeMetrics.finalizadoPago / safeMetrics.fsCriadas) * 100).toFixed(1))
      : 0;

  return {
    conversasIniciadas: safeMetrics.conversasIniciadas,
    fsCriadas: safeMetrics.fsCriadas,
    fsComOrcamento: safeMetrics.fsComOrcamento,
    totalOrcamentos: safeMetrics.totalOrcamentos,
    mediaOrcamentosPorFS: safeMetrics.mediaOrcamentosPorFS,
    visitaAgendada: safeMetrics.visitaAgendada,
    servicoAgendado: safeMetrics.servicoAgendado,
    servicoAgendadoBruto: safeMetrics.servicoAgendadoBruto,
    servicoAgendadoTotal,
    servicoFinalizado: safeMetrics.servicoFinalizado,
    finalizadoPago: safeMetrics.finalizadoPago,
    pagoAoPrestador: safeMetrics.pagoAoPrestador,
    valorTotalOS: safeMetrics.valorTotalOS,
    valorMaoObra: safeMetrics.valorMaoObra,
    valorPecas: safeMetrics.valorPecas,
    valorPagoPrestadores: safeMetrics.valorPagoPrestadores,
    valorLiquido24help: safeMetrics.valorLiquido24help,
    margemBruta24help: safeMetrics.margemBruta24help,
    taxaAgendamento,
    taxaFinalizacao,
    variations: {
      conversasIniciadas: calculateVariation(safeMetrics.conversasIniciadas, avg('conversasIniciadas')),
      fsCriadas: calculateVariation(safeMetrics.fsCriadas, avg('fsCriadas')),
      fsComOrcamento: calculateVariation(safeMetrics.fsComOrcamento, avg('fsComOrcamento')),
      totalOrcamentos: calculateVariation(safeMetrics.totalOrcamentos, avg('totalOrcamentos')),
      mediaOrcamentosPorFS: calculateVariation(safeMetrics.mediaOrcamentosPorFS, avg('mediaOrcamentosPorFS')),
      visitaAgendada: calculateVariation(safeMetrics.visitaAgendada, avg('visitaAgendada')),
      servicoAgendado: calculateVariation(safeMetrics.servicoAgendado, avg('servicoAgendado')),
      servicoAgendadoBruto: calculateVariation(safeMetrics.servicoAgendadoBruto, avg('servicoAgendadoBruto')),
      servicoFinalizado: calculateVariation(safeMetrics.servicoFinalizado, avg('servicoFinalizado')),
      finalizadoPago: calculateVariation(safeMetrics.finalizadoPago, avg('finalizadoPago')),
      pagoAoPrestador: calculateVariation(safeMetrics.pagoAoPrestador, avg('pagoAoPrestador')),
      valorTotalOS: calculateVariation(safeMetrics.valorTotalOS, avg('valorTotalOS')),
      valorMaoObra: calculateVariation(safeMetrics.valorMaoObra, avg('valorMaoObra')),
      valorPecas: calculateVariation(safeMetrics.valorPecas, avg('valorPecas')),
      valorPagoPrestadores: calculateVariation(safeMetrics.valorPagoPrestadores, avg('valorPagoPrestadores')),
      valorLiquido24help: calculateVariation(safeMetrics.valorLiquido24help, avg('valorLiquido24help')),
      margemBruta24help: calculateVariation(safeMetrics.margemBruta24help, avg('margemBruta24help')),
    },
  };
}

export const FALLBACK_OPERATIONAL_KPIS: OperationalKPIs = {
  conversasIniciadas: 0,
  fsCriadas: 0,
  fsComOrcamento: 0,
  totalOrcamentos: 0,
  mediaOrcamentosPorFS: 0,
  visitaAgendada: 0,
  servicoAgendado: 0,
  servicoAgendadoBruto: 0,
  servicoAgendadoTotal: 0,
  servicoFinalizado: 0,
  finalizadoPago: 0,
  pagoAoPrestador: 0,
  valorTotalOS: 0,
  valorMaoObra: 0,
  valorPecas: 0,
  valorPagoPrestadores: 0,
  valorLiquido24help: 0,
  margemBruta24help: 0,
  taxaAgendamento: 0,
  taxaFinalizacao: 0,
  variations: {
    conversasIniciadas: null,
    fsCriadas: null,
    fsComOrcamento: null,
    totalOrcamentos: null,
    mediaOrcamentosPorFS: null,
    visitaAgendada: null,
    servicoAgendado: null,
    servicoAgendadoBruto: null,
    servicoFinalizado: null,
    finalizadoPago: null,
    pagoAoPrestador: null,
    valorTotalOS: null,
    valorMaoObra: null,
    valorPecas: null,
    valorPagoPrestadores: null,
    valorLiquido24help: null,
    margemBruta24help: null,
  },
};

export function useOperationalKPIs(filters: KPIFilters) {
  return useQuery({
    queryKey: ['operational-kpis', filters],
    queryFn: () => fetchKPIs(filters),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
