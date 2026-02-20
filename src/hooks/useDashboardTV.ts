import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, isWeekend } from 'date-fns';

export type TVPeriod = 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'last_month' | 'custom';
export type TVComparison = 'yesterday' | 'last_week' | 'last_month' | 'same_day_last_month';

export interface TVFilters {
  period: TVPeriod;
  comparison: TVComparison;
  onlyBusinessDays: boolean;
  prestadorCpf?: string;
  categoriaId?: number;
  customRange?: { from: Date; to: Date };
}

export interface TVDashboardData {
  // KPIs principais
  receitaTotal: number;
  lucroBruto: number;
  servicosFechados: number;
  ticketMedio: number;
  margemMedia: number;
  // Funil
  cliquesAnuncios: number;
  conversasIniciadas: number;
  fsCriadas: number;
  agendados: number;
  executados: number;
  pagos: number;
  // Tempos
  tempoRespostaMin: number | null;
  tempoOrcamentoMin: number | null;
  tempoFSAgendadoDias: number | null;
  tempoAgendadoExecDias: number | null;
  tempoCicloCompletoDias: number | null;
  // NPS
  npsGeral: number | null;
  avaliacaoMediaPrestadores: number | null;
  // Metas
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
  // Variações (período anterior)
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
  // Alertas para ticker
  orcamentosPendentes2h: number;
  proximaMeta: string;
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

function getComparisonRange(from: Date, to: Date, comparison: TVComparison) {
  const periodMs = to.getTime() - from.getTime();
  const periodDays = Math.ceil(periodMs / (1000 * 60 * 60 * 24));

  switch (comparison) {
    case 'yesterday':
      return { from: startOfDay(subDays(from, 1)), to: endOfDay(subDays(to, 1)) };
    case 'last_week':
      return { from: startOfDay(subDays(from, 7)), to: endOfDay(subDays(to, 7)) };
    case 'last_month':
      return { from: startOfDay(subDays(from, 30)), to: endOfDay(subDays(to, 30)) };
    case 'same_day_last_month':
      return { from: startOfDay(subMonths(from, 1)), to: endOfDay(subMonths(to, 1)) };
    default:
      return { from: startOfDay(subDays(from, periodDays)), to: endOfDay(subDays(from, 1)) };
  }
}

function calcVariation(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

async function fetchTVData(filters: TVFilters): Promise<TVDashboardData> {
  const { from, to } = getDateRange(filters.period, filters.customRange);
  const { from: prevFrom, to: prevTo } = getComparisonRange(from, to, filters.comparison);

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
    // Current period
    fichasPagasRes,
    fsCriadasRes,
    agendadosRes,
    executadosRes,
    adsRes,
    conversasRes,
    npsRes,
    avalPrestRes,
    metasRes,
    orcPendRes,
    // Previous period
    fichasPagasPrevRes,
    fsCriadasPrevRes,
    agendadosPrevRes,
    executadosPrevRes,
    adsPrevRes,
    conversasPrevRes,
    // Time metrics - using ficha_status_historico
    tempoFSAgendadoRes,
    tempoAgendadoExecRes,
    tempoCicloRes,
  ] = await Promise.all([
    // 1. Fichas pagas (receita, lucro, serviços fechados)
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('valor_total, valor_mao_obra, valor_pecas')
        .eq('status', 'Finalizado')
        .eq('pagamento_realizado', true)
        .gte('created_at', fromStr)
        .lte('created_at', toStr)
    ),
    // 2. FS criadas
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fromStr)
        .lte('created_at', toStr)
    ),
    // 3. Agendados (status Agendado + Visita Técnica)
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Agendado', 'Visita Técnica'])
        .gte('created_at', fromStr)
        .lte('created_at', toStr)
    ),
    // 4. Executados (Em andamento + Finalizado)
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Em andamento', 'Finalizado'])
        .gte('created_at', fromStr)
        .lte('created_at', toStr)
    ),
    // 5. Google Ads cliques
    supabase.from('google_ads_metrics')
      .select('cliques, conversoes')
      .gte('data_referencia', fromDate)
      .lte('data_referencia', toDate),
    // 6. Conversas iniciadas (RPC)
    supabase.rpc('calculate_conversas_iniciadas', {
      p_from_date: fromStr,
      p_to_date: toStr,
      p_categoria_id: filters.categoriaId || null,
      p_prestador_cpf: filters.prestadorCpf || null,
      p_cliente_telefone: null,
    }),
    // 7. NPS
    supabase.from('nps_respostas')
      .select('nota')
      .not('nota', 'is', null)
      .gte('created_at', fromStr)
      .lte('created_at', toStr),
    // 8. Avaliação prestadores
    supabase.from('avaliacao_prestador')
      .select('nota')
      .not('nota', 'is', null)
      .gte('created_at', fromStr)
      .lte('created_at', toStr),
    // 9. Metas
    supabase.from('dashboard_metas')
      .select('*')
      .eq('tipo', 'diarias')
      .limit(1)
      .maybeSingle(),
    // 10. Orçamentos pendentes > 2h
    supabase.from('fichas_de_servico')
      .select('*', { count: 'exact', head: true })
      .in('status', ['Orçamento Enviado', 'Negociação'])
      .lte('updated_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()),
    // === PERÍODO ANTERIOR ===
    // 11. Fichas pagas prev
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('valor_total, valor_mao_obra, valor_pecas')
        .eq('status', 'Finalizado')
        .eq('pagamento_realizado', true)
        .gte('created_at', prevFromStr)
        .lte('created_at', prevToStr)
    ),
    // 12. FS criadas prev
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', prevFromStr)
        .lte('created_at', prevToStr)
    ),
    // 13. Agendados prev
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Agendado', 'Visita Técnica'])
        .gte('created_at', prevFromStr)
        .lte('created_at', prevToStr)
    ),
    // 14. Executados prev
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Em andamento', 'Finalizado'])
        .gte('created_at', prevFromStr)
        .lte('created_at', prevToStr)
    ),
    // 15. Ads prev
    supabase.from('google_ads_metrics')
      .select('cliques, conversoes')
      .gte('data_referencia', prevFromDate)
      .lte('data_referencia', prevToDate),
    // 16. Conversas prev
    supabase.rpc('calculate_conversas_iniciadas', {
      p_from_date: prevFromStr,
      p_to_date: prevToStr,
      p_categoria_id: filters.categoriaId || null,
      p_prestador_cpf: filters.prestadorCpf || null,
      p_cliente_telefone: null,
    }),
    // === MÉTRICAS DE TEMPO ===
    // 17. Tempo FS → Agendado (dias entre criação e status Agendado)
    supabase.from('ficha_status_historico')
      .select('ficha_id, data_inicio, created_at, status_novo')
      .eq('status_novo', 'Agendado')
      .gte('created_at', fromStr)
      .lte('created_at', toStr)
      .limit(200),
    // 18. Tempo Agendado → Em andamento
    supabase.from('ficha_status_historico')
      .select('ficha_id, data_inicio, created_at, status_novo, status_anterior')
      .eq('status_novo', 'Em andamento')
      .eq('status_anterior', 'Agendado')
      .gte('created_at', fromStr)
      .lte('created_at', toStr)
      .limit(200),
    // 19. Ciclo completo (criação → Finalizado pago)
    buildFichaFilter(
      supabase.from('fichas_de_servico')
        .select('created_at, updated_at')
        .eq('status', 'Finalizado')
        .eq('pagamento_realizado', true)
        .gte('created_at', fromStr)
        .lte('created_at', toStr)
        .limit(200)
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
  const agendados = (agendadosRes.count || 0) + servicosFechados; // total que passou por agendamento
  const executados = (executadosRes.count || 0) + servicosFechados;
  const pagos = servicosFechados;

  const adsData = adsRes.data || [];
  const cliquesAnuncios = adsData.reduce((s, a) => s + (a.cliques || 0), 0);

  const conversasIniciadas = conversasRes.data || 0;

  // NPS
  const npsNotas = (npsRes.data || []).map(n => n.nota).filter(Boolean) as number[];
  const npsGeral = npsNotas.length > 0 ? npsNotas.reduce((a, b) => a + b, 0) / npsNotas.length : null;

  const avalNotas = (avalPrestRes.data || []).map(n => n.nota).filter(Boolean) as number[];
  const avaliacaoMediaPrestadores = avalNotas.length > 0 ? avalNotas.reduce((a, b) => a + b, 0) / avalNotas.length : null;

  // Metas
  const metas = metasRes.data;

  // Orçamentos pendentes > 2h
  const orcamentosPendentes2h = orcPendRes.count || 0;

  // --- Process time metrics ---
  // Tempo resposta (approx: tempo entre bot desativado e primeira msg operador)
  // We don't have exact timestamps for this, so set null
  const tempoRespostaMin: number | null = null;
  const tempoOrcamentoMin: number | null = null;

  // FS → Agendado
  let tempoFSAgendadoDias: number | null = null;
  if (tempoFSAgendadoRes.data && tempoFSAgendadoRes.data.length > 0) {
    // We need original ficha created_at, fetch those
    const fichaIds = [...new Set(tempoFSAgendadoRes.data.map(h => h.ficha_id))];
    if (fichaIds.length > 0) {
      const { data: fichasOrigem } = await supabase
        .from('fichas_de_servico')
        .select('id, created_at')
        .in('id', fichaIds.slice(0, 100));
      if (fichasOrigem) {
        const fichaMap = new Map(fichasOrigem.map(f => [f.id, new Date(f.created_at!).getTime()]));
        const diffs: number[] = [];
        for (const h of tempoFSAgendadoRes.data) {
          const fichaCreated = fichaMap.get(h.ficha_id);
          if (fichaCreated) {
            const agendadoAt = new Date(h.data_inicio).getTime();
            diffs.push((agendadoAt - fichaCreated) / (1000 * 60 * 60 * 24));
          }
        }
        if (diffs.length > 0) {
          tempoFSAgendadoDias = Number((diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1));
        }
      }
    }
  }

  // Agendado → Executado
  let tempoAgendadoExecDias: number | null = null;
  if (tempoAgendadoExecRes.data && tempoAgendadoExecRes.data.length > 0) {
    // Use status_historico: find when it became Agendado vs Em andamento
    const fichaIds = [...new Set(tempoAgendadoExecRes.data.map(h => h.ficha_id))];
    if (fichaIds.length > 0) {
      const { data: agendadoEntries } = await supabase
        .from('ficha_status_historico')
        .select('ficha_id, data_inicio')
        .eq('status_novo', 'Agendado')
        .in('ficha_id', fichaIds.slice(0, 100));
      if (agendadoEntries) {
        const agendadoMap = new Map<string, number>();
        for (const e of agendadoEntries) {
          agendadoMap.set(e.ficha_id, new Date(e.data_inicio).getTime());
        }
        const diffs: number[] = [];
        for (const h of tempoAgendadoExecRes.data) {
          const agAt = agendadoMap.get(h.ficha_id);
          if (agAt) {
            diffs.push((new Date(h.data_inicio).getTime() - agAt) / (1000 * 60 * 60 * 24));
          }
        }
        if (diffs.length > 0) {
          tempoAgendadoExecDias = Number((diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1));
        }
      }
    }
  }

  // Ciclo completo
  let tempoCicloCompletoDias: number | null = null;
  if (tempoCicloRes.data && tempoCicloRes.data.length > 0) {
    const diffs = tempoCicloRes.data.map(f => {
      const created = new Date(f.created_at!).getTime();
      const updated = new Date(f.updated_at!).getTime();
      return (updated - created) / (1000 * 60 * 60 * 24);
    });
    if (diffs.length > 0) {
      tempoCicloCompletoDias = Number((diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1));
    }
  }

  // --- Process previous period ---
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

  // Próxima meta
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
    receitaTotal,
    lucroBruto,
    servicosFechados,
    ticketMedio,
    margemMedia,
    cliquesAnuncios,
    conversasIniciadas,
    fsCriadas,
    agendados,
    executados,
    pagos,
    tempoRespostaMin,
    tempoOrcamentoMin,
    tempoFSAgendadoDias,
    tempoAgendadoExecDias,
    tempoCicloCompletoDias,
    npsGeral,
    avaliacaoMediaPrestadores,
    metas: metas ? {
      valor_os: metas.valor_os || 0,
      lucro_bruto: metas.lucro_bruto || 0,
      ticket_medio: metas.ticket_medio || 0,
      quantidade_servicos: metas.quantidade_servicos || 0,
      quantidade_fs: metas.quantidade_fs || 0,
      quantidade_agendados: metas.quantidade_agendados || 0,
      taxa_fs_agendado: metas.taxa_fs_agendado || 0,
      taxa_agendado_pago: metas.taxa_agendado_pago || 0,
      taxa_conversao_total: metas.taxa_conversao_total || 0,
      tempo_resposta_max: metas.tempo_resposta_max || 60,
      tempo_orcamento_max: metas.tempo_orcamento_max || 120,
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
    orcamentosPendentes2h,
    proximaMeta,
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
