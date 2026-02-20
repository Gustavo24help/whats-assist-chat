import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { countBusinessDaysUpTo, getNthBusinessDay, getDatesForWeekday } from '@/lib/businessDays2026';

export type TVPeriod = 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'last_month' | 'custom';
export type TVComparison =
  | 'yesterday'
  | 'last_week'
  | 'last_month'
  | 'same_day_last_month'
  | 'business_days_cumulative'
  | 'weekday_compare'
  | 'specific_day';

export interface TVFilters {
  period: TVPeriod;
  comparison: TVComparison;
  onlyBusinessDays: boolean;
  prestadorCpf?: string;
  categoriaId?: number;
  customRange?: { from: Date; to: Date };
  // For weekday_compare: 0=Sun..6=Sat
  compareWeekday?: number;
  // For weekday_compare: which weekday to compare against (if different)
  compareWeekdayTarget?: number;
  // For specific_day: which day of month (1-31)
  compareDay?: number;
  // For specific_day: cumulative from day 1 or just that day
  compareDayCumulative?: boolean;
}

export interface TVPreviousValues {
  receitaTotal: number;
  lucroBruto: number;
  servicosFechados: number;
  cliquesAnuncios: number;
  conversasIniciadas: number;
  fsCriadas: number;
  agendados: number;
  executados: number;
  pagos: number;
}

export interface TVDashboardData {
  receitaTotal: number;
  lucroBruto: number;
  servicosFechados: number;
  ticketMedio: number;
  margemMedia: number;
  cliquesAnuncios: number;
  conversasIniciadas: number;
  fsCriadas: number;
  agendados: number;
  executados: number;
  pagos: number;
  tempoRespostaMin: number | null;
  tempoOrcamentoMin: number | null;
  tempoFSAgendadoDias: number | null;
  tempoAgendadoExecDias: number | null;
  tempoCicloCompletoDias: number | null;
  npsGeral: number | null;
  avaliacaoMediaPrestadores: number | null;
  metas: {
    valor_os: number;
    lucro_bruto: number;
    ticket_medio: number;
    quantidade_servicos: number;
    quantidade_fs: number;
    quantidade_agendados: number;
    taxa_fs_agendado: number;
    taxa_agendado_pago: number;
    taxa_conversao_total: number;
    tempo_resposta_max: number;
    tempo_orcamento_max: number;
  } | null;
  variations: {
    receitaTotal: number | null;
    lucroBruto: number | null;
    servicosFechados: number | null;
    cliquesAnuncios: number | null;
    conversasIniciadas: number | null;
    fsCriadas: number | null;
    agendados: number | null;
    executados: number | null;
    pagos: number | null;
  };
  previous: TVPreviousValues;
  orcamentosPendentes2h: number;
  proximaMeta: string;
  // Info about comparison for display
  comparisonLabel: string;
}

function getDateRange(period: TVPeriod, customRange?: { from: Date; to: Date }) {
  const now = new Date();
  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday':
      return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case '7days':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case '30days':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'month':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case 'last_month':
      return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
    case 'custom':
      if (customRange) return { from: startOfDay(customRange.from), to: endOfDay(customRange.to) };
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}

