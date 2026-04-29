import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import type { PeriodOption } from './useOperationalKPIs';

export type DrillDownKPI =
  | 'conversasIniciadas'
  | 'fsCriadas'
  | 'totalOrcamentos'
  | 'visitaAgendada'
  | 'servicoAgendado'
  | 'agendadoPerdido'
  | 'servicoFinalizado'
  | 'finalizadoPago'
  | 'pagoAoPrestador'
  | 'valorTotalOS'
  | 'valorMaoObra'
  | 'valorPecas'
  | 'valorPagoPrestadores'
  | 'valorLiquido24help'
  | 'margemBruta24help';

export interface DrillDownRow {
  // identificação
  ficha_id: string;
  data_evento: string | null; // data do evento âncora do KPI (criação, agendamento, finalização, pagamento…)
  status_atual: string | null;
  // partes
  cliente_nome: string;
  cliente_telefone: string;
  prestador_nome: string;
  prestador_cpf: string | null;
  categoria: string | null;
  // valores
  valor_mao_obra: number;
  valor_pecas: number;
  valor_total_os: number;
  // financeiro derivado da transação (quando aplicável)
  valor_pago_prestador: number; // valor_a_pagar_prestador (mão obra + peças se NÃO pagas pela 24h)
  valor_liquido_24help: number; // valor_lucro_bruto OU valor_cliente_final - valor_a_pagar_prestador
  margem_bruta_pct: number; // liquido / pago_prestador * 100
  material_pago_24help: boolean;
  status_pagamento_prestador: string | null;
  data_pagamento_prestador: string | null;
  pagamento_cliente_realizado: boolean;
  // extras
  descricao: string | null;
  // para ordenação
  _rank?: number;
}

export interface DrillDownFilters {
  kpi: DrillDownKPI;
  period: PeriodOption;
  customRange?: { from: Date; to: Date };
  categoriaId?: number;
  prestadorCpf?: string;
  clienteTelefone?: string;
  enabled?: boolean;
}

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

const FICHA_COLS = `
  id, status, descricao, nome_ficha, nome_cliente, telefone_cliente,
  prestador_id, categoria_id, created_at, updated_at,
  valor_total, valor_mao_obra, valor_final_mao_obra,
  valor_pecas, valor_final_pecas, material_pago_24help,
  pagamento_realizado
`;

type RawFicha = {
  id: string;
  status: string | null;
  descricao: string | null;
  nome_ficha: string | null;
  nome_cliente: string | null;
  telefone_cliente: string;
  prestador_id: string | null;
  categoria_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  valor_total: number | null;
  valor_mao_obra: number | null;
  valor_final_mao_obra: number | null;
  valor_pecas: number | null;
  valor_final_pecas: number | null;
  material_pago_24help: boolean | null;
  pagamento_realizado: boolean | null;
};

type RawTrans = {
  id: string;
  ficha_id: string | null;
  valor_a_pagar_prestador: number | null;
  valor_cliente_final: number | null;
  valor_lucro_bruto: number | null;
  valor_mao_obra: number | null;
  valor_material: number | null;
  material_pago_24help: boolean | null;
  status_pagamento_prestador: string | null;
  data_pagamento_realizada: string | null;
};

function applyFichaFilters<Q extends { eq: (...args: any[]) => any }>(
  query: Q,
  filters: { categoriaId?: number; prestadorCpf?: string; clienteTelefone?: string },
): Q {
  let q: any = query;
  if (filters.categoriaId) q = q.eq('categoria_id', filters.categoriaId);
  if (filters.prestadorCpf) q = q.eq('prestador_id', filters.prestadorCpf);
  if (filters.clienteTelefone) q = q.eq('telefone_cliente', filters.clienteTelefone);
  return q;
}

// Carrega fichas por uma lista de IDs, com filtros aplicados
async function loadFichasByIds(
  ids: string[],
  filters: { categoriaId?: number; prestadorCpf?: string; clienteTelefone?: string },
): Promise<Map<string, RawFicha>> {
  const out = new Map<string, RawFicha>();
  if (ids.length === 0) return out;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
  for (const chunk of chunks) {
    let q: any = supabase.from('fichas_de_servico').select(FICHA_COLS).in('id', chunk);
    q = applyFichaFilters(q, filters);
    const { data } = await q;
    for (const f of (data as RawFicha[]) || []) out.set(f.id, f);
  }
  return out;
}

