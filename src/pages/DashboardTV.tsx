import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDashboardTV, TVFilters, TVPeriod, TVComparison } from '@/hooks/useDashboardTV';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { MetasModal } from '@/components/dashboard/tv/MetasModal';
import { TVLayoutProvider, useTVLayout } from '@/contexts/TVLayoutContext';
import { TVLayoutCustomizer } from '@/components/dashboard/tv/TVLayoutCustomizer';
import { MetasResultadosSection } from '@/components/dashboard/tv/MetasResultadosSection';
import { TVCelebration } from '@/components/dashboard/tv/TVCelebration';
import { TVGoalBars } from '@/components/dashboard/tv/TVGoalBars';
import { TVMonitorSettings, useMonitorSettings } from '@/components/dashboard/tv/TVMonitorSettings';
import { playPaymentDing, playCelebrationFanfare } from '@/lib/tvSounds';
import { format, differenceInCalendarDays, startOfDay, startOfMonth, endOfMonth, subDays, subMonths, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getWeekdayName, isBusinessDay, getBusinessDaysInRange } from '@/lib/businessDays2026';
import { Calendar as CalendarIcon, Settings } from 'lucide-react';
import logoGreen from '@/assets/logo-green.png';

// ---- Helpers ----
function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(v: number | null) {
  if (v === null) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
}
function fmtNum(v: number) {
  return v.toLocaleString('pt-BR');
}
function statusColor(value: number, target: number, higherIsBetter = true): string {
  const ratio = value / target;
  if (higherIsBetter) {
    if (ratio >= 0.9) return 'text-emerald-400';
    if (ratio >= 0.7) return 'text-amber-400';
    return 'text-red-400';
  }
  if (ratio <= 1.1) return 'text-emerald-400';
  if (ratio <= 1.3) return 'text-amber-400';
  return 'text-red-400';
}
function statusEmoji(value: number, target: number, higherIsBetter = true): string {
  const ratio = value / target;
  if (higherIsBetter) {
    if (ratio >= 0.9) return '✅';
    if (ratio >= 0.7) return '⚠️';
    return '🚨';
  }
  if (ratio <= 1.1) return '✅';
  if (ratio <= 1.3) return '⚠️';
  return '🚨';
}

function countDaysInfo(from: Date, to: Date) {
  const corridos = differenceInCalendarDays(to, from) + 1;
  const uteis = getBusinessDaysInRange(from, to).length;
  return { corridos, uteis };
}

function applyPeriodShortcut(shortcut: string): { from: Date; to: Date } {
  const now = new Date();
  switch (shortcut) {
    case 'today': return { from: now, to: now };
    case '7days': return { from: subDays(now, 6), to: now };
    case '30days': return { from: subDays(now, 29), to: now };
    case 'month': return { from: startOfMonth(now), to: now };
    case 'last_month': return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
    default: return { from: now, to: now };
  }
}

const businessDayModifier = (date: Date) => isBusinessDay(date);

const REFRESH_INTERVAL = 600000; // 10 minutes
const CELEBRATION_KEY = 'tv-celebration-log-v1';