function getComparisonRange(from: Date, to: Date, comparison: TVComparison, filters: TVFilters): { from: Date; to: Date; label: string } {
  const periodMs = to.getTime() - from.getTime();
  const periodDays = Math.ceil(periodMs / (1000 * 60 * 60 * 24));
  const now = new Date();

  switch (comparison) {
    case 'yesterday':
      return { from: startOfDay(subDays(from, 1)), to: endOfDay(subDays(to, 1)), label: 'vs Ontem' };
    case 'last_week':
      return { from: startOfDay(subDays(from, 7)), to: endOfDay(subDays(to, 7)), label: 'vs Semana Passada' };
    case 'last_month':
      return { from: startOfDay(subDays(from, 30)), to: endOfDay(subDays(to, 30)), label: 'vs Mês Anterior' };

    case 'same_day_last_month': {
      const prevMonth = subMonths(now, 1);
      const prevFrom = startOfMonth(prevMonth);
      const dayOfMonth = now.getDate();
      const prevTo = endOfDay(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), dayOfMonth));
      return { from: prevFrom, to: prevTo, label: `vs 1-${dayOfMonth} mês ant.` };
    }

    case 'business_days_cumulative': {
      // Count business days in current month up to today
      const businessDaysCount = countBusinessDaysUpTo(now);
      const prevMonth = subMonths(now, 1);
      // Find the Nth business day in previous month
      const nthBDay = getNthBusinessDay(prevMonth.getFullYear(), prevMonth.getMonth(), businessDaysCount);
      const prevFrom = startOfMonth(prevMonth);
      const prevTo = nthBDay ? endOfDay(nthBDay) : endOfMonth(prevMonth);
      return { from: prevFrom, to: prevTo, label: `vs ${businessDaysCount} DU mês ant.` };
    }

    case 'weekday_compare': {
      // Compare all instances of a weekday in current month vs previous month
      const weekday = filters.compareWeekday ?? now.getDay();
      const targetWeekday = filters.compareWeekdayTarget ?? weekday;
      const prevMonth = subMonths(now, 1);
      const prevDates = getDatesForWeekday(prevMonth.getFullYear(), prevMonth.getMonth(), targetWeekday);
      const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      if (prevDates.length === 0) {
        return { from: startOfMonth(prevMonth), to: endOfMonth(prevMonth), label: `vs ${weekdayNames[targetWeekday]}s mês ant.` };
      }
      return {
        from: startOfDay(prevDates[0]),
        to: endOfDay(prevDates[prevDates.length - 1]),
        label: weekday === targetWeekday
          ? `vs ${weekdayNames[weekday]}s mês ant.`
          : `${weekdayNames[weekday]}s vs ${weekdayNames[targetWeekday]}s`,
      };
    }

    case 'specific_day': {
      const day = filters.compareDay ?? now.getDate();
      const cumulative = filters.compareDayCumulative ?? true;
      const prevMonth = subMonths(now, 1);
      const maxDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate();
      const clampedDay = Math.min(day, maxDay);
      if (cumulative) {
        return {
          from: startOfMonth(prevMonth),
          to: endOfDay(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), clampedDay)),
          label: `vs 1-${clampedDay} mês ant.`,
        };
      } else {
        return {
          from: startOfDay(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), clampedDay)),
          to: endOfDay(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), clampedDay)),
          label: `vs dia ${clampedDay} mês ant.`,
        };
      }
    }

    default:
      return { from: startOfDay(subDays(from, periodDays)), to: endOfDay(subDays(from, 1)), label: '' };
  }
}

