import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, format } from 'date-fns';

export type PeriodOption = 'today' | '7days' | '30days' | 'month' | 'custom';

export interface KPIFilters {
  period: PeriodOption;
  customRange?: { from: Date; to: Date };
  categoriaId?: number;
  prestadorCpf?: string;
  clienteTelefone?: string;
}

export interface OperationalKPIs {
  conversasIniciadas: number;
  fsCriadas: number;
  visitaAgendada: number;
  servicoAgendado: number;
  finalizadoPago: number;
  valorTotalOS: number;
  variations: {
    conversasIniciadas: number;
    fsCriadas: number;
    visitaAgendada: number;
    servicoAgendado: number;
    finalizadoPago: number;
    valorTotalOS: number;
  };
  isLoading: boolean;
}

const getDateRange = (period: PeriodOption, customRange?: { from: Date; to: Date }) => {
  const now = new Date();
  
  switch (period) {
    case 'today':
      return {
        from: startOfDay(now),
        to: endOfDay(now),
      };
    case '7days':
      return {
        from: startOfDay(subDays(now, 6)),
        to: endOfDay(now),
      };
    case '30days':
      return {
        from: startOfDay(subDays(now, 29)),
        to: endOfDay(now),
      };
    case 'month':
      return {
        from: startOfMonth(now),
        to: endOfMonth(now),
      };
    case 'custom':
      if (customRange) {
        return {
          from: startOfDay(customRange.from),
          to: endOfDay(customRange.to),
        };
      }
      return {
        from: startOfDay(subDays(now, 29)),
        to: endOfDay(now),
      };
    default:
      return {
        from: startOfDay(subDays(now, 29)),
        to: endOfDay(now),
      };
  }
};

const getPreviousPeriodRange = (from: Date, to: Date) => {
  const periodDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  return {
    from: startOfDay(subDays(from, periodDays)),
    to: endOfDay(subDays(from, 1)),
  };
};

const calculateVariation = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

