import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays, format } from 'date-fns';

interface GoogleAdsMetric {
  id: string;
  data_referencia: string;
  impressoes: number;
  cliques: number;
  conversoes: number;
  custo: number;
  ctr: number;
  cpa: number;
  campanha: string | null;
}

interface AggregatedMetrics {
  impressoes: number;
  cliques: number;
  conversoes: number;
  custo: number;
  ctr: number;
  cpa: number;
  ticketMedio: number;
  clicksPerConversion: number;
}

interface MetricsWithVariation extends AggregatedMetrics {
  variations: {
    impressoes: number | null;
    cliques: number | null;
    conversoes: number | null;
    custo: number | null;
    ctr: number | null;
    cpa: number | null;
    ticketMedio: number | null;
    clicksPerConversion: number | null;
  };
}

interface WeeklyData {
  week: string;
  cost: number;
  conversions: number;
}

type PeriodOption = 'today' | '7days' | '30days' | 'month' | 'custom';

const getDateRange = (period: PeriodOption, customRange?: { from: Date; to: Date }) => {
  const today = startOfDay(new Date());
  
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case '7days':
      return { from: subDays(today, 6), to: today };
    case '30days':
      return { from: subDays(today, 29), to: today };
    case 'month':
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: startOfMonth, to: today };
    case 'custom':
      return customRange || { from: subDays(today, 29), to: today };
    default:
      return { from: subDays(today, 29), to: today };
  }
};

const aggregateMetrics = (metrics: GoogleAdsMetric[]): AggregatedMetrics => {
  const totals = metrics.reduce((acc, m) => ({
    impressoes: acc.impressoes + (m.impressoes || 0),
    cliques: acc.cliques + (m.cliques || 0),
    conversoes: acc.conversoes + (m.conversoes || 0),
    custo: acc.custo + (m.custo || 0),
  }), { impressoes: 0, cliques: 0, conversoes: 0, custo: 0 });

  const ctr = totals.impressoes > 0 ? (totals.cliques / totals.impressoes) * 100 : 0;
  const cpa = totals.conversoes > 0 ? totals.custo / totals.conversoes : 0;
  const ticketMedio = totals.conversoes > 0 ? totals.custo / totals.conversoes : 0;
  const clicksPerConversion = totals.conversoes > 0 ? totals.cliques / totals.conversoes : 0;

  return {
    ...totals,
    ctr: Number(ctr.toFixed(2)),
    cpa: Number(cpa.toFixed(2)),
    ticketMedio: Number(ticketMedio.toFixed(2)),
    clicksPerConversion: Math.round(clicksPerConversion),
  };
};

const calculateVariation = (current: number, previous: number): number | null => {
  // Se não há dados no período anterior, não podemos calcular variação significativa
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return null; // Evita mostrar +100% quando não há base de comparação
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

export const useGoogleAdsMetrics = (
  period: PeriodOption = '30days',
  customRange?: { from: Date; to: Date }
) => {
  return useQuery({
    queryKey: ['google-ads-metrics', period, customRange?.from, customRange?.to],
    queryFn: async (): Promise<MetricsWithVariation> => {
      const { from, to } = getDateRange(period, customRange);
      const periodDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // Período atual
      const { data: currentData, error: currentError } = await supabase
        .from('google_ads_metrics')
        .select('*')
        .gte('data_referencia', format(from, 'yyyy-MM-dd'))
        .lte('data_referencia', format(to, 'yyyy-MM-dd'))
        .order('data_referencia', { ascending: false });

      if (currentError) {
        console.error('[useGoogleAdsMetrics] Error fetching current period:', currentError);
        throw currentError;
      }

      // Período anterior (para calcular variação)
      const previousFrom = subDays(from, periodDays);
      const previousTo = subDays(from, 1);
      
      const { data: previousData, error: previousError } = await supabase
        .from('google_ads_metrics')
        .select('*')
        .gte('data_referencia', format(previousFrom, 'yyyy-MM-dd'))
        .lte('data_referencia', format(previousTo, 'yyyy-MM-dd'));

      if (previousError) {
        console.error('[useGoogleAdsMetrics] Error fetching previous period:', previousError);
      }

      const current = aggregateMetrics((currentData as GoogleAdsMetric[]) || []);
      const previous = aggregateMetrics((previousData as GoogleAdsMetric[]) || []);

      return {
        ...current,
        variations: {
          impressoes: calculateVariation(current.impressoes, previous.impressoes),
          cliques: calculateVariation(current.cliques, previous.cliques),
          conversoes: calculateVariation(current.conversoes, previous.conversoes),
          custo: calculateVariation(current.custo, previous.custo),
          ctr: calculateVariation(current.ctr, previous.ctr),
          cpa: calculateVariation(current.cpa, previous.cpa),
          ticketMedio: calculateVariation(current.ticketMedio, previous.ticketMedio),
          clicksPerConversion: calculateVariation(current.clicksPerConversion, previous.clicksPerConversion),
        },
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};

export const useGoogleAdsWeeklyData = () => {
  return useQuery({
    queryKey: ['google-ads-weekly'],
    queryFn: async (): Promise<WeeklyData[]> => {
      const today = startOfDay(new Date());
      const fourWeeksAgo = subDays(today, 27);

      const { data, error } = await supabase
        .from('google_ads_metrics')
        .select('*')
        .gte('data_referencia', format(fourWeeksAgo, 'yyyy-MM-dd'))
        .lte('data_referencia', format(today, 'yyyy-MM-dd'))
        .order('data_referencia', { ascending: true });

      if (error) {
        console.error('[useGoogleAdsWeeklyData] Error:', error);
        throw error;
      }

      // Agrupar por semana
      const weeklyMap = new Map<number, { cost: number; conversions: number }>();
      
      (data as GoogleAdsMetric[] || []).forEach(metric => {
        const date = new Date(metric.data_referencia);
        const weekNumber = Math.floor((today.getTime() - date.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const weekIndex = 3 - Math.min(weekNumber, 3); // 0-3, onde 3 é a semana atual
        
        const existing = weeklyMap.get(weekIndex) || { cost: 0, conversions: 0 };
        weeklyMap.set(weekIndex, {
          cost: existing.cost + (metric.custo || 0),
          conversions: existing.conversions + (metric.conversoes || 0),
        });
      });

      return [0, 1, 2, 3].map(i => ({
        week: `Sem ${i + 1}`,
        cost: Math.round(weeklyMap.get(i)?.cost || 0),
        conversions: weeklyMap.get(i)?.conversions || 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Fallback para quando não há dados - valores zerados para não mostrar dados falsos
export const FALLBACK_METRICS: MetricsWithVariation = {
  impressoes: 0,
  cliques: 0,
  conversoes: 0,
  custo: 0,
  ctr: 0,
  cpa: 0,
  ticketMedio: 0,
  clicksPerConversion: 0,
  variations: {
    impressoes: null,
    cliques: null,
    conversoes: null,
    custo: null,
    ctr: null,
    cpa: null,
    ticketMedio: null,
    clicksPerConversion: null,
  },
};

export const FALLBACK_WEEKLY_DATA: WeeklyData[] = [
  { week: 'Sem 1', cost: 850, conversions: 28 },
  { week: 'Sem 2', cost: 1200, conversions: 42 },
  { week: 'Sem 3', cost: 980, conversions: 35 },
  { week: 'Sem 4', cost: 1450, conversions: 52 },
];