function calcVariation(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

async function fetchTVData(filters: TVFilters): Promise<TVDashboardData> {
  let { from, to } = getDateRange(filters.period, filters.customRange);
  const now = new Date();

  // For cumulative comparison modes, force current period to month-to-date
  if (['same_day_last_month', 'business_days_cumulative', 'specific_day'].includes(filters.comparison)) {
    from = startOfMonth(now);
    // For specific_day non-cumulative, current period is just that day
    if (filters.comparison === 'specific_day' && !filters.compareDayCumulative) {
      const day = filters.compareDay ?? now.getDate();
      from = startOfDay(new Date(now.getFullYear(), now.getMonth(), day));
      to = endOfDay(new Date(now.getFullYear(), now.getMonth(), day));
    } else {
      to = endOfDay(now);
    }
  }

  // For weekday_compare, current period = all instances of that weekday in current month up to today
  if (filters.comparison === 'weekday_compare') {
    const weekday = filters.compareWeekday ?? now.getDay();
    const currentDates = getDatesForWeekday(now.getFullYear(), now.getMonth(), weekday).filter(d => d <= now);
    if (currentDates.length > 0) {
      from = startOfDay(currentDates[0]);
      to = endOfDay(currentDates[currentDates.length - 1]);
    } else {
      from = startOfMonth(now);
      to = endOfDay(now);
    }
  }

  const { from: prevFrom, to: prevTo, label: comparisonLabel } = getComparisonRange(from, to, filters.comparison, filters);

  const fromStr = from.toISOString();
  const toStr = to.toISOString();
  const prevFromStr = prevFrom.toISOString();
  const prevToStr = prevTo.toISOString();
  const fromDate = from.toISOString().split('T')[0];
  const toDate = to.toISOString().split('T')[0];
  const prevFromDate = prevFrom.toISOString().split('T')[0];
  const prevToDate = prevTo.toISOString().split('T')[0];

  const buildFichaFilter = (q: any) => {
    if (filters.categoriaId) q = q.eq('categoria_id', filters.categoriaId);
    if (filters.prestadorCpf) q = q.eq('prestador_id', filters.prestadorCpf);
    return q;
  };

  const [
    fichasPagasRes, fsCriadasRes, agendadosRes, executadosRes,
    adsRes, conversasRes, npsRes, avalPrestRes, metasRes, orcPendRes,
    fichasPagasPrevRes, fsCriadasPrevRes, agendadosPrevRes, executadosPrevRes,
    adsPrevRes, conversasPrevRes,
    tempoFSAgendadoRes, tempoAgendadoExecRes, tempoCicloRes,
  ] = await Promise.all([
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('valor_total, valor_mao_obra, valor_pecas')
        .eq('status', 'Finalizado').eq('pagamento_realizado', true)
        .gte('created_at', fromStr).lte('created_at', toStr)
    ),
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fromStr).lte('created_at', toStr)
    ),
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Agendado', 'Visita Técnica'])
        .gte('created_at', fromStr).lte('created_at', toStr)
    ),
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Em andamento', 'Finalizado'])
        .gte('created_at', fromStr).lte('created_at', toStr)
    ),
    supabase.from('google_ads_metrics')
      .select('cliques, conversoes')
      .gte('data_referencia', fromDate).lte('data_referencia', toDate),
    supabase.rpc('calculate_conversas_iniciadas', {
      p_from_date: fromStr, p_to_date: toStr,
      p_categoria_id: filters.categoriaId || null,
      p_prestador_cpf: filters.prestadorCpf || null,
      p_cliente_telefone: null,
    }),
    supabase.from('nps_respostas').select('nota').not('nota', 'is', null)
      .gte('created_at', fromStr).lte('created_at', toStr),
    supabase.from('avaliacao_prestador').select('nota').not('nota', 'is', null)
      .gte('created_at', fromStr).lte('created_at', toStr),
    supabase.from('dashboard_metas').select('*').eq('tipo', 'diarias').limit(1).maybeSingle(),
    supabase.from('fichas_de_servico')
      .select('*', { count: 'exact', head: true })
      .in('status', ['Orçamento Enviado', 'Negociação'])
      .lte('updated_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()),
    // Previous period
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('valor_total, valor_mao_obra, valor_pecas')
        .eq('status', 'Finalizado').eq('pagamento_realizado', true)
        .gte('created_at', prevFromStr).lte('created_at', prevToStr)
    ),
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', prevFromStr).lte('created_at', prevToStr)
    ),
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Agendado', 'Visita Técnica'])
        .gte('created_at', prevFromStr).lte('created_at', prevToStr)
    ),
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Em andamento', 'Finalizado'])
        .gte('created_at', prevFromStr).lte('created_at', prevToStr)
    ),
    supabase.from('google_ads_metrics')
      .select('cliques, conversoes')
      .gte('data_referencia', prevFromDate).lte('data_referencia', prevToDate),
    supabase.rpc('calculate_conversas_iniciadas', {
      p_from_date: prevFromStr, p_to_date: prevToStr,
      p_categoria_id: filters.categoriaId || null,
      p_prestador_cpf: filters.prestadorCpf || null,
      p_cliente_telefone: null,
    }),
    // Time metrics
    supabase.from('ficha_status_historico')
      .select('ficha_id, data_inicio, created_at, status_novo')
      .eq('status_novo', 'Agendado')
      .gte('created_at', fromStr).lte('created_at', toStr).limit(200),
    supabase.from('ficha_status_historico')
      .select('ficha_id, data_inicio, created_at, status_novo, status_anterior')
      .eq('status_novo', 'Em andamento').eq('status_anterior', 'Agendado')
      .gte('created_at', fromStr).lte('created_at', toStr).limit(200),
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('created_at, updated_at')
        .eq('status', 'Finalizado').eq('pagamento_realizado', true)
        .gte('created_at', fromStr).lte('created_at', toStr).limit(200)
    ),
  ]);

  // --- Process current period ---
  const fichasPagas = fichasPagasRes.data || [];
  const receitaTotal = fichasPagas.reduce((s, f) => s + (f.valor_total || 0), 0);
  const totalMaoObra = fichasPagas.reduce((s, f) => s + (f.valor_mao_obra || 0), 0);
  const totalPecas = fichasPagas.reduce((s, f) => s + (f.valor_pecas || 0), 0);
  const lucroBruto = totalMaoObra > 0 ? receitaTotal - totalPecas : receitaTotal * 0.6;
  const servicosFechados = fichasPagas.length;
  const ticketMedio = servicosFechados > 0 ? receitaTotal / servicosFechados : 0;
  const margemMedia = receitaTotal > 0 ? (lucroBruto / receitaTotal) * 100 : 0;

  const fsCriadas = fsCriadasRes.count || 0;
  const agendados = (agendadosRes.count || 0) + servicosFechados;
  const executados = (executadosRes.count || 0) + servicosFechados;
  const pagos = servicosFechados;

  const adsData = adsRes.data || [];
  const cliquesAnuncios = adsData.reduce((s, a) => s + (a.cliques || 0), 0);
  const conversasIniciadas = conversasRes.data || 0;

  const npsNotas = (npsRes.data || []).map(n => n.nota).filter(Boolean) as number[];
  const npsGeral = npsNotas.length > 0 ? npsNotas.reduce((a, b) => a + b, 0) / npsNotas.length : null;
  const avalNotas = (avalPrestRes.data || []).map(n => n.nota).filter(Boolean) as number[];
  const avaliacaoMediaPrestadores = avalNotas.length > 0 ? avalNotas.reduce((a, b) => a + b, 0) / avalNotas.length : null;

  const metas = metasRes.data;
  const orcamentosPendentes2h = orcPendRes.count || 0;

  // --- Time metrics ---
  const tempoRespostaMin: number | null = null;
  const tempoOrcamentoMin: number | null = null;

  let tempoFSAgendadoDias: number | null = null;
  if (tempoFSAgendadoRes.data && tempoFSAgendadoRes.data.length > 0) {
    const fichaIds = [...new Set(tempoFSAgendadoRes.data.map(h => h.ficha_id))];
    if (fichaIds.length > 0) {
      const { data: fichasOrigem } = await supabase
        .from('fichas_de_servico').select('id, created_at').in('id', fichaIds.slice(0, 100));
      if (fichasOrigem) {
        const fichaMap = new Map(fichasOrigem.map(f => [f.id, new Date(f.created_at!).getTime()]));
        const diffs: number[] = [];
        for (const h of tempoFSAgendadoRes.data) {
          const fichaCreated = fichaMap.get(h.ficha_id);
          if (fichaCreated) {
            diffs.push((new Date(h.data_inicio).getTime() - fichaCreated) / (1000 * 60 * 60 * 24));
          }
        }
        if (diffs.length > 0) tempoFSAgendadoDias = Number((diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1));
      }
    }
  }

  let tempoAgendadoExecDias: number | null = null;
  if (tempoAgendadoExecRes.data && tempoAgendadoExecRes.data.length > 0) {
    const fichaIds = [...new Set(tempoAgendadoExecRes.data.map(h => h.ficha_id))];
    if (fichaIds.length > 0) {
      const { data: agendadoEntries } = await supabase
        .from('ficha_status_historico').select('ficha_id, data_inicio')
        .eq('status_novo', 'Agendado').in('ficha_id', fichaIds.slice(0, 100));
      if (agendadoEntries) {
        const agendadoMap = new Map<string, number>();
        for (const e of agendadoEntries) agendadoMap.set(e.ficha_id, new Date(e.data_inicio).getTime());
        const diffs: number[] = [];
        for (const h of tempoAgendadoExecRes.data) {
          const agAt = agendadoMap.get(h.ficha_id);
          if (agAt) diffs.push((new Date(h.data_inicio).getTime() - agAt) / (1000 * 60 * 60 * 24));
        }
        if (diffs.length > 0) tempoAgendadoExecDias = Number((diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1));
      }
    }
  }

  let tempoCicloCompletoDias: number | null = null;
  if (tempoCicloRes.data && tempoCicloRes.data.length > 0) {
    const diffs = tempoCicloRes.data.map(f => {
      return (new Date(f.updated_at!).getTime() - new Date(f.created_at!).getTime()) / (1000 * 60 * 60 * 24);
    });
    if (diffs.length > 0) tempoCicloCompletoDias = Number((diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1));
  }

  // --- Previous period ---
  const fichasPagasPrev = fichasPagasPrevRes.data || [];
  const receitaPrev = fichasPagasPrev.reduce((s, f) => s + (f.valor_total || 0), 0);
  const maoObraPrev = fichasPagasPrev.reduce((s, f) => s + (f.valor_mao_obra || 0), 0);
  const pecasPrev = fichasPagasPrev.reduce((s, f) => s + (f.valor_pecas || 0), 0);
  const lucroPrev = maoObraPrev > 0 ? receitaPrev - pecasPrev : receitaPrev * 0.6;
  const servicosPrev = fichasPagasPrev.length;
  const fsPrev = fsCriadasPrevRes.count || 0;
  const agendadosPrev = (agendadosPrevRes.count || 0) + servicosPrev;
  const executadosPrev = (executadosPrevRes.count || 0) + servicosPrev;
  const cliquesPrev = (adsPrevRes.data || []).reduce((s, a) => s + (a.cliques || 0), 0);
  const conversasPrev = conversasPrevRes.data || 0;

  let proximaMeta = '';
  if (metas) {
    const faltaReceita = (metas.valor_os || 0) - receitaTotal;
    if (faltaReceita > 0) proximaMeta = `Faltam R$ ${faltaReceita.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} para meta de receita`;
    else {
      const faltaServicos = (metas.quantidade_servicos || 0) - servicosFechados;
      if (faltaServicos > 0) proximaMeta = `Faltam ${faltaServicos} serviços para a meta`;
      else proximaMeta = '🎉 Todas as metas atingidas!';
    }
  }

  return {
    receitaTotal, lucroBruto, servicosFechados, ticketMedio, margemMedia,
    cliquesAnuncios, conversasIniciadas, fsCriadas, agendados, executados, pagos,
    tempoRespostaMin, tempoOrcamentoMin, tempoFSAgendadoDias, tempoAgendadoExecDias, tempoCicloCompletoDias,
    npsGeral, avaliacaoMediaPrestadores,
    metas: metas ? {
      valor_os: metas.valor_os || 0, lucro_bruto: metas.lucro_bruto || 0,
      ticket_medio: metas.ticket_medio || 0, quantidade_servicos: metas.quantidade_servicos || 0,
      quantidade_fs: metas.quantidade_fs || 0, quantidade_agendados: metas.quantidade_agendados || 0,
      taxa_fs_agendado: metas.taxa_fs_agendado || 0, taxa_agendado_pago: metas.taxa_agendado_pago || 0,
      taxa_conversao_total: metas.taxa_conversao_total || 0,
      tempo_resposta_max: metas.tempo_resposta_max || 60, tempo_orcamento_max: metas.tempo_orcamento_max || 120,
    } : null,
    variations: {
      receitaTotal: calcVariation(receitaTotal, receitaPrev),
      lucroBruto: calcVariation(lucroBruto, lucroPrev),
      servicosFechados: calcVariation(servicosFechados, servicosPrev),
      cliquesAnuncios: calcVariation(cliquesAnuncios, cliquesPrev),
      conversasIniciadas: calcVariation(conversasIniciadas, conversasPrev),
      fsCriadas: calcVariation(fsCriadas, fsPrev),
      agendados: calcVariation(agendados, agendadosPrev),
      executados: calcVariation(executados, executadosPrev),
      pagos: calcVariation(servicosFechados, servicosPrev),
    },
    previous: {
      receitaTotal: receitaPrev, lucroBruto: lucroPrev, servicosFechados: servicosPrev,
      cliquesAnuncios: cliquesPrev, conversasIniciadas: conversasPrev,
      fsCriadas: fsPrev, agendados: agendadosPrev, executados: executadosPrev, pagos: servicosPrev,
    },
    orcamentosPendentes2h,
    proximaMeta,
    comparisonLabel,
  };
}

export function useDashboardTV(filters: TVFilters) {
  return useQuery({
    queryKey: ['dashboard-tv', filters],
    queryFn: () => fetchTVData(filters),
    staleTime: 25000,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });
}