// Carrega transações por ficha_id (mais recente por ficha)
async function loadTransacoesByFichaIds(ids: string[]): Promise<Map<string, RawTrans>> {
  const out = new Map<string, RawTrans>();
  if (ids.length === 0) return out;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
  for (const chunk of chunks) {
    const { data } = await supabase
      .from('transacoes_financeiras')
      .select(
        'id, ficha_id, valor_a_pagar_prestador, valor_cliente_final, valor_lucro_bruto, valor_mao_obra, valor_material, material_pago_24help, status_pagamento_prestador, data_pagamento_realizada',
      )
      .in('ficha_id', chunk)
      .order('updated_at', { ascending: false });
    for (const t of (data as RawTrans[]) || []) {
      const fId = t.ficha_id;
      if (!fId) continue;
      if (!out.has(fId)) out.set(fId, t);
    }
  }
  return out;
}

// Busca fichas DISTINCT que tiveram um determinado status no período
async function fetchFichaIdsComEvento(
  statusNovo: string,
  fromStr: string,
  toStr: string,
  filters: { categoriaId?: number; prestadorCpf?: string; clienteTelefone?: string },
  excludeCurrentStatuses: string[] = [],
  includeOnlyCurrentStatuses?: string[],
): Promise<Map<string, string>> {
  // Map<ficha_id, data_evento>
  const out = new Map<string, string>();

  // 1) Histórico
  let histQ: any = supabase
    .from('ficha_status_historico')
    .select(
      `ficha_id, created_at,
       fichas_de_servico!inner(id, status, categoria_id, prestador_id, telefone_cliente)`,
    )
    .eq('status_novo', statusNovo)
    .gte('created_at', fromStr)
    .lte('created_at', toStr);
  if (filters.categoriaId)
    histQ = histQ.eq('fichas_de_servico.categoria_id', filters.categoriaId);
  if (filters.prestadorCpf)
    histQ = histQ.eq('fichas_de_servico.prestador_id', filters.prestadorCpf);
  if (filters.clienteTelefone)
    histQ = histQ.eq('fichas_de_servico.telefone_cliente', filters.clienteTelefone);
  const histRes = await histQ;
  for (const row of (histRes.data as any[]) || []) {
    const f = row.fichas_de_servico;
    if (!f) continue;
    if (excludeCurrentStatuses.includes(f.status)) continue;
    if (includeOnlyCurrentStatuses && !includeOnlyCurrentStatuses.includes(f.status)) continue;
    if (!out.has(f.id)) out.set(f.id, row.created_at);
  }

  // 2) Fallback: fichas atualmente nesse status, criadas no período, sem evento histórico
  let fbQ: any = supabase
    .from('fichas_de_servico')
    .select('id, status, created_at')
    .eq('status', statusNovo as any)
    .gte('created_at', fromStr)
    .lte('created_at', toStr);
  fbQ = applyFichaFilters(fbQ, filters);
  const fbRes = await fbQ;
  const fbRows = (fbRes.data as any[]) || [];
  if (fbRows.length > 0) {
    const idsToCheck = fbRows.map((f) => f.id);
    const semHistorico = new Set(idsToCheck);
    const chunks: string[][] = [];
    for (let i = 0; i < idsToCheck.length; i += 200) chunks.push(idsToCheck.slice(i, i + 200));
    for (const chunk of chunks) {
      const r = await supabase
        .from('ficha_status_historico')
        .select('ficha_id')
        .eq('status_novo', statusNovo)
        .in('ficha_id', chunk);
      for (const row of (r.data as any[]) || []) semHistorico.delete(row.ficha_id);
    }
    for (const f of fbRows) {
      if (!semHistorico.has(f.id)) continue;
      if (excludeCurrentStatuses.includes(f.status)) continue;
      if (!out.has(f.id)) out.set(f.id, f.created_at);
    }
  }
  return out;
}

function buildRow(
  f: RawFicha,
  trans: RawTrans | undefined,
  dataEvento: string | null,
  catMap: Map<number, string>,
  prestMap: Map<string, string>,
  cliMap: Map<string, string>,
): DrillDownRow {
  const maoObra = Number(f.valor_final_mao_obra ?? f.valor_mao_obra ?? 0);
  const pecas = Number(f.valor_final_pecas ?? f.valor_pecas ?? 0);
  const total = Number(f.valor_total ?? 0);
  const matPago24h = !!(trans?.material_pago_24help ?? f.material_pago_24help);

  const valorPagoPrest = trans
    ? Number(trans.valor_a_pagar_prestador ?? 0)
    : maoObra + (matPago24h ? 0 : pecas); // estimativa quando não há transação

  const valorLiquido = trans
    ? trans.valor_lucro_bruto != null
      ? Number(trans.valor_lucro_bruto)
      : Number(trans.valor_cliente_final ?? total) - valorPagoPrest
    : total - valorPagoPrest;

  const margem = valorPagoPrest > 0 ? (valorLiquido / valorPagoPrest) * 100 : 0;

  const cliNome =
    f.nome_cliente ||
    cliMap.get(f.telefone_cliente) ||
    (f.telefone_cliente || '').replace('whatsapp:+55', '');

  return {
    ficha_id: f.id,
    data_evento: dataEvento,
    status_atual: f.status,
    cliente_nome: cliNome,
    cliente_telefone: (f.telefone_cliente || '').replace('whatsapp:+55', ''),
    prestador_nome: f.prestador_id ? prestMap.get(f.prestador_id) || f.prestador_id : '-',
    prestador_cpf: f.prestador_id,
    categoria: f.categoria_id ? catMap.get(f.categoria_id) || null : null,
    valor_mao_obra: maoObra,
    valor_pecas: pecas,
    valor_total_os: total,
    valor_pago_prestador: valorPagoPrest,
    valor_liquido_24help: valorLiquido,
    margem_bruta_pct: margem,
    material_pago_24help: matPago24h,
    status_pagamento_prestador: trans?.status_pagamento_prestador || null,
    data_pagamento_prestador: trans?.data_pagamento_realizada || null,
    pagamento_cliente_realizado: !!f.pagamento_realizado,
    descricao: f.descricao || f.nome_ficha,
  };
}

