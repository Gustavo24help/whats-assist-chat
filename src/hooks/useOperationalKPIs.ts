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
  visitaAgendada: number;
  servicoAgendado: number;
  servicoAgendadoTotal: number; // legado p/ funil = agendado + finalizado/pago
  servicoFinalizado: number;
  finalizadoPago: number;
  pagoAoPrestador: number;
  // Valores
  valorTotalOS: number;
  valorMaoObra: number;
  valorPecas: number;
  // Taxas
  taxaAgendamento: number;
  taxaFinalizacao: number;
  variations: {
    conversasIniciadas: number | null;
    fsCriadas: number | null;
    visitaAgendada: number | null;
    servicoAgendado: number | null;
    servicoFinalizado: number | null;
    finalizadoPago: number | null;
    pagoAoPrestador: number | null;
    valorTotalOS: number | null;
    valorMaoObra: number | null;
    valorPecas: number | null;
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
  visitaAgendada: number;
  servicoAgendado: number;
  servicoFinalizado: number;
  finalizadoPago: number;
  pagoAoPrestador: number;
  valorTotalOS: number;
  valorMaoObra: number;
  valorPecas: number;
};

const EMPTY_METRICS: WindowMetrics = {
  conversasIniciadas: 0,
  fsCriadas: 0,
  visitaAgendada: 0,
  servicoAgendado: 0,
  servicoFinalizado: 0,
  finalizadoPago: 0,
  pagoAoPrestador: 0,
  valorTotalOS: 0,
  valorMaoObra: 0,
  valorPecas: 0,
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
async function fetchFichasComEvento(
  statusNovo: string,
  fromStr: string,
  toStr: string,
  filters: RawFichaFiltros,
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

  return { fichas: Array.from(fichasFromHist.values()) };
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
    visitaFichas,
    agendadoFichas,
    finalizadoFichas,
    pagoPrestadorRes,
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
    // Visita Agendada — eventos de status
    fetchFichasComEvento('Visita Técnica', fromStr, toStr, filters),
    // Serviço Agendado — eventos de status
    fetchFichasComEvento('Agendado', fromStr, toStr, filters),
    // Serviço Finalizado — eventos de status
    fetchFichasComEvento('Finalizado', fromStr, toStr, filters),
    // Pago ao prestador — transacoes_financeiras
    (async () => {
      let q: any = supabase
        .from('transacoes_financeiras')
        .select(
          `id, ficha_id, fichas_de_servico!inner(id, categoria_id, prestador_id, telefone_cliente)`,
          { count: 'exact' },
        )
        .gte('data_pagamento_realizada', fromStr)
        .lte('data_pagamento_realizada', toStr)
        .not('data_pagamento_realizada', 'is', null);
      q = applyEmbeddedFichaFilters(q, filters);
      return await q;
    })(),
  ]);

  const fsCriadas = fsCriadasRes.count || 0;
  const visitaAgendada = visitaFichas.fichas.length;
  const servicoAgendado = agendadoFichas.fichas.length;

  // Para "Finalizado" - separar finalizadas vs finalizadas+pagas, e somar valores
  const servicoFinalizado = finalizadoFichas.fichas.length;
  const finalizadasPagas = finalizadoFichas.fichas.filter(
    (f) => f.pagamento_realizado === true,
  );
  const finalizadoPago = finalizadasPagas.length;

  const valorTotalOS = finalizadasPagas.reduce(
    (sum, f) => sum + Number(f.valor_total ?? 0),
    0,
  );
  const valorMaoObra = finalizadasPagas.reduce(
    (sum, f) => sum + Number(f.valor_final_mao_obra ?? f.valor_mao_obra ?? 0),
    0,
  );
  const valorPecas = finalizadasPagas.reduce(
    (sum, f) => sum + Number(f.valor_final_pecas ?? f.valor_pecas ?? 0),
    0,
  );

  const pagoAoPrestador = pagoPrestadorRes.count || 0;

  return {
    conversasIniciadas: fsCriadas, // mesma definição operacional
    fsCriadas,
    visitaAgendada,
    servicoAgendado,
    servicoFinalizado,
    finalizadoPago,
    pagoAoPrestador,
    valorTotalOS,
    valorMaoObra,
    valorPecas,
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
    visitaAgendada: safeMetrics.visitaAgendada,
    servicoAgendado: safeMetrics.servicoAgendado,
    servicoAgendadoTotal,
    servicoFinalizado: safeMetrics.servicoFinalizado,
    finalizadoPago: safeMetrics.finalizadoPago,
    pagoAoPrestador: safeMetrics.pagoAoPrestador,
    valorTotalOS: safeMetrics.valorTotalOS,
    valorMaoObra: safeMetrics.valorMaoObra,
    valorPecas: safeMetrics.valorPecas,
    taxaAgendamento,
    taxaFinalizacao,
    variations: {
      conversasIniciadas: calculateVariation(safeMetrics.conversasIniciadas, avg('conversasIniciadas')),
      fsCriadas: calculateVariation(safeMetrics.fsCriadas, avg('fsCriadas')),
      visitaAgendada: calculateVariation(safeMetrics.visitaAgendada, avg('visitaAgendada')),
      servicoAgendado: calculateVariation(safeMetrics.servicoAgendado, avg('servicoAgendado')),
      servicoFinalizado: calculateVariation(safeMetrics.servicoFinalizado, avg('servicoFinalizado')),
      finalizadoPago: calculateVariation(safeMetrics.finalizadoPago, avg('finalizadoPago')),
      pagoAoPrestador: calculateVariation(safeMetrics.pagoAoPrestador, avg('pagoAoPrestador')),
      valorTotalOS: calculateVariation(safeMetrics.valorTotalOS, avg('valorTotalOS')),
      valorMaoObra: calculateVariation(safeMetrics.valorMaoObra, avg('valorMaoObra')),
      valorPecas: calculateVariation(safeMetrics.valorPecas, avg('valorPecas')),
    },
  };
}

export const FALLBACK_OPERATIONAL_KPIS: OperationalKPIs = {
  conversasIniciadas: 0,
  fsCriadas: 0,
  visitaAgendada: 0,
  servicoAgendado: 0,
  servicoAgendadoTotal: 0,
  servicoFinalizado: 0,
  finalizadoPago: 0,
  pagoAoPrestador: 0,
  valorTotalOS: 0,
  valorMaoObra: 0,
  valorPecas: 0,
  taxaAgendamento: 0,
  taxaFinalizacao: 0,
  variations: {
    conversasIniciadas: null,
    fsCriadas: null,
    visitaAgendada: null,
    servicoAgendado: null,
    servicoFinalizado: null,
    finalizadoPago: null,
    pagoAoPrestador: null,
    valorTotalOS: null,
    valorMaoObra: null,
    valorPecas: null,
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