async function fetchKPIs(filters: KPIFilters) {
  const { from, to } = getDateRange(filters.period, filters.customRange);
  const { from: prevFrom, to: prevTo } = getPreviousPeriodRange(from, to);
  
  const fromStr = from.toISOString();
  const toStr = to.toISOString();
  const prevFromStr = prevFrom.toISOString();
  const prevToStr = prevTo.toISOString();
  
  const fromDateOnly = format(from, 'yyyy-MM-dd');
  const toDateOnly = format(to, 'yyyy-MM-dd');
  const prevFromDateOnly = format(prevFrom, 'yyyy-MM-dd');
  const prevToDateOnly = format(prevTo, 'yyyy-MM-dd');

  // Build base filter for fichas
  const buildFichaQuery = (baseQuery: ReturnType<typeof supabase.from>) => {
    let query = baseQuery;
    if (filters.categoriaId) {
      query = query.eq('categoria_id', filters.categoriaId) as typeof query;
    }
    if (filters.prestadorCpf) {
      query = query.eq('prestador_id', filters.prestadorCpf) as typeof query;
    }
    if (filters.clienteTelefone) {
      query = query.eq('telefone_cliente', filters.clienteTelefone) as typeof query;
    }
    return query;
  };

  // Execute all queries in parallel
  const [
    // Current period
    fsCriadasResult,
    visitasResult,
    servicosResult,
    finalizadosResult,
    valorTotalResult,
    allFichasResult,
    firstMessagesResult,
    // Previous period
    fsCriadasPrevResult,
    visitasPrevResult,
    servicosPrevResult,
    finalizadosPrevResult,
    valorTotalPrevResult,
    firstMessagesPrevResult,
  ] = await Promise.all([
    // Current period queries
    // 1. FS Criadas
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .gte('created_at', fromStr)
      .lte('created_at', toStr),
    
    // 2. Visita Agendada
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .not('data_visita_tecnica', 'is', null)
      .gte('data_visita_tecnica', fromDateOnly)
      .lte('data_visita_tecnica', toDateOnly),
    
    // 3. Serviço Agendado
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .not('horario_agendamento', 'is', null)
      .gte('horario_agendamento', fromStr)
      .lte('horario_agendamento', toStr),
    
    // 4. Finalizado e Pago
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Finalizado')
      .eq('pagamento_realizado', true)
      .gte('updated_at', fromStr)
      .lte('updated_at', toStr),
    
    // 5. Valor Total OS
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('valor_total')
      .eq('status', 'Finalizado')
      .eq('pagamento_realizado', true)
      .gte('updated_at', fromStr)
      .lte('updated_at', toStr),
    
    // 6. All fichas for calculating subsequentes
    supabase
      .from('fichas_de_servico')
      .select('telefone_cliente, created_at')
      .order('created_at', { ascending: true }),
    
    // 7. First messages per client
    supabase
      .from('mensagens')
      .select('cliente_id, data_hora')
      .eq('remetente', 'cliente')
      .order('data_hora', { ascending: true }),
    
    // Previous period queries
    // 1. FS Criadas prev
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .gte('created_at', prevFromStr)
      .lte('created_at', prevToStr),
    
    // 2. Visita Agendada prev
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .not('data_visita_tecnica', 'is', null)
      .gte('data_visita_tecnica', prevFromDateOnly)
      .lte('data_visita_tecnica', prevToDateOnly),
    
    // 3. Serviço Agendado prev
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .not('horario_agendamento', 'is', null)
      .gte('horario_agendamento', prevFromStr)
      .lte('horario_agendamento', prevToStr),
    
    // 4. Finalizado e Pago prev
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Finalizado')
      .eq('pagamento_realizado', true)
      .gte('updated_at', prevFromStr)
      .lte('updated_at', prevToStr),
    
    // 5. Valor Total OS prev
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('valor_total')
      .eq('status', 'Finalizado')
      .eq('pagamento_realizado', true)
      .gte('updated_at', prevFromStr)
      .lte('updated_at', prevToStr),
    
    // First messages prev (same query, we filter by date in calculation)
    supabase
      .from('mensagens')
      .select('cliente_id, data_hora')
      .eq('remetente', 'cliente')
      .order('data_hora', { ascending: true }),
  ]);

  // Calculate "conversas iniciadas" logic
  const calculateConversasIniciadas = (
    messages: { cliente_id: string; data_hora: string | null }[] | null,
    fichas: { telefone_cliente: string; created_at: string | null }[] | null,
    fromDate: Date,
    toDate: Date
  ) => {
    const fromTime = fromDate.getTime();
    const toTime = toDate.getTime();
    
    // 1. Count first messages per client in period
    const allMessages = messages || [];
    const clientFirstMessages = new Map<string, Date>();
    
    // Get first message ever for each client
    allMessages.forEach(msg => {
      if (!msg.data_hora) return;
      const msgDate = new Date(msg.data_hora);
      if (!clientFirstMessages.has(msg.cliente_id) || msgDate < clientFirstMessages.get(msg.cliente_id)!) {
        clientFirstMessages.set(msg.cliente_id, msgDate);
      }
    });
    
    // Count clients whose first message was in this period
    let firstMessagesInPeriod = 0;
    clientFirstMessages.forEach((date) => {
      const time = date.getTime();
      if (time >= fromTime && time <= toTime) {
        firstMessagesInPeriod++;
      }
    });
    
    // 2. Count subsequent fichas (not the first one for each client)
    const allFichas = fichas || [];
    const clientFichas = new Map<string, Date[]>();
    
    allFichas.forEach(ficha => {
      if (!ficha.created_at) return;
      const fichaDate = new Date(ficha.created_at);
      if (!clientFichas.has(ficha.telefone_cliente)) {
        clientFichas.set(ficha.telefone_cliente, []);
      }
      clientFichas.get(ficha.telefone_cliente)!.push(fichaDate);
    });
    
    // Sort each client's fichas by date
    clientFichas.forEach((dates) => {
      dates.sort((a, b) => a.getTime() - b.getTime());
    });
    
    // Count subsequent fichas in period
    let subsequentFichasInPeriod = 0;
    clientFichas.forEach((dates) => {
      // Skip the first ficha, count subsequent ones in period
      for (let i = 1; i < dates.length; i++) {
        const time = dates[i].getTime();
        if (time >= fromTime && time <= toTime) {
          subsequentFichasInPeriod++;
        }
      }
    });
    
    return firstMessagesInPeriod + subsequentFichasInPeriod;
  };

  const fsCriadas = fsCriadasResult.count || 0;
  const visitaAgendada = visitasResult.count || 0;
  const servicoAgendado = servicosResult.count || 0;
  const finalizadoPago = finalizadosResult.count || 0;
  const valorTotalOS = (valorTotalResult.data || []).reduce((sum, f) => sum + (f.valor_total || 0), 0);
  const conversasIniciadas = calculateConversasIniciadas(
    firstMessagesResult.data,
    allFichasResult.data,
    from,
    to
  );

  const fsCriadasPrev = fsCriadasPrevResult.count || 0;
  const visitaAgendadaPrev = visitasPrevResult.count || 0;
  const servicoAgendadoPrev = servicosPrevResult.count || 0;
  const finalizadoPagoPrev = finalizadosPrevResult.count || 0;
  const valorTotalOSPrev = (valorTotalPrevResult.data || []).reduce((sum, f) => sum + (f.valor_total || 0), 0);
  const conversasIniciadasPrev = calculateConversasIniciadas(
    firstMessagesPrevResult.data,
    allFichasResult.data,
    prevFrom,
    prevTo
  );

  return {
    conversasIniciadas,
    fsCriadas,
    visitaAgendada,
    servicoAgendado,
    finalizadoPago,
    valorTotalOS,
    variations: {
      conversasIniciadas: calculateVariation(conversasIniciadas, conversasIniciadasPrev),
      fsCriadas: calculateVariation(fsCriadas, fsCriadasPrev),
      visitaAgendada: calculateVariation(visitaAgendada, visitaAgendadaPrev),
      servicoAgendado: calculateVariation(servicoAgendado, servicoAgendadoPrev),
      finalizadoPago: calculateVariation(finalizadoPago, finalizadoPagoPrev),
      valorTotalOS: calculateVariation(valorTotalOS, valorTotalOSPrev),
    },
  };
}

export const FALLBACK_OPERATIONAL_KPIS: Omit<OperationalKPIs, 'isLoading'> = {
  conversasIniciadas: 0,
  fsCriadas: 0,
  visitaAgendada: 0,
  servicoAgendado: 0,
  finalizadoPago: 0,
  valorTotalOS: 0,
  variations: {
    conversasIniciadas: 0,
    fsCriadas: 0,
    visitaAgendada: 0,
    servicoAgendado: 0,
    finalizadoPago: 0,
    valorTotalOS: 0,
  },
};

export function useOperationalKPIs(filters: KPIFilters) {
  return useQuery({
    queryKey: ['operational-kpis', filters],
    queryFn: () => fetchKPIs(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