async function enrichRows(
  fichaIds: string[],
  fichaMap: Map<string, RawFicha>,
  evento: Map<string, string | null>,
): Promise<DrillDownRow[]> {
  if (fichaIds.length === 0) return [];
  const transMap = await loadTransacoesByFichaIds(fichaIds);

  const catIds = Array.from(
    new Set(
      fichaIds
        .map((id) => fichaMap.get(id)?.categoria_id)
        .filter((v): v is number => v != null),
    ),
  );
  const prestIds = Array.from(
    new Set(
      fichaIds
        .map((id) => fichaMap.get(id)?.prestador_id)
        .filter((v): v is string => !!v),
    ),
  );
  const phones = Array.from(
    new Set(fichaIds.map((id) => fichaMap.get(id)?.telefone_cliente).filter(Boolean) as string[]),
  );

  const [catRes, prestRes, cliRes] = await Promise.all([
    catIds.length > 0
      ? supabase.from('categorias').select('id, nome').in('id', catIds)
      : Promise.resolve({ data: [] as any[] }),
    prestIds.length > 0
      ? supabase.from('prestadores').select('cpf, nome').in('cpf', prestIds)
      : Promise.resolve({ data: [] as any[] }),
    phones.length > 0
      ? supabase.from('clientes').select('telefone, nome').in('telefone', phones)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const catMap = new Map<number, string>(
    ((catRes.data as any[]) || []).map((c) => [c.id, c.nome]),
  );
  const prestMap = new Map<string, string>(
    ((prestRes.data as any[]) || []).map((p) => [p.cpf, p.nome]),
  );
  const cliMap = new Map<string, string>(
    ((cliRes.data as any[]) || []).map((c) => [c.telefone, c.nome]),
  );

  const rows: DrillDownRow[] = [];
  for (const id of fichaIds) {
    const f = fichaMap.get(id);
    if (!f) continue;
    rows.push(buildRow(f, transMap.get(id), evento.get(id) || null, catMap, prestMap, cliMap));
  }
  // ordena por data_evento desc
  rows.sort((a, b) => {
    const da = a.data_evento ? new Date(a.data_evento).getTime() : 0;
    const db = b.data_evento ? new Date(b.data_evento).getTime() : 0;
    return db - da;
  });
  return rows;
}

async function fetchDrillDown(filters: DrillDownFilters): Promise<DrillDownRow[]> {
  const { from, to } = getDateRange(filters.period, filters.customRange);
  const fromStr = from.toISOString();
  const toStr = to.toISOString();
  const baseFilters = {
    categoriaId: filters.categoriaId,
    prestadorCpf: filters.prestadorCpf,
    clienteTelefone: filters.clienteTelefone,
  };

  // 1) Identifica fichas-alvo + data_evento por KPI
  let fichaIds: string[] = [];
  let evento = new Map<string, string | null>();

  if (filters.kpi === 'conversasIniciadas' || filters.kpi === 'fsCriadas') {
    let q: any = supabase
      .from('fichas_de_servico')
      .select('id, created_at')
      .gte('created_at', fromStr)
      .lte('created_at', toStr)
      .order('created_at', { ascending: false });
    q = applyFichaFilters(q, baseFilters);
    const { data } = await q;
    for (const f of (data as any[]) || []) {
      fichaIds.push(f.id);
      evento.set(f.id, f.created_at);
    }
  } else if (filters.kpi === 'totalOrcamentos') {
    // 1 linha por ORÇAMENTO (não dedup por ficha) — vamos repetir fichas se necessário.
    // Mas para manter o padrão "1 serviço por linha", retornamos as fichas distintas
    // que receberam orçamento no período. Mostramos a contagem no header do dialog.
    const hasFichaFilters = !!(
      baseFilters.categoriaId || baseFilters.prestadorCpf || baseFilters.clienteTelefone
    );
    let qq: any;
    if (hasFichaFilters) {
      qq = supabase
        .from('orcamentos')
        .select(
          'ficha_nome, created_at, fichas_de_servico!inner(id, categoria_id, prestador_id, telefone_cliente)',
        )
        .gte('created_at', fromStr)
        .lte('created_at', toStr);
      if (baseFilters.categoriaId)
        qq = qq.eq('fichas_de_servico.categoria_id', baseFilters.categoriaId);
      if (baseFilters.prestadorCpf)
        qq = qq.eq('fichas_de_servico.prestador_id', baseFilters.prestadorCpf);
      if (baseFilters.clienteTelefone)
        qq = qq.eq('fichas_de_servico.telefone_cliente', baseFilters.clienteTelefone);
    } else {
      qq = supabase
        .from('orcamentos')
        .select('ficha_nome, created_at')
        .gte('created_at', fromStr)
        .lte('created_at', toStr);
    }
    const { data } = await qq;
    for (const o of (data as any[]) || []) {
      const fId = o.ficha_nome;
      if (!fId) continue;
      if (!evento.has(fId)) {
        fichaIds.push(fId);
        evento.set(fId, o.created_at);
      }
    }
  } else if (filters.kpi === 'visitaAgendada') {
    const m = await fetchFichaIdsComEvento('Visita Técnica', fromStr, toStr, baseFilters, ['Perdido']);
    fichaIds = Array.from(m.keys());
    evento = new Map(m);
  } else if (filters.kpi === 'servicoAgendado') {
    const m = await fetchFichaIdsComEvento('Agendado', fromStr, toStr, baseFilters, ['Perdido']);
    fichaIds = Array.from(m.keys());
    evento = new Map(m);
  } else if (filters.kpi === 'servicoFinalizado') {
    const m = await fetchFichaIdsComEvento('Finalizado', fromStr, toStr, baseFilters, ['Perdido']);
    fichaIds = Array.from(m.keys());
    evento = new Map(m);
  } else if (
    filters.kpi === 'finalizadoPago' ||
    filters.kpi === 'valorTotalOS' ||
    filters.kpi === 'valorMaoObra' ||
    filters.kpi === 'valorPecas'
  ) {
    // Finalizadas no período E pagas pelo cliente (exclui fichas atualmente "Perdido")
    const m = await fetchFichaIdsComEvento('Finalizado', fromStr, toStr, baseFilters, ['Perdido']);
    const candidateIds = Array.from(m.keys());
    const fichaMap = await loadFichasByIds(candidateIds, baseFilters);
    fichaIds = candidateIds.filter((id) => fichaMap.get(id)?.pagamento_realizado === true);
    evento = new Map(fichaIds.map((id) => [id, m.get(id) || null]));
  } else if (
    filters.kpi === 'pagoAoPrestador' ||
    filters.kpi === 'valorPagoPrestadores' ||
    filters.kpi === 'valorLiquido24help' ||
    filters.kpi === 'margemBruta24help'
  ) {
    // Transações pagas ao prestador no período (exclui fichas atualmente "Perdido")
    let q: any = supabase
      .from('transacoes_financeiras')
      .select(
        'ficha_id, data_pagamento_realizada, fichas_de_servico!inner(id, status, categoria_id, prestador_id, telefone_cliente)',
      )
      .eq('status_pagamento_prestador', 'pago')
      .neq('fichas_de_servico.status', 'Perdido')
      .gte('data_pagamento_realizada', fromStr)
      .lte('data_pagamento_realizada', toStr)
      .order('data_pagamento_realizada', { ascending: false });
    if (baseFilters.categoriaId)
      q = q.eq('fichas_de_servico.categoria_id', baseFilters.categoriaId);
    if (baseFilters.prestadorCpf)
      q = q.eq('fichas_de_servico.prestador_id', baseFilters.prestadorCpf);
    if (baseFilters.clienteTelefone)
      q = q.eq('fichas_de_servico.telefone_cliente', baseFilters.clienteTelefone);
    const { data } = await q;
    for (const t of (data as any[]) || []) {
      const fId = t.ficha_id;
      if (!fId || evento.has(fId)) continue;
      fichaIds.push(fId);
      evento.set(fId, t.data_pagamento_realizada);
    }
  }

  if (fichaIds.length === 0) return [];

  const fichaMap = await loadFichasByIds(fichaIds, baseFilters);
  // garante que só fichas que passaram nos filtros entram
  const validIds = fichaIds.filter((id) => fichaMap.has(id));
  return enrichRows(validIds, fichaMap, evento);
}

export function useKPIDrillDown(filters: DrillDownFilters) {
  return useQuery({
    queryKey: ['kpi-drilldown', filters],
    queryFn: () => fetchDrillDown(filters),
    enabled: filters.enabled !== false,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
