import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export type PeriodOption = 'today' | '7days' | '30days' | 'month' | 'custom';

interface DashboardSummary {
  // Resumo do Dia
  lucroLiquido: number;
  valorOSGeradas: number;
  servicosFechados: number;
  custoAds: number;
  // Atendimento WhatsApp
  conversasAtivas: number;
  tempoMedioResposta: number; // em minutos
  clientesUnicos: number;
  // Vendas/Operação
  taxaConversao: number;
  fichasAbertas: number;
  servicosFinalizados: number;
  pendencias: number;
  // Variações (null = sem dados para comparar)
  variations: {
    lucroLiquido: number | null;
    valorOSGeradas: number | null;
    servicosFechados: number | null;
    custoAds: number | null;
    conversasAtivas: number | null;
    tempoMedioResposta: number | null;
    clientesUnicos: number | null;
    taxaConversao: number | null;
    fichasAbertas: number | null;
    servicosFinalizados: number | null;
    pendencias: number | null;
  };
}

const getDateRange = (period: PeriodOption, customRange?: { from: Date; to: Date }) => {
  const now = new Date();
  
  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case '7days':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case '30days':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'month':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfMonth, to: endOfDay(now) };
    case 'custom':
      return customRange || { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    default:
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
  }
};

const calculateVariation = (current: number, previous: number): number | null => {
  // Se não há dados no período anterior, não podemos calcular variação significativa
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return null; // Evita mostrar +100% quando não há base de comparação
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

async function fetchDashboardSummary(period: PeriodOption, customRange?: { from: Date; to: Date }): Promise<DashboardSummary> {
  const { from, to } = getDateRange(period, customRange);
  const periodDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const prevFrom = startOfDay(subDays(from, periodDays));
  const prevTo = endOfDay(subDays(from, 1));

  const fromStr = from.toISOString();
  const toStr = to.toISOString();
  const prevFromStr = prevFrom.toISOString();
  const prevToStr = prevTo.toISOString();

  // Período atual - todas as queries em paralelo
  const [
    // Fichas finalizadas e pagas (para lucro e serviços fechados)
    fichasPagasResult,
    // Total de OS geradas
    osGeradasResult,
    // Custo Google Ads
    custoAdsResult,
    // Conversas ativas (clientes com interação nas últimas 24h)
    conversasAtivasResult,
    // Clientes únicos no período
    clientesUnicosResult,
    // Fichas criadas (abertas) no período
    fichasAbertasResult,
    // Serviços finalizados
    finalizadosResult,
    // Pendências (fichas não finalizadas)
    pendenciasResult,
    // Período anterior para variações
    fichasPagasPrevResult,
    osGeradasPrevResult,
    custoAdsPrevResult,
    conversasAtivasPrevResult,
    clientesUnicosPrevResult,
    fichasAbertasPrevResult,
    finalizadosPrevResult,
    pendenciasPrevResult,
  ] = await Promise.all([
    // Fichas finalizadas e pagas no período
    supabase
      .from('fichas_de_servico')
      .select('valor_total, valor_mao_obra, valor_pecas')
      .eq('status', 'Finalizado')
      .eq('pagamento_realizado', true)
      .gte('created_at', fromStr)
      .lte('created_at', toStr),
    
    // Total de OS geradas
    supabase
      .from('fichas_de_servico')
      .select('valor_total')
      .gte('created_at', fromStr)
      .lte('created_at', toStr),
    
    // Custo Google Ads
    supabase
      .from('google_ads_metrics')
      .select('custo')
      .gte('data_referencia', from.toISOString().split('T')[0])
      .lte('data_referencia', to.toISOString().split('T')[0]),
    
    // Conversas ativas (últimas 24h)
    supabase
      .from('clientes')
      .select('telefone', { count: 'exact', head: true })
      .gte('ultima_interacao', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    
    // Clientes únicos no período
    supabase
      .from('clientes')
      .select('telefone', { count: 'exact', head: true })
      .gte('created_at', fromStr)
      .lte('created_at', toStr),
    
    // Fichas abertas no período
    supabase
      .from('fichas_de_servico')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', fromStr)
      .lte('created_at', toStr),
    
    // Serviços finalizados
    supabase
      .from('fichas_de_servico')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Finalizado')
      .gte('created_at', fromStr)
      .lte('created_at', toStr),
    
    // Pendências (orçamentos não aprovados, etc)
    supabase
      .from('fichas_de_servico')
      .select('*', { count: 'exact', head: true })
      .in('status', ['Orçamento Enviado', 'Negociação', 'Dúvida Prestador', 'pendente'])
      .gte('created_at', fromStr)
      .lte('created_at', toStr),
    
    // ============ PERÍODO ANTERIOR ============
    supabase
      .from('fichas_de_servico')
      .select('valor_total, valor_mao_obra, valor_pecas')
      .eq('status', 'Finalizado')
      .eq('pagamento_realizado', true)
      .gte('created_at', prevFromStr)
      .lte('created_at', prevToStr),
    
    supabase
      .from('fichas_de_servico')
      .select('valor_total')
      .gte('created_at', prevFromStr)
      .lte('created_at', prevToStr),
    
    supabase
      .from('google_ads_metrics')
      .select('custo')
      .gte('data_referencia', prevFrom.toISOString().split('T')[0])
      .lte('data_referencia', prevTo.toISOString().split('T')[0]),
    
    supabase
      .from('clientes')
      .select('telefone', { count: 'exact', head: true })
      .gte('ultima_interacao', subDays(new Date(Date.now() - 24 * 60 * 60 * 1000), periodDays).toISOString())
      .lte('ultima_interacao', subDays(new Date(), periodDays).toISOString()),
    
    supabase
      .from('clientes')
      .select('telefone', { count: 'exact', head: true })
      .gte('created_at', prevFromStr)
      .lte('created_at', prevToStr),
    
    supabase
      .from('fichas_de_servico')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', prevFromStr)
      .lte('created_at', prevToStr),
    
    supabase
      .from('fichas_de_servico')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Finalizado')
      .gte('created_at', prevFromStr)
      .lte('created_at', prevToStr),
    
    supabase
      .from('fichas_de_servico')
      .select('*', { count: 'exact', head: true })
      .in('status', ['Orçamento Enviado', 'Negociação', 'Dúvida Prestador', 'pendente'])
      .gte('created_at', prevFromStr)
      .lte('created_at', prevToStr),
  ]);

  // Calcular valores atuais
  const fichasPagas = fichasPagasResult.data || [];
  const valorTotalPago = fichasPagas.reduce((sum, f) => sum + (f.valor_total || 0), 0);
  const valorMaoObra = fichasPagas.reduce((sum, f) => sum + (f.valor_mao_obra || 0), 0);
  // Lucro líquido = valor total - custo de peças (aproximação)
  const lucroLiquido = valorMaoObra > 0 ? valorMaoObra : valorTotalPago * 0.6; // 60% margem se não tiver mão de obra

  const osGeradas = osGeradasResult.data || [];
  const valorOSGeradas = osGeradas.reduce((sum, f) => sum + (f.valor_total || 0), 0);

  const custoAdsData = custoAdsResult.data || [];
  const custoAds = custoAdsData.reduce((sum, a) => sum + (a.custo || 0), 0);

  const conversasAtivas = conversasAtivasResult.count || 0;
  const clientesUnicos = clientesUnicosResult.count || 0;
  const fichasAbertas = fichasAbertasResult.count || 0;
  const servicosFinalizados = finalizadosResult.count || 0;
  const pendencias = pendenciasResult.count || 0;
  const servicosFechados = fichasPagas.length;

  // Taxa de conversão = finalizados / total criados
  const taxaConversao = fichasAbertas > 0 
    ? Math.round((servicosFinalizados / fichasAbertas) * 100) 
    : 0;

  // Calcular valores do período anterior
  const fichasPagasPrev = fichasPagasPrevResult.data || [];
  const valorTotalPagoPrev = fichasPagasPrev.reduce((sum, f) => sum + (f.valor_total || 0), 0);
  const valorMaoObraPrev = fichasPagasPrev.reduce((sum, f) => sum + (f.valor_mao_obra || 0), 0);
  const lucroLiquidoPrev = valorMaoObraPrev > 0 ? valorMaoObraPrev : valorTotalPagoPrev * 0.6;

  const osGeradasPrev = osGeradasPrevResult.data || [];
  const valorOSGeradasPrev = osGeradasPrev.reduce((sum, f) => sum + (f.valor_total || 0), 0);

  const custoAdsDataPrev = custoAdsPrevResult.data || [];
  const custoAdsPrev = custoAdsDataPrev.reduce((sum, a) => sum + (a.custo || 0), 0);

  const conversasAtivasPrev = conversasAtivasPrevResult.count || 0;
  const clientesUnicosPrev = clientesUnicosPrevResult.count || 0;
  const fichasAbertasPrev = fichasAbertasPrevResult.count || 0;
  const finalizadosPrev = finalizadosPrevResult.count || 0;
  const pendenciasPrev = pendenciasPrevResult.count || 0;
  const servicosFechadosPrev = fichasPagasPrev.length;

  const taxaConversaoPrev = fichasAbertasPrev > 0 
    ? Math.round((finalizadosPrev / fichasAbertasPrev) * 100) 
    : 0;

  return {
    lucroLiquido,
    valorOSGeradas,
    servicosFechados,
    custoAds,
    conversasAtivas,
    tempoMedioResposta: 4, // TODO: calcular do histórico de mensagens
    clientesUnicos,
    taxaConversao,
    fichasAbertas,
    servicosFinalizados,
    pendencias,
    variations: {
      lucroLiquido: calculateVariation(lucroLiquido, lucroLiquidoPrev),
      valorOSGeradas: calculateVariation(valorOSGeradas, valorOSGeradasPrev),
      servicosFechados: calculateVariation(servicosFechados, servicosFechadosPrev),
      custoAds: calculateVariation(custoAds, custoAdsPrev),
      conversasAtivas: calculateVariation(conversasAtivas, conversasAtivasPrev),
      tempoMedioResposta: 0, // TODO
      clientesUnicos: calculateVariation(clientesUnicos, clientesUnicosPrev),
      taxaConversao: calculateVariation(taxaConversao, taxaConversaoPrev),
      fichasAbertas: calculateVariation(fichasAbertas, fichasAbertasPrev),
      servicosFinalizados: calculateVariation(servicosFinalizados, finalizadosPrev),
      pendencias: calculateVariation(pendencias, pendenciasPrev),
    },
  };
}

export const FALLBACK_SUMMARY: DashboardSummary = {
  lucroLiquido: 0,
  valorOSGeradas: 0,
  servicosFechados: 0,
  custoAds: 0,
  conversasAtivas: 0,
  tempoMedioResposta: 0,
  clientesUnicos: 0,
  taxaConversao: 0,
  fichasAbertas: 0,
  servicosFinalizados: 0,
  pendencias: 0,
  variations: {
    lucroLiquido: null,
    valorOSGeradas: null,
    servicosFechados: null,
    custoAds: null,
    conversasAtivas: null,
    tempoMedioResposta: null,
    clientesUnicos: null,
    taxaConversao: null,
    fichasAbertas: null,
    servicosFinalizados: null,
    pendencias: null,
  },
};

export function useDashboardSummary(period: PeriodOption, customRange?: { from: Date; to: Date }) {
  return useQuery({
    queryKey: ['dashboard-summary', period, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: () => fetchDashboardSummary(period, customRange),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