function DashboardTVContent() {
  const { blocks, isEditing } = useTVLayout();
  const [monitorSettings, setMonitorSettings] = useMonitorSettings();
  const [monitorOpen, setMonitorOpen] = useState(false);
  const now = new Date();
  const [periodRange, setPeriodRange] = useState<{ from: Date; to?: Date }>({ from: now, to: now });
  const [comparisonRange, setComparisonRange] = useState<{ from: Date; to?: Date } | undefined>(undefined);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);

  const [filters, setFilters] = useState<TVFilters>({
    period: 'custom',
    comparison: 'custom',
    onlyBusinessDays: false,
    customRange: { from: now, to: now },
  });
  const [metasOpen, setMetasOpen] = useState(false);
  const [clock, setClock] = useState(new Date());

  // Celebration & payment alert state
  const [celebrationActive, setCelebrationActive] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const [paymentFlash, setPaymentFlash] = useState(false);
  const [paymentBadge, setPaymentBadge] = useState<string | null>(null);
  const prevPagosRef = useRef<number | null>(null);
  const prevReceitaRef = useRef<number | null>(null);

  // Last update tracking
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => {
      const elapsed = Date.now() - lastUpdate.getTime();
      const remaining = Math.max(0, Math.ceil((REFRESH_INTERVAL - elapsed) / 1000));
      setCountdown(remaining);
    }, 1000);
    return () => clearInterval(t);
  }, [lastUpdate]);

  useEffect(() => {
    if (periodRange.from && periodRange.to) {
      setFilters(f => ({ ...f, period: 'custom', customRange: { from: periodRange.from, to: periodRange.to! } }));
    }
  }, [periodRange]);

  useEffect(() => {
    if (comparisonRange?.from && comparisonRange?.to) {
      setFilters(f => ({ ...f, comparison: 'custom', comparisonRange: { from: comparisonRange.from, to: comparisonRange.to! } }));
    }
  }, [comparisonRange]);

  const { data, isLoading, dataUpdatedAt } = useDashboardTV(filters);

  // Track last update time
  useEffect(() => {
    if (dataUpdatedAt) setLastUpdate(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  // Payment detection
  useEffect(() => {
    if (!data) return;
    const currentPagos = data.pagos ?? 0;
    const currentReceita = data.receitaTotal ?? 0;

    if (prevPagosRef.current !== null && currentPagos > prevPagosRef.current) {
      const diff = currentReceita - (prevReceitaRef.current ?? 0);
      playPaymentDing();
      setPaymentFlash(true);
      setPaymentBadge(`💰 +${fmtCurrency(diff)}`);
      setTimeout(() => setPaymentFlash(false), 3000);
      setTimeout(() => setPaymentBadge(null), 4000);
    }
    prevPagosRef.current = currentPagos;
    prevReceitaRef.current = currentReceita;
  }, [data?.pagos, data?.receitaTotal]);

  // Goal celebration detection
  useEffect(() => {
    if (!data?.metas) return;
    const metas = data.metas;
    const today = format(new Date(), 'yyyy-MM-dd');
    const month = format(new Date(), 'yyyy-MM');

    let celebrated: Record<string, boolean> = {};
    try {
      celebrated = JSON.parse(localStorage.getItem(CELEBRATION_KEY) || '{}');
    } catch {}

    // Daily goal check
    if (metas.valor_os > 0 && (data.receitaTotal ?? 0) >= metas.valor_os && !celebrated[`daily-${today}`]) {
      celebrated[`daily-${today}`] = true;
      localStorage.setItem(CELEBRATION_KEY, JSON.stringify(celebrated));
      setCelebrationMessage('META DIÁRIA ATINGIDA!');
      setCelebrationActive(true);
      playCelebrationFanfare();
    }
    // Monthly goal (simplified: check if monthly target exists in metas section goals)
  }, [data?.receitaTotal, data?.metas]);

  const { data: prestadores } = useQuery({
    queryKey: ['prestadores-list'],
    queryFn: async () => {
      const { data } = await supabase.from('prestadores').select('cpf, nome').order('nome');
      return data || [];
    },
    staleTime: 60000,
  });
  const { data: categorias } = useQuery({
    queryKey: ['categorias-list'],
    queryFn: async () => {
      const { data } = await supabase.from('categorias').select('id, nome').order('nome');
      return data || [];
    },
    staleTime: 60000,
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#050D1A] text-white p-6 space-y-4">
        <Skeleton className="h-16 w-full bg-gray-800/50" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-40 bg-gray-800/50" />
          <Skeleton className="h-40 bg-gray-800/50" />
          <Skeleton className="h-40 bg-gray-800/50" />
        </div>
        <Skeleton className="h-32 bg-gray-800/50" />
      </div>
    );
  }

  const metas = data?.metas;
  const variations = data?.variations ?? {} as Record<string, number | null>;
  const previous = data?.previous ?? {} as Record<string, number>;

  const taxaAgendFS = (data?.fsCriadas ?? 0) > 0 ? ((data?.agendados ?? 0) / data!.fsCriadas) * 100 : 0;
  const taxaPagosFS = (data?.fsCriadas ?? 0) > 0 ? ((data?.pagos ?? 0) / data!.fsCriadas) * 100 : 0;
  const taxaPagosAgend = (data?.agendados ?? 0) > 0 ? ((data?.pagos ?? 0) / data!.agendados) * 100 : 0;
  const taxaPagosCliques = (data?.cliquesAnuncios ?? 0) > 0 ? ((data?.pagos ?? 0) / data!.cliquesAnuncios) * 100 : 0;
  const taxaConvCliques = (data?.cliquesAnuncios ?? 0) > 0 ? ((data?.conversasIniciadas ?? 0) / data!.cliquesAnuncios) * 100 : 0;
  const taxaExecAgend = (data?.agendados ?? 0) > 0 ? ((data?.executados ?? 0) / data!.agendados) * 100 : 0;
  const conversaoTotal = (data?.cliquesAnuncios ?? 0) > 0 ? ((data?.pagos ?? 0) / data!.cliquesAnuncios) * 100 : ((data?.conversasIniciadas ?? 0) > 0 ? ((data?.pagos ?? 0) / data!.conversasIniciadas) * 100 : 0);

  const funnelSteps = [
    { label: 'Cliques', icon: '🎯', value: data?.cliquesAnuncios ?? 0, variation: variations.cliquesAnuncios ?? null, prev: previous.cliquesAnuncios ?? 0, color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/40' },
    { label: 'Conversas', icon: '💬', value: data?.conversasIniciadas ?? 0, variation: variations.conversasIniciadas ?? null, prev: previous.conversasIniciadas ?? 0, color: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/40' },
    { label: 'FS Criadas', icon: '📋', value: data?.fsCriadas ?? 0, variation: variations.fsCriadas ?? null, prev: previous.fsCriadas ?? 0, color: 'from-violet-500/20 to-violet-500/5 border-violet-500/40' },
    { label: 'Agendados', icon: '📅', value: data?.agendados ?? 0, variation: variations.agendados ?? null, prev: previous.agendados ?? 0, color: 'from-amber-500/20 to-amber-500/5 border-amber-500/40' },
    { label: 'Executados', icon: '✅', value: data?.executados ?? 0, variation: variations.executados ?? null, prev: previous.executados ?? 0, color: 'from-blue-500/20 to-blue-500/5 border-blue-500/40' },
    { label: 'Pagos', icon: '💰', value: data?.pagos ?? 0, variation: variations.pagos ?? null, prev: previous.pagos ?? 0, color: 'from-green-500/20 to-green-500/5 border-green-500/40' },
  ];

  const conversionCards = [
    { label: 'Agendados / FS', value: taxaAgendFS, meta: metas?.taxa_fs_agendado || 25, calc: `${data?.agendados ?? 0} / ${data?.fsCriadas ?? 0}` },
    { label: 'Pagos / FS', value: taxaPagosFS, meta: 20, calc: `${data?.pagos ?? 0} / ${data?.fsCriadas ?? 0}` },
    { label: 'Pagos / Agendados', value: taxaPagosAgend, meta: metas?.taxa_agendado_pago || 85, calc: `${data?.pagos ?? 0} / ${data?.agendados ?? 0}` },
    { label: 'Pagos / Cliques', value: taxaPagosCliques, meta: metas?.taxa_conversao_total || 10, calc: `${data?.pagos ?? 0} / ${data?.cliquesAnuncios ?? 0}` },
    { label: 'Conversas / Cliques', value: taxaConvCliques, meta: 60, calc: `${data?.conversasIniciadas ?? 0} / ${data?.cliquesAnuncios ?? 0}` },
    { label: 'Executados / Agendados', value: taxaExecAgend, meta: 90, calc: `${data?.executados ?? 0} / ${data?.agendados ?? 0}` },
  ];

  const timeCards = [
    { label: 'Tempo Resposta', value: data?.tempoRespostaMin ?? null, unit: 'min', target: metas?.tempo_resposta_max || 60, icon: '⚡' },
    { label: 'Recebimento Orçamento', value: data?.tempoOrcamentoMin ?? null, unit: 'min', target: metas?.tempo_orcamento_max || 120, icon: '🎯' },
    { label: 'FS → Agendado', value: data?.tempoFSAgendadoDias ?? null, unit: 'dias', target: 2, icon: '📅' },
    { label: 'Agendado → Executado', value: data?.tempoAgendadoExecDias ?? null, unit: 'dias', target: 3, icon: '🔄' },
    { label: 'Ciclo Completo', value: data?.tempoCicloCompletoDias ?? null, unit: 'dias', target: 7, icon: '🎪' },
  ];

  const tickerItems = [
    (data?.orcamentosPendentes2h ?? 0) > 0 ? `🔥 ${data!.orcamentosPendentes2h} orçamentos pendentes >2h` : null,
    data?.proximaMeta ? `🎯 ${data.proximaMeta}` : null,
    data?.npsGeral != null ? `⭐ NPS Geral: ${data.npsGeral.toFixed(1)}` : null,
    data?.avaliacaoMediaPrestadores != null ? `👷 Avaliação Prestadores: ${data.avaliacaoMediaPrestadores.toFixed(1)}` : null,
  ].filter(Boolean).join('   |   ');

  const periodInfo = periodRange.from && periodRange.to ? countDaysInfo(periodRange.from, periodRange.to) : null;
  const compInfo = comparisonRange?.from && comparisonRange?.to ? countDaysInfo(comparisonRange.from, comparisonRange.to) : null;

  const handlePeriodShortcut = (shortcut: string) => {
    const range = applyPeriodShortcut(shortcut);
    setPeriodRange(range);
    setPeriodOpen(false);
  };

  const formatRangeLabel = (range: { from: Date; to?: Date }) => {
    if (!range.to) return format(range.from, 'dd/MM/yy', { locale: ptBR });
    return `${format(range.from, 'dd/MM', { locale: ptBR })} - ${format(range.to, 'dd/MM', { locale: ptBR })}`;
  };

  const enabledBlocks = [...blocks].filter(b => b.enabled).sort((a, b) => a.order - b.order);

  // Neon card class
  const neonCard = 'bg-[#0A1628]/80 backdrop-blur-md border border-cyan-500/15 rounded-xl shadow-[0_0_15px_rgba(0,212,255,0.05)]';

  const renderBlock = (blockId: string) => {
    switch (blockId) {
      case 'kpis-principais':
        return (
          <section key={blockId} className="grid grid-cols-3 gap-3 p-4">
            {[
              {
                label: 'Receita Total', value: fmtCurrency(data?.receitaTotal ?? 0),
                variation: variations.receitaTotal ?? null,
                prevValue: fmtCurrency(previous.receitaTotal ?? 0),
                meta: metas?.valor_os, progress: metas?.valor_os ? Math.min(((data?.receitaTotal ?? 0) / metas.valor_os) * 100, 100) : null,
                sub: `Ticket Médio: ${fmtCurrency(data?.ticketMedio ?? 0)}`,
                accent: 'border-cyan-500/30',
              },
              {
                label: 'Lucro Bruto', value: fmtCurrency(data?.lucroBruto ?? 0),
                variation: variations.lucroBruto ?? null,
                prevValue: fmtCurrency(previous.lucroBruto ?? 0),
                meta: metas?.lucro_bruto, progress: metas?.lucro_bruto ? Math.min(((data?.lucroBruto ?? 0) / metas.lucro_bruto) * 100, 100) : null,
                sub: `Margem: ${(data?.margemMedia ?? 0).toFixed(1)}%`,
                accent: 'border-emerald-500/30',
              },
              {
                label: 'Serviços Fechados', value: fmtNum(data?.servicosFechados ?? 0),
                variation: variations.servicosFechados ?? null,
                prevValue: fmtNum(previous.servicosFechados ?? 0),
                meta: metas?.quantidade_servicos, progress: metas?.quantidade_servicos ? Math.min(((data?.servicosFechados ?? 0) / metas.quantidade_servicos) * 100, 100) : null,
                sub: `Conv. Total: ${conversaoTotal.toFixed(1)}%`,
                accent: 'border-violet-500/30',
              },
            ].map((kpi, i) => (
              <div key={i} className={cn(neonCard, kpi.accent, 'p-4 transition-all duration-500')}>
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{kpi.label}</div>
                <div className="text-2xl font-bold text-white">{kpi.value}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn('text-sm font-semibold', kpi.variation !== null && kpi.variation >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {kpi.variation !== null ? (kpi.variation >= 0 ? '↑' : '↓') : ''} {fmtPct(kpi.variation)}
                  </span>
                  <span className="text-[10px] text-gray-500">ant: {kpi.prevValue}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{kpi.sub}</div>
                {kpi.progress !== null && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                      <span>Meta: {kpi.meta ? (typeof kpi.meta === 'number' && kpi.label.includes('Serviço') ? fmtNum(kpi.meta) : fmtCurrency(kpi.meta)) : '—'}</span>
                      <span>{kpi.progress.toFixed(0)}%</span>
                    </div>
                    <Progress value={kpi.progress} className="h-1.5" />
                  </div>
                )}
              </div>
            ))}
          </section>
        );

      case 'funil-vendas':
        return (
          <section key={blockId} className="px-4 pb-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Funil de Vendas — Conversão ao Vivo</div>
            <div className="flex items-center gap-1">
              {funnelSteps.map((step, i) => (
                <React.Fragment key={i}>
                  <div className={cn('flex-1 bg-gradient-to-b border rounded-lg p-2 text-center backdrop-blur-sm', step.color)}>
                    <div className="text-lg">{step.icon}</div>
                    <div className="text-xl font-bold text-white">{fmtNum(step.value)}</div>
                    <div className="text-[10px] text-gray-300">{step.label}</div>
                    <div className="flex items-center justify-center gap-1">
                      <span className={cn('text-[10px] font-semibold', step.variation !== null && step.variation >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {fmtPct(step.variation)}
                      </span>
                      <span className="text-[9px] text-gray-500">({fmtNum(step.prev)})</span>
                    </div>
                  </div>
                  {i < funnelSteps.length - 1 && <span className="text-cyan-500/40 text-lg">→</span>}
                </React.Fragment>
              ))}
            </div>
            <div className="text-center text-xs text-gray-500 mt-1">
              Conversão Total: {(data?.cliquesAnuncios ?? 0) > 0 ? `${fmtNum(data!.cliquesAnuncios)} → ${fmtNum(data?.pagos ?? 0)} = ${conversaoTotal.toFixed(1)}%` : `${fmtNum(data?.conversasIniciadas ?? 0)} → ${fmtNum(data?.pagos ?? 0)}`}
            </div>
          </section>
        );

      case 'taxas-conversao':
        return (
          <section key={blockId} className="px-4 pb-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Taxas de Conversão</div>
            <div className="grid grid-cols-6 gap-2">
              {conversionCards.map((c, i) => {
                const pct = c.value;
                const status = pct >= c.meta * 0.9 ? 'emerald' : pct >= c.meta * 0.7 ? 'amber' : 'red';
                return (
                  <div key={i} className={cn(neonCard, 'p-2 text-center')}>
                    <div className="text-[10px] text-gray-400 truncate">{c.label}</div>
                    <div className={cn('text-lg font-bold', `text-${status}-400`)}>{pct.toFixed(1)}%</div>
                    <div className="text-[9px] text-gray-500">{c.calc}</div>
                    <Progress value={Math.min((pct / c.meta) * 100, 100)} className="h-1 mt-1" />
                    <div className="text-[9px] text-gray-500 mt-0.5">Meta: {c.meta}%</div>
                  </div>
                );
              })}
            </div>
          </section>
        );

      case 'metricas-tempo':
        return (
          <section key={blockId} className="px-4 pb-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Métricas de Tempo</div>
            <div className="grid grid-cols-5 gap-2">
              {timeCards.map((t, i) => {
                const hasValue = t.value !== null;
                const emoji = hasValue ? statusEmoji(t.value!, t.target, false) : '—';
                return (
                  <div key={i} className={cn(neonCard, 'p-2 text-center')}>
                    <div className="text-lg">{t.icon}</div>
                    <div className="text-[10px] text-gray-400">{t.label}</div>
                    <div className={cn('text-lg font-bold', hasValue ? statusColor(t.value!, t.target, false) : 'text-gray-500')}>
                      {hasValue ? `${t.value} ${t.unit}` : 'S/D'} {hasValue ? emoji : ''}
                    </div>
                    <div className="text-[9px] text-gray-500">Meta: {'<'}{t.target} {t.unit}</div>
                  </div>
                );
              })}
            </div>
          </section>
        );

      case 'conversas-abertas':
        if (!data?.conversasAbertas) return null;
        return (
          <section key={blockId} className="px-4 pb-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
              📞 Conversas em Aberto — <span className="text-amber-400 font-bold">{data.conversasAbertas.total}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={cn(neonCard, 'p-3')}>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Quantidade por Status</div>
                <div className="space-y-1.5">
                  {(data.conversasAbertas.porStatus || []).map((s, i) => {
                    const pct = data.conversasAbertas.total > 0 ? (s.count / data.conversasAbertas.total) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <span className="text-xs text-gray-300 truncate w-[140px]">{s.status}</span>
                          <div className="flex-1 bg-gray-800/60 rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-bold text-white w-8 text-right">{s.count}</span>
                      </div>
                    );
                  })}
                  {(data.conversasAbertas.porStatus || []).length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-2">Nenhuma conversa em aberto</div>
                  )}
                </div>
              </div>
              <div className={cn(neonCard, 'p-3')}>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">🔥 Aguardando Resposta — Mais Tempo</div>
                <div className="space-y-1 max-h-[160px] overflow-y-auto">
                  {(data.conversasAbertas.rankingSemResposta || []).map((c, i) => {
                    const horas = Math.floor(c.tempoSemResposta / 60);
                    const mins = c.tempoSemResposta % 60;
                    const tempoStr = horas > 0 ? `${horas}h${mins}m` : `${mins}m`;
                    const urgente = c.tempoSemResposta > 120;
                    const muitoUrgente = c.tempoSemResposta > 480;
                    return (
                      <div key={i} className={cn(
                        'flex items-center justify-between py-1 px-2 rounded text-xs',
                        muitoUrgente ? 'bg-red-500/10 border border-red-500/30' : urgente ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-gray-800/40'
                      )}>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-gray-500 w-4 text-right">{i + 1}.</span>
                          <span className="text-gray-300 truncate">{c.nome}</span>
                          <span className="text-[9px] text-gray-500 shrink-0">{c.status}</span>
                        </div>
                        <span className={cn(
                          'font-mono font-bold shrink-0 ml-2',
                          muitoUrgente ? 'text-red-400' : urgente ? 'text-amber-400' : 'text-gray-400'
                        )}>
                          {muitoUrgente ? '🚨' : urgente ? '⚠️' : ''} {tempoStr}
                        </span>
                      </div>
                    );
                  })}
                  {(data.conversasAbertas.rankingSemResposta || []).length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-2">Todas respondidas ✅</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        );

      case 'metas-resultados':
        return <MetasResultadosSection key={blockId} isLayoutEditing={isEditing} />;

      default:
        return null;
    }
  };

  const countdownMin = Math.floor(countdown / 60);
  const countdownSec = countdown % 60;

  return (
    <div
      className={cn(
        'min-h-screen bg-[#050D1A] text-white overflow-hidden transition-all',
        paymentFlash && 'ring-4 ring-emerald-400/60 ring-inset animate-pulse'
      )}
      style={{
        padding: `${monitorSettings.safeZone * 0.5}%`,
        fontSize: `${monitorSettings.fontSize}%`,
        filter: `brightness(${monitorSettings.brightness}%)`,
      }}
    >
      {/* HEADER */}
      <header className="bg-[#0A1628]/90 backdrop-blur-md border-b border-cyan-500/10 px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <img src={logoGreen} alt="24Help" className="h-7" />
            <span className="text-sm font-bold tracking-wider text-cyan-300 uppercase">Centro de Comando de Vendas</span>
          </div>
          <div className="flex items-center gap-3">
            <TVLayoutCustomizer />
            <Button variant="outline" size="sm" onClick={() => setMonitorOpen(true)} className="h-7 text-xs bg-gray-800/80 border-gray-700 gap-1 hover:bg-gray-700 text-gray-300">
              <Settings className="h-3 w-3" />
            </Button>
            <span className="flex items-center gap-1.5 text-xs">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 font-medium">AO VIVO</span>
            </span>
            <div className="text-right">
              <span className="text-xs text-gray-400 font-mono block">
                {format(clock, "dd MMM yyyy HH:mm:ss", { locale: ptBR }).toUpperCase()}
              </span>
              <span className="text-[9px] text-gray-500">
                Atualizado: {format(lastUpdate, 'HH:mm')} · Próx: {countdownMin}:{String(countdownSec).padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>
        {/* FILTERS ROW */}
        <div className="flex items-center gap-2 flex-wrap">
          <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-7 bg-gray-800/80 border-cyan-500/20 text-xs gap-1.5 text-gray-300">
                <CalendarIcon className="h-3 w-3" />
                <span>Período: {formatRangeLabel(periodRange)}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-700" align="start">
              <div className="flex gap-1 p-2 border-b border-gray-800 flex-wrap">
                {[
                  { label: 'Hoje', value: 'today' },
                  { label: '7 dias', value: '7days' },
                  { label: '30 dias', value: '30days' },
                  { label: 'Mês', value: 'month' },
                  { label: 'Mês Ant.', value: 'last_month' },
                ].map(s => (
                  <Button key={s.value} variant="ghost" size="sm" className="h-6 text-[10px] text-gray-300 hover:text-white hover:bg-gray-700" onClick={() => handlePeriodShortcut(s.value)}>
                    {s.label}
                  </Button>
                ))}
              </div>
              <Calendar
                mode="range"
                selected={periodRange}
                onSelect={(range: any) => {
                  if (range) setPeriodRange(range);
                  if (range?.from && range?.to) setPeriodOpen(false);
                }}
                locale={ptBR}
                numberOfMonths={2}
                className="p-3 pointer-events-auto"
                modifiers={{ businessDay: businessDayModifier }}
                modifiersStyles={{ businessDay: { position: 'relative' } }}
                modifiersClassNames={{ businessDay: 'business-day-marker' }}
              />
            </PopoverContent>
          </Popover>

          <Popover open={comparisonOpen} onOpenChange={setComparisonOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-7 bg-gray-800/80 border-cyan-500/20 text-xs gap-1.5 text-gray-300">
                <CalendarIcon className="h-3 w-3" />
                <span>{comparisonRange?.from && comparisonRange?.to ? `Comparar: ${formatRangeLabel(comparisonRange)}` : 'Comparar...'}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-700" align="start">
              <div className="flex gap-1 p-2 border-b border-gray-800 flex-wrap">
                {periodRange.from && periodRange.to && [
                  { label: 'Período anterior', value: 'prev_period' },
                  { label: 'Mês anterior', value: 'prev_month' },
                ].map(s => (
                  <Button key={s.value} variant="ghost" size="sm" className="h-6 text-[10px] text-gray-300 hover:text-white hover:bg-gray-700" onClick={() => {
                    const days = differenceInCalendarDays(periodRange.to!, periodRange.from) + 1;
                    if (s.value === 'prev_period') {
                      const to = subDays(periodRange.from, 1);
                      const from = subDays(to, days - 1);
                      setComparisonRange({ from, to });
                    } else {
                      const from = startOfMonth(subMonths(periodRange.from, 1));
                      const to = endOfMonth(subMonths(periodRange.from, 1));
                      setComparisonRange({ from, to });
                    }
                    setComparisonOpen(false);
                  }}>
                    {s.label}
                  </Button>
                ))}
                {comparisonRange && (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-400 hover:text-red-300 hover:bg-gray-700" onClick={() => {
                    setComparisonRange(undefined);
                    setFilters(f => ({ ...f, comparison: 'yesterday', comparisonRange: undefined }));
                    setComparisonOpen(false);
                  }}>
                    Limpar
                  </Button>
                )}
              </div>
              <Calendar
                mode="range"
                selected={comparisonRange}
                onSelect={(range: any) => {
                  if (range) setComparisonRange(range);
                  if (range?.from && range?.to) setComparisonOpen(false);
                }}
                locale={ptBR}
                numberOfMonths={2}
                className="p-3 pointer-events-auto"
                modifiers={{ businessDay: businessDayModifier }}
                modifiersStyles={{ businessDay: { position: 'relative' } }}
                modifiersClassNames={{ businessDay: 'business-day-marker' }}
              />
            </PopoverContent>
          </Popover>

          {periodInfo && (
            <Badge variant="outline" className="h-6 text-[10px] border-cyan-500/20 text-gray-300 font-normal">
              {periodInfo.corridos}d | {periodInfo.uteis} DU
            </Badge>
          )}
          {compInfo && (
            <>
              <span className="text-[10px] text-gray-500">vs</span>
              <Badge variant="outline" className="h-6 text-[10px] border-cyan-500/20 text-gray-300 font-normal">
                {compInfo.corridos}d | {compInfo.uteis} DU
              </Badge>
            </>
          )}

          <div className="flex items-center gap-1">
            <Switch
              checked={filters.onlyBusinessDays}
              onCheckedChange={v => setFilters(f => ({ ...f, onlyBusinessDays: v }))}
              className="h-4 w-7"
            />
            <span className="text-[10px] text-gray-400">Dias úteis</span>
          </div>
          <Select value={filters.prestadorCpf || '__all'} onValueChange={v => setFilters(f => ({ ...f, prestadorCpf: v === '__all' ? undefined : v }))}>
            <SelectTrigger className="h-7 w-[160px] bg-gray-800/80 border-cyan-500/15 text-xs text-gray-300"><SelectValue placeholder="Todos Prestadores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos Prestadores</SelectItem>
              {(prestadores || []).map(p => (
                <SelectItem key={p.cpf} value={p.cpf}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.categoriaId?.toString() || '__all'} onValueChange={v => setFilters(f => ({ ...f, categoriaId: v === '__all' ? undefined : Number(v) }))}>
            <SelectTrigger className="h-7 w-[150px] bg-gray-800/80 border-cyan-500/15 text-xs text-gray-300"><SelectValue placeholder="Todas Categorias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas Categorias</SelectItem>
              {(categorias || []).map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-7 text-xs bg-gray-800/80 border-cyan-500/20 text-gray-300" onClick={() => setMetasOpen(true)}>
            🎯 Metas
          </Button>
          {data?.comparisonLabel && (
            <span className="text-[10px] text-amber-400 font-medium ml-1">{data.comparisonLabel}</span>
          )}
        </div>
      </header>

      {/* GOAL BARS */}
      <TVGoalBars
        dailyActual={data?.receitaTotal ?? 0}
        dailyTarget={metas?.valor_os ?? 0}
        monthlyActual={data?.receitaTotal ?? 0}
        monthlyTarget={(metas?.valor_os ?? 0) * 22}
        onEditMetas={() => setMetasOpen(true)}
      />

      {/* DYNAMIC BLOCKS - CSS GRID */}
      <div className="grid grid-cols-6 gap-0">
        {enabledBlocks.map(block => (
          <div
            key={block.id}
            className="transition-all"
            style={{
              gridColumn: `span ${block.cols}`,
              minHeight: block.minHeight > 0 ? `${block.minHeight}px` : undefined,
            }}
          >
            {renderBlock(block.id)}
          </div>
        ))}
      </div>

      {/* PAYMENT BADGE */}
      {paymentBadge && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none animate-bounce">
          <div className="text-4xl font-black text-emerald-400 bg-emerald-500/10 backdrop-blur-sm px-8 py-4 rounded-2xl border-2 border-emerald-400/50 shadow-[0_0_40px_rgba(16,185,129,0.4)]">
            {paymentBadge}
          </div>
        </div>
      )}

      {/* CELEBRATION */}
      <TVCelebration
        active={celebrationActive}
        message={celebrationMessage}
        onComplete={() => setCelebrationActive(false)}
      />

      {/* TICKER */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0A1628]/90 backdrop-blur-md border-t border-cyan-500/10 px-4 py-2">
        <div className="overflow-hidden">
          <div className="animate-marquee whitespace-nowrap text-xs text-gray-300">
            {tickerItems || 'Carregando alertas...'}
          </div>
        </div>
      </footer>

      <MetasModal open={metasOpen} onClose={() => setMetasOpen(false)} />
      <TVMonitorSettings open={monitorOpen} onClose={() => setMonitorOpen(false)} settings={monitorSettings} onUpdate={setMonitorSettings} />

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .business-day-marker::after {
          content: '';
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background-color: #00FF88;
        }
      `}</style>
    </div>
  );
}

export default function DashboardTV() {
  return (
    <TVLayoutProvider>
      <DashboardTVContent />
    </TVLayoutProvider>
  );
}
