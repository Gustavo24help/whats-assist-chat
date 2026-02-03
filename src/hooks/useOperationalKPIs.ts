import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from 'date-fns';

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
  servicoAgendado: number; // Apenas com horario_agendamento
  servicoAgendadoTotal: number; // Agendados + Finalizados/Pagos (para funil)
  finalizadoPago: number;
  valorTotalOS: number;
  // Taxas de conversão
  taxaAgendamento: number; // servicoAgendadoTotal / fsCriadas
  taxaFinalizacao: number; // finalizadoPago / fsCriadas
  variations: {
    conversasIniciadas: number | null;
    fsCriadas: number | null;
    visitaAgendada: number | null;
    servicoAgendado: number | null;
    finalizadoPago: number | null;
    valorTotalOS: number | null;
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

const calculateVariation = (current: number, previous: number): number | null => {
  // Se não há dados no período anterior, não podemos calcular variação significativa
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return null; // Evita mostrar +100% quando não há base de comparação
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

async function fetchKPIs(filters: KPIFilters) {
  const { from, to } = getDateRange(filters.period, filters.customRange);
  const { from: prevFrom, to: prevTo } = getPreviousPeriodRange(from, to);
  
  const fromStr = from.toISOString();
  const toStr = to.toISOString();
  const prevFromStr = prevFrom.toISOString();
  const prevToStr = prevTo.toISOString();

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
    conversasIniciadasResult,
    // Previous period
    fsCriadasPrevResult,
    visitasPrevResult,
    servicosPrevResult,
    finalizadosPrevResult,
    valorTotalPrevResult,
    conversasIniciadasPrevResult,
  ] = await Promise.all([
    // Current period queries
    // 1. FS Criadas
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .gte('created_at', fromStr)
      .lte('created_at', toStr),
    
    // 2. Visita Agendada (filtrada por created_at da ficha)
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .not('data_visita_tecnica', 'is', null)
      .gte('created_at', fromStr)
      .lte('created_at', toStr),
    
    // 3. Serviço Agendado - apenas status 'Agendado' (não todos com horario_agendamento)
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Agendado')
      .gte('created_at', fromStr)
      .lte('created_at', toStr),
    
    // 4. Finalizado e Pago (filtrada por created_at da ficha)
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Finalizado')
      .eq('pagamento_realizado', true)
      .gte('created_at', fromStr)
      .lte('created_at', toStr),
    
    // 5. Valor Total OS (filtrada por created_at da ficha)
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('valor_total')
      .eq('status', 'Finalizado')
      .eq('pagamento_realizado', true)
      .gte('created_at', fromStr)
      .lte('created_at', toStr),
    
    // 6. Conversas Iniciadas (via RPC - cálculo no banco)
    supabase.rpc('calculate_conversas_iniciadas', {
      p_from_date: fromStr,
      p_to_date: toStr,
      p_categoria_id: filters.categoriaId || null,
      p_prestador_cpf: filters.prestadorCpf || null,
      p_cliente_telefone: filters.clienteTelefone || null,
    }),
    
    // Previous period queries
    // 1. FS Criadas prev
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .gte('created_at', prevFromStr)
      .lte('created_at', prevToStr),
    
    // 2. Visita Agendada prev (filtrada por created_at da ficha)
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .not('data_visita_tecnica', 'is', null)
      .gte('created_at', prevFromStr)
      .lte('created_at', prevToStr),
    
    // 3. Serviço Agendado prev - apenas status 'Agendado'
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Agendado')
      .gte('created_at', prevFromStr)
      .lte('created_at', prevToStr),
    
    // 4. Finalizado e Pago prev (filtrada por created_at da ficha)
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Finalizado')
      .eq('pagamento_realizado', true)
      .gte('created_at', prevFromStr)
      .lte('created_at', prevToStr),
    
    // 5. Valor Total OS prev (filtrada por created_at da ficha)
    buildFichaQuery(supabase.from('fichas_de_servico'))
      .select('valor_total')
      .eq('status', 'Finalizado')
      .eq('pagamento_realizado', true)
      .gte('created_at', prevFromStr)
      .lte('created_at', prevToStr),
    
    // 6. Conversas Iniciadas prev (via RPC)
    supabase.rpc('calculate_conversas_iniciadas', {
      p_from_date: prevFromStr,
      p_to_date: prevToStr,
      p_categoria_id: filters.categoriaId || null,
      p_prestador_cpf: filters.prestadorCpf || null,
      p_cliente_telefone: filters.clienteTelefone || null,
    }),
  ]);

  const fsCriadas = fsCriadasResult.count || 0;
  const visitaAgendada = visitasResult.count || 0;
  const servicoAgendado = servicosResult.count || 0;
  const finalizadoPago = finalizadosResult.count || 0;
  const valorTotalOS = (valorTotalResult.data || []).reduce((sum, f) => sum + (f.valor_total || 0), 0);
  const conversasIniciadas = conversasIniciadasResult.data || 0;

  // Serviços Agendados Total = agendados + finalizados/pagos (para o funil)
  const servicoAgendadoTotal = servicoAgendado + finalizadoPago;

  // Taxas de conversão
  const taxaAgendamento = fsCriadas > 0 
    ? Number(((servicoAgendadoTotal / fsCriadas) * 100).toFixed(1)) 
    : 0;
  const taxaFinalizacao = fsCriadas > 0 
    ? Number(((finalizadoPago / fsCriadas) * 100).toFixed(1)) 
    : 0;

  const fsCriadasPrev = fsCriadasPrevResult.count || 0;
  const visitaAgendadaPrev = visitasPrevResult.count || 0;
  const servicoAgendadoPrev = servicosPrevResult.count || 0;
  const finalizadoPagoPrev = finalizadosPrevResult.count || 0;
  const valorTotalOSPrev = (valorTotalPrevResult.data || []).reduce((sum, f) => sum + (f.valor_total || 0), 0);
  const conversasIniciadasPrev = conversasIniciadasPrevResult.data || 0;

  return {
    conversasIniciadas,
    fsCriadas,
    visitaAgendada,
    servicoAgendado,
    servicoAgendadoTotal,
    finalizadoPago,
    valorTotalOS,
    taxaAgendamento,
    taxaFinalizacao,
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
  servicoAgendadoTotal: 0,
  finalizadoPago: 0,
  valorTotalOS: 0,
  taxaAgendamento: 0,
  taxaFinalizacao: 0,
  variations: {
    conversasIniciadas: null,
    fsCriadas: null,
    visitaAgendada: null,
    servicoAgendado: null,
    finalizadoPago: null,
    valorTotalOS: null,
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
