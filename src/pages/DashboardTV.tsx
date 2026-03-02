import React, { useState, useEffect, useRef } from 'react';
import { useDashboardTV, TVFilters } from '@/hooks/useDashboardTV';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { MetasModal } from '@/components/dashboard/tv/MetasModal';
import { TVFreeformProvider, useTVFreeform } from '@/contexts/TVFreeformContext';
import { TVFreeformCanvas } from '@/components/dashboard/tv/TVFreeformCanvas';
import { TVWidgetProperties } from '@/components/dashboard/tv/TVWidgetProperties';
// MetasResultadosSection removed — replaced by independent widgets
import { TVCelebration } from '@/components/dashboard/tv/TVCelebration';
import { TVAutoSizeWidget } from '@/components/dashboard/tv/TVAutoSizeWidget';
import { TVMonitorSettings, useMonitorSettings } from '@/components/dashboard/tv/TVMonitorSettings';
import { playPaymentDing, playCelebrationFanfare } from '@/lib/tvSounds';
import { format, differenceInCalendarDays, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, subMonths } from 'date-fns';
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
import { isBusinessDay, getBusinessDaysInRange } from '@/lib/businessDays2026';
import { Calendar as CalendarIcon, Settings, Pencil, X } from 'lucide-react';
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

const REFRESH_INTERVAL = 600000;
const CELEBRATION_KEY = 'tv-celebration-log-v1';

function DashboardTVContent() {
  const { isEditing, setIsEditing } = useTVFreeform();
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

  const [celebrationActive, setCelebrationActive] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const [paymentFlash, setPaymentFlash] = useState(false);
  const [paymentBadge, setPaymentBadge] = useState<string | null>(null);
  const prevPagosRef = useRef<number | null>(null);
  const prevReceitaRef = useRef<number | null>(null);

  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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

  useEffect(() => {
    if (dataUpdatedAt) setLastUpdate(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

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

  useEffect(() => {
    if (!data?.metas) return;
    const metas = data.metas;
    const today = format(new Date(), 'yyyy-MM-dd');
    let celebrated: Record<string, boolean> = {};
    try { celebrated = JSON.parse(localStorage.getItem(CELEBRATION_KEY) || '{}'); } catch {}
    if (metas.valor_os > 0 && (data.receitaTotal ?? 0) >= metas.valor_os && !celebrated[`daily-${today}`]) {
      celebrated[`daily-${today}`] = true;
      localStorage.setItem(CELEBRATION_KEY, JSON.stringify(celebrated));
      setCelebrationMessage('META DIÁRIA ATINGIDA!');
      setCelebrationActive(true);
      playCelebrationFanfare();
    }
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

  // Query independent: Agendamentos e Finalizados do dia e do mês (via ficha_status_historico)
  const { data: metasIndependentes } = useQuery({
    queryKey: ['tv-metas-independentes'],
    queryFn: async () => {
      const now = new Date();
      const diaFrom = startOfDay(now).toISOString();
      const diaTo = endOfDay(now).toISOString();
      const mesFrom = startOfMonth(now).toISOString();
      const mesTo = endOfMonth(now).toISOString();

      // Buscar fichas que entraram em "Agendado" (via histórico de status)
      const [agendDia, agendMes, finDia, finMes] = await Promise.all([
        supabase.from('ficha_status_historico').select('ficha_id').eq('status_novo', 'Agendado').gte('data_inicio', diaFrom).lte('data_inicio', diaTo),
        supabase.from('ficha_status_historico').select('ficha_id').eq('status_novo', 'Agendado').gte('data_inicio', mesFrom).lte('data_inicio', mesTo),
        supabase.from('ficha_status_historico').select('ficha_id').eq('status_novo', 'Finalizado').gte('data_inicio', diaFrom).lte('data_inicio', diaTo),
        supabase.from('ficha_status_historico').select('ficha_id').eq('status_novo', 'Finalizado').gte('data_inicio', mesFrom).lte('data_inicio', mesTo),
      ]);

      const agendDiaIds = [...new Set((agendDia.data || []).map(r => r.ficha_id))];
      const agendMesIds = [...new Set((agendMes.data || []).map(r => r.ficha_id))];
      const finDiaIds = [...new Set((finDia.data || []).map(r => r.ficha_id))];
      const finMesIds = [...new Set((finMes.data || []).map(r => r.ficha_id))];

      // Buscar valor_total das fichas agendadas
      let valorAgendDia = 0;
      let valorAgendMes = 0;
      let valorFinDia = 0;
      let valorFinMes = 0;

      if (agendDiaIds.length > 0) {
        const { data: fichas } = await supabase.from('fichas_de_servico').select('valor_total').in('id', agendDiaIds);
        valorAgendDia = (fichas || []).reduce((s, f) => s + (f.valor_total || 0), 0);
      }
      if (agendMesIds.length > 0) {
        const { data: fichas } = await supabase.from('fichas_de_servico').select('valor_total').in('id', agendMesIds);
        valorAgendMes = (fichas || []).reduce((s, f) => s + (f.valor_total || 0), 0);
      }
      if (finDiaIds.length > 0) {
        const { data: fichas } = await supabase.from('fichas_de_servico').select('valor_total').in('id', finDiaIds);
        valorFinDia = (fichas || []).reduce((s, f) => s + (f.valor_total || 0), 0);
      }
      if (finMesIds.length > 0) {
        const { data: fichas } = await supabase.from('fichas_de_servico').select('valor_total').in('id', finMesIds);
        valorFinMes = (fichas || []).reduce((s, f) => s + (f.valor_total || 0), 0);
      }

      return {
        agendamentosDia: agendDiaIds.length,
        agendamentosMes: agendMesIds.length,
        valorAgendDia,
        valorAgendMes,
        finalizadosDia: finDiaIds.length,
        finalizadosMes: finMesIds.length,
        valorFinDia,
        valorFinMes,
      };
    },
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 15000,
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#050D1A] text-white p-6 space-y-4">
        <Skeleton className="h-16 w-full bg-gray-800/50" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 bg-gray-800/50" />
          ))}
        </div>
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

  // ----- Individual Widget Renderers -----

  const renderKPIWidget = (
    label: string, value: string, variation: number | null, prevValue: string,
    sub: string, accent: string, meta?: number, progress?: number | null, metaLabel?: string,
  ) => (
    <TVAutoSizeWidget neonBorder={accent}>
      {(dims) => (
        <div className="w-full h-full flex flex-col justify-center" style={{ padding: dims.padding }}>
          <div className="text-gray-400 uppercase tracking-wider truncate" style={{ fontSize: dims.labelFontSize }}>{label}</div>
          <div className="font-bold text-white leading-none mt-1" style={{ fontSize: dims.valueFontSize }}>{value}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('font-semibold', variation !== null && variation >= 0 ? 'text-emerald-400' : 'text-red-400')} style={{ fontSize: dims.subFontSize }}>
              {variation !== null ? (variation >= 0 ? '↑' : '↓') : ''} {fmtPct(variation)}
            </span>
            <span className="text-gray-500" style={{ fontSize: Math.max(7, dims.subFontSize * 0.8) }}>ant: {prevValue}</span>
          </div>
          <div className="text-gray-500 mt-0.5" style={{ fontSize: dims.subFontSize }}>{sub}</div>
          {progress !== null && progress !== undefined && (
            <div className="mt-auto pt-1">
              <div className="flex justify-between text-gray-500" style={{ fontSize: Math.max(7, dims.subFontSize * 0.8) }}>
                <span>Meta: {metaLabel || '—'}</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}
        </div>
      )}
    </TVAutoSizeWidget>
  );

  const renderFunnelWidget = (
    label: string, icon: string, value: number, variation: number | null,
    prev: number, borderColor: string,
  ) => (
    <TVAutoSizeWidget neonBorder={borderColor}>
      {(dims) => (
        <div className="w-full h-full flex flex-col items-center justify-center" style={{ padding: dims.padding }}>
          <div style={{ fontSize: dims.iconSize }}>{icon}</div>
          <div className="font-bold text-white leading-none mt-1" style={{ fontSize: dims.valueFontSize }}>{fmtNum(value)}</div>
          <div className="text-gray-300 mt-1" style={{ fontSize: dims.labelFontSize }}>{label}</div>
          <div className="flex items-center gap-1 mt-1">
            <span className={cn('font-semibold', variation !== null && variation >= 0 ? 'text-emerald-400' : 'text-red-400')} style={{ fontSize: dims.subFontSize }}>
              {fmtPct(variation)}
            </span>
            <span className="text-gray-500" style={{ fontSize: Math.max(7, dims.subFontSize * 0.85) }}>({fmtNum(prev)})</span>
          </div>
        </div>
      )}
    </TVAutoSizeWidget>
  );

  const renderConversionWidget = (
    label: string, value: number, meta: number, calc: string,
  ) => {
    const pct = value;
    const status = pct >= meta * 0.9 ? 'emerald' : pct >= meta * 0.7 ? 'amber' : 'red';
    const borderColor = `border-${status}-500/30`;
    return (
      <TVAutoSizeWidget neonBorder={borderColor}>
        {(dims) => (
          <div className="w-full h-full flex flex-col items-center justify-center" style={{ padding: dims.padding }}>
            <div className="text-gray-400 truncate text-center" style={{ fontSize: dims.labelFontSize }}>{label}</div>
            <div className={cn('font-bold leading-none mt-1', `text-${status}-400`)} style={{ fontSize: dims.valueFontSize }}>
              {pct.toFixed(1)}%
            </div>
            <div className="text-gray-500 mt-1" style={{ fontSize: dims.subFontSize }}>{calc}</div>
            <div className="w-full mt-auto pt-1">
              <Progress value={Math.min((pct / meta) * 100, 100)} className="h-1" />
              <div className="text-gray-500 text-center mt-0.5" style={{ fontSize: Math.max(7, dims.subFontSize * 0.85) }}>Meta: {meta}%</div>
            </div>
          </div>
        )}
      </TVAutoSizeWidget>
    );
  };

  const renderTimeWidget = (
    label: string, icon: string, value: number | null, unit: string, target: number,
  ) => {
    const hasValue = value !== null;
    const emoji = hasValue ? statusEmoji(value!, target, false) : '—';
    return (
      <TVAutoSizeWidget neonBorder={hasValue ? (value! <= target * 1.1 ? 'border-emerald-500/30' : 'border-red-500/30') : 'border-gray-500/20'}>
        {(dims) => (
          <div className="w-full h-full flex flex-col items-center justify-center" style={{ padding: dims.padding }}>
            <div style={{ fontSize: dims.iconSize }}>{icon}</div>
            <div className="text-gray-400 mt-1" style={{ fontSize: dims.labelFontSize }}>{label}</div>
            <div className={cn('font-bold leading-none mt-1', hasValue ? statusColor(value!, target, false) : 'text-gray-500')} style={{ fontSize: dims.valueFontSize }}>
              {hasValue ? `${value} ${unit}` : 'S/D'} {hasValue ? emoji : ''}
            </div>
            <div className="text-gray-500 mt-1" style={{ fontSize: dims.subFontSize }}>Meta: {'<'}{target} {unit}</div>
          </div>
        )}
      </TVAutoSizeWidget>
    );
  };

  const renderGoalGauge = (label: string, actual: number, target: number, isCurrency = false) => {
    const pct = target > 0 ? (actual / target) * 100 : 0;
    const clampPct = Math.min(pct, 120);
    const arcColor = pct >= 100 ? '#a855f7' : pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';
    const borderColor = pct >= 100 ? 'border-purple-500/30' : pct >= 80 ? 'border-emerald-500/30' : pct >= 50 ? 'border-amber-500/30' : 'border-red-500/30';
    const pctColor = pct >= 100 ? 'text-purple-400' : pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
    const statusText = pct >= 100 ? 'Meta atingida!' : pct >= 80 ? 'Quase lá!' : pct >= 50 ? 'Em progresso' : 'Atenção';
    const fmtVal = isCurrency ? fmtCurrency : fmtNum;

    const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy - r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy - r * Math.sin(endAngle);
      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
      return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`;
    };

    return (
      <TVAutoSizeWidget neonBorder={borderColor}>
        {(dims) => {
          const gaugeSize = Math.min(dims.width * 0.9, dims.height * 0.65);
          const radius = gaugeSize * 0.4;
          const strokeWidth = gaugeSize * 0.09;
          const cx = gaugeSize / 2;
          const cy = gaugeSize * 0.46;
          const startAngle = Math.PI;
          const fillAngle = startAngle - (clampPct / 120) * Math.PI;
          const bgPath = describeArc(cx, cy, radius, 0, startAngle);
          const fillPath = describeArc(cx, cy, radius, fillAngle, startAngle);
          const gradId = `grad-${arcColor.replace('#', '')}-${label.replace(/\s/g, '')}`;

          return (
            <div className="w-full h-full flex flex-col items-center justify-center" style={{ padding: dims.padding }}>
              <span className="font-semibold text-gray-300 text-center" style={{ fontSize: dims.labelFontSize }}>{label}</span>
              <svg viewBox={`0 0 ${gaugeSize} ${gaugeSize * 0.55}`} className="mx-auto" style={{ width: gaugeSize, maxWidth: '100%' }}>
                <defs>
                  <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={arcColor} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={arcColor} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <path d={bgPath} fill="none" stroke="#374151" strokeWidth={strokeWidth} strokeLinecap="round" />
                <path d={fillPath} fill="none" stroke={`url(#${gradId})`} strokeWidth={strokeWidth} strokeLinecap="round" />
                <text x={cx} y={cy - 2} textAnchor="middle" className="fill-white font-bold" style={{ fontSize: gaugeSize * 0.18 }}>
                  {pct.toFixed(0)}%
                </text>
              </svg>
              <div className="text-center -mt-1">
                <span className="text-white font-bold" style={{ fontSize: dims.valueFontSize * 0.55 }}>{fmtVal(actual)}</span>
                <span className="text-gray-500" style={{ fontSize: dims.subFontSize }}> / {fmtVal(target)}</span>
              </div>
              <span className={cn('text-center mt-0.5', pctColor)} style={{ fontSize: dims.subFontSize }}>{statusText}</span>
            </div>
          );
        }}
      </TVAutoSizeWidget>
    );
  };

  const renderBlock = (blockId: string) => {
    switch (blockId) {
      case 'receita-total':
        return renderKPIWidget(
          'Receita Total', fmtCurrency(data?.receitaTotal ?? 0),
          variations.receitaTotal ?? null, fmtCurrency(previous.receitaTotal ?? 0),
          `Ticket Médio: ${fmtCurrency(data?.ticketMedio ?? 0)}`, 'border-cyan-500/30',
          metas?.valor_os,
          metas?.valor_os ? Math.min(((data?.receitaTotal ?? 0) / metas.valor_os) * 100, 100) : null,
          metas?.valor_os ? fmtCurrency(metas.valor_os) : undefined,
        );
      case 'lucro-bruto':
        return renderKPIWidget(
          'Lucro Bruto', fmtCurrency(data?.lucroBruto ?? 0),
          variations.lucroBruto ?? null, fmtCurrency(previous.lucroBruto ?? 0),
          `Margem: ${(data?.margemMedia ?? 0).toFixed(1)}%`, 'border-emerald-500/30',
          metas?.lucro_bruto,
          metas?.lucro_bruto ? Math.min(((data?.lucroBruto ?? 0) / metas.lucro_bruto) * 100, 100) : null,
          metas?.lucro_bruto ? fmtCurrency(metas.lucro_bruto) : undefined,
        );
      case 'servicos-fechados':
        return renderKPIWidget(
          'Serviços Fechados', fmtNum(data?.servicosFechados ?? 0),
          variations.servicosFechados ?? null, fmtNum(previous.servicosFechados ?? 0),
          `Conv. Total: ${conversaoTotal.toFixed(1)}%`, 'border-violet-500/30',
          metas?.quantidade_servicos,
          metas?.quantidade_servicos ? Math.min(((data?.servicosFechados ?? 0) / metas.quantidade_servicos) * 100, 100) : null,
          metas?.quantidade_servicos ? fmtNum(metas.quantidade_servicos) : undefined,
        );
      case 'ticket-medio':
        return renderKPIWidget(
          'Ticket Médio', fmtCurrency(data?.ticketMedio ?? 0),
          null, '—', `Meta: ${metas?.ticket_medio ? fmtCurrency(metas.ticket_medio) : '—'}`,
          'border-amber-500/30',
        );
      case 'margem-media':
        return renderKPIWidget(
          'Margem Média', `${(data?.margemMedia ?? 0).toFixed(1)}%`,
          null, '—', `Lucro: ${fmtCurrency(data?.lucroBruto ?? 0)}`,
          'border-pink-500/30',
        );
      case 'conversao-total':
        return renderKPIWidget(
          'Conversão Total', `${conversaoTotal.toFixed(1)}%`,
          null, '—',
          `${fmtNum(data?.pagos ?? 0)} pagos de ${fmtNum(data?.cliquesAnuncios || data?.conversasIniciadas || 0)}`,
          'border-indigo-500/30',
        );

      // Metas individuais (8 widgets independentes)
      // ── Metas de Agendamentos ──
      case 'meta-diaria-os': {
        const actual = metasIndependentes?.agendamentosDia ?? 0;
        const target = metas?.quantidade_agendados ?? metas?.quantidade_servicos ?? 5;
        return renderGoalGauge('🎯 Meta Diária — Agendamentos', actual, target);
      }
      case 'meta-mensal-os': {
        const actual = metasIndependentes?.agendamentosMes ?? 0;
        const target = (metas?.quantidade_agendados ?? metas?.quantidade_servicos ?? 5) * 22;
        return renderGoalGauge('📅 Meta Mensal — Agendamentos', actual, target);
      }
      case 'meta-diaria-receita':
        return renderGoalGauge('💰 Meta Diária — Valor OS Agendados', metasIndependentes?.valorAgendDia ?? 0, metas?.valor_os ?? 0, true);
      case 'meta-mensal-receita':
        return renderGoalGauge('📊 Meta Mensal — Valor OS Agendados', metasIndependentes?.valorAgendMes ?? 0, (metas?.valor_os ?? 0) * 22, true);

      // ── Metas de Finalizados ──
      case 'meta-diaria-finalizados': {
        const actual = metasIndependentes?.finalizadosDia ?? 0;
        const target = metas?.quantidade_servicos ?? 3;
        return renderGoalGauge('✅ Meta Diária — Finalizados', actual, target);
      }
      case 'meta-mensal-finalizados': {
        const actual = metasIndependentes?.finalizadosMes ?? 0;
        const target = (metas?.quantidade_servicos ?? 3) * 22;
        return renderGoalGauge('📋 Meta Mensal — Finalizados', actual, target);
      }

      // ── Resultados ──
      case 'resultado-hoje-os':
        return renderKPIWidget(
          'Agendamentos Hoje', fmtNum(metasIndependentes?.agendamentosDia ?? 0),
          null, '—', `Valor: ${fmtCurrency(metasIndependentes?.valorAgendDia ?? 0)}`, 'border-cyan-500/30',
        );
      case 'resultado-mensal-os':
        return renderKPIWidget(
          'Agendamentos do Mês', fmtNum(metasIndependentes?.agendamentosMes ?? 0),
          null, '—', `Valor: ${fmtCurrency(metasIndependentes?.valorAgendMes ?? 0)}`, 'border-violet-500/30',
        );
      case 'resultado-hoje-receita':
        return renderKPIWidget(
          'Finalizados Hoje', fmtNum(metasIndependentes?.finalizadosDia ?? 0),
          null, '—', `Valor: ${fmtCurrency(metasIndependentes?.valorFinDia ?? 0)}`, 'border-emerald-500/30',
        );
      case 'resultado-mensal-receita':
        return renderKPIWidget(
          'Finalizados do Mês', fmtNum(metasIndependentes?.finalizadosMes ?? 0),
          null, '—', `Valor: ${fmtCurrency(metasIndependentes?.valorFinMes ?? 0)}`, 'border-amber-500/30',
        );

      // Funil
      case 'funil-cliques':
        return renderFunnelWidget('Cliques', '🎯', data?.cliquesAnuncios ?? 0, variations.cliquesAnuncios ?? null, previous.cliquesAnuncios ?? 0, 'border-emerald-500/40');
      case 'funil-conversas':
        return renderFunnelWidget('Conversas', '💬', data?.conversasIniciadas ?? 0, variations.conversasIniciadas ?? null, previous.conversasIniciadas ?? 0, 'border-cyan-500/40');
      case 'funil-fs':
        return renderFunnelWidget('FS Criadas', '📋', data?.fsCriadas ?? 0, variations.fsCriadas ?? null, previous.fsCriadas ?? 0, 'border-violet-500/40');
      case 'funil-agendados':
        return renderFunnelWidget('Agendados', '📅', data?.agendados ?? 0, variations.agendados ?? null, previous.agendados ?? 0, 'border-amber-500/40');
      case 'funil-executados':
        return renderFunnelWidget('Executados', '✅', data?.executados ?? 0, variations.executados ?? null, previous.executados ?? 0, 'border-blue-500/40');
      case 'funil-pagos':
        return renderFunnelWidget('Pagos', '💰', data?.pagos ?? 0, variations.pagos ?? null, previous.pagos ?? 0, 'border-green-500/40');

      // Taxas de conversão
      case 'taxa-agend-fs':
        return renderConversionWidget('Agendados / FS', taxaAgendFS, metas?.taxa_fs_agendado || 25, `${data?.agendados ?? 0} / ${data?.fsCriadas ?? 0}`);
      case 'taxa-pagos-fs':
        return renderConversionWidget('Pagos / FS', taxaPagosFS, 20, `${data?.pagos ?? 0} / ${data?.fsCriadas ?? 0}`);
      case 'taxa-pagos-agend':
        return renderConversionWidget('Pagos / Agendados', taxaPagosAgend, metas?.taxa_agendado_pago || 85, `${data?.pagos ?? 0} / ${data?.agendados ?? 0}`);
      case 'taxa-pagos-cliques':
        return renderConversionWidget('Pagos / Cliques', taxaPagosCliques, metas?.taxa_conversao_total || 10, `${data?.pagos ?? 0} / ${data?.cliquesAnuncios ?? 0}`);
      case 'taxa-conv-cliques':
        return renderConversionWidget('Conversas / Cliques', taxaConvCliques, 60, `${data?.conversasIniciadas ?? 0} / ${data?.cliquesAnuncios ?? 0}`);
      case 'taxa-exec-agend':
        return renderConversionWidget('Executados / Agendados', taxaExecAgend, 90, `${data?.executados ?? 0} / ${data?.agendados ?? 0}`);

      // Métricas de tempo
      case 'tempo-resposta':
        return renderTimeWidget('Tempo Resposta', '⚡', data?.tempoRespostaMin ?? null, 'min', metas?.tempo_resposta_max || 60);
      case 'tempo-orcamento':
        return renderTimeWidget('Receb. Orçamento', '🎯', data?.tempoOrcamentoMin ?? null, 'min', metas?.tempo_orcamento_max || 120);
      case 'tempo-fs-agendado':
        return renderTimeWidget('FS → Agendado', '📅', data?.tempoFSAgendadoDias ?? null, 'dias', 2);
      case 'tempo-agendado-exec':
        return renderTimeWidget('Agendado → Executado', '🔄', data?.tempoAgendadoExecDias ?? null, 'dias', 3);
      case 'tempo-ciclo':
        return renderTimeWidget('Ciclo Completo', '🎪', data?.tempoCicloCompletoDias ?? null, 'dias', 7);

      // Conversas abertas
      case 'conversas-abertas':
        if (!data?.conversasAbertas) return null;
        return (
          <TVAutoSizeWidget neonBorder="border-amber-500/20">
            {(dims) => (
              <div className="w-full h-full overflow-auto" style={{ padding: dims.padding }}>
                <div className="text-gray-400 uppercase tracking-wider mb-2" style={{ fontSize: dims.labelFontSize }}>
                  📞 Conversas em Aberto — <span className="text-amber-400 font-bold">{data.conversasAbertas.total}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 h-[calc(100%-2rem)]">
                  <div className="bg-[#0A1628]/60 rounded-lg p-2 overflow-auto">
                    <div className="text-gray-400 uppercase tracking-wider mb-1" style={{ fontSize: Math.max(7, dims.subFontSize * 0.9) }}>Por Status</div>
                    <div className="space-y-1">
                      {(data.conversasAbertas.porStatus || []).map((s, i) => {
                        const pct = data.conversasAbertas.total > 0 ? (s.count / data.conversasAbertas.total) * 100 : 0;
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-gray-300 truncate" style={{ fontSize: dims.subFontSize, width: '40%' }}>{s.status}</span>
                            <div className="flex-1 bg-gray-800/60 rounded-full overflow-hidden" style={{ height: Math.max(4, dims.height * 0.025) }}>
                              <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="font-bold text-white" style={{ fontSize: dims.subFontSize }}>{s.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="bg-[#0A1628]/60 rounded-lg p-2 overflow-auto">
                    <div className="text-gray-400 uppercase tracking-wider mb-1" style={{ fontSize: Math.max(7, dims.subFontSize * 0.9) }}>🔥 Aguardando Resposta</div>
                    <div className="space-y-0.5">
                      {(data.conversasAbertas.rankingSemResposta || []).map((c, i) => {
                        const horas = Math.floor(c.tempoSemResposta / 60);
                        const mins = c.tempoSemResposta % 60;
                        const tempoStr = horas > 0 ? `${horas}h${mins}m` : `${mins}m`;
                        const urgente = c.tempoSemResposta > 120;
                        const muitoUrgente = c.tempoSemResposta > 480;
                        return (
                          <div key={i} className={cn(
                            'flex items-center justify-between py-0.5 px-1 rounded',
                            muitoUrgente ? 'bg-red-500/10' : urgente ? 'bg-amber-500/10' : 'bg-gray-800/40'
                          )} style={{ fontSize: dims.subFontSize }}>
                            <span className="text-gray-300 truncate flex-1">{i + 1}. {c.nome}</span>
                            <span className={cn('font-mono font-bold shrink-0 ml-1', muitoUrgente ? 'text-red-400' : urgente ? 'text-amber-400' : 'text-gray-400')}>
                              {tempoStr}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TVAutoSizeWidget>
        );

      default:
        return null;
    }
  };

  const countdownMin = Math.floor(countdown / 60);
  const countdownSec = countdown % 60;
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

  const tickerItems = [
    (data?.orcamentosPendentes2h ?? 0) > 0 ? `🔥 ${data!.orcamentosPendentes2h} orçamentos pendentes >2h` : null,
    data?.proximaMeta ? `🎯 ${data.proximaMeta}` : null,
    data?.npsGeral != null ? `⭐ NPS Geral: ${data.npsGeral.toFixed(1)}` : null,
    data?.avaliacaoMediaPrestadores != null ? `👷 Avaliação Prestadores: ${data.avaliacaoMediaPrestadores.toFixed(1)}` : null,
  ].filter(Boolean).join('   |   ');

  return (
    <div
      className={cn(
        'min-h-screen bg-[#050D1A] text-white overflow-hidden transition-all',
        paymentFlash && 'ring-4 ring-emerald-400/60 ring-inset animate-pulse'
      )}
      style={{
        paddingRight: isEditing ? 280 : 0,
        fontSize: `${monitorSettings.fontSize}%`,
        filter: `brightness(${monitorSettings.brightness}%)`,
      }}
    >
      {/* HEADER */}
      <header className="bg-[#0A1628]/90 backdrop-blur-md border-b border-cyan-500/10 px-4 py-2 relative z-40">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <img src={logoGreen} alt="24Help" className="h-7" />
            <span className="text-sm font-bold tracking-wider text-cyan-300 uppercase">Centro de Comando de Vendas</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={isEditing ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className={cn(
                'h-7 text-xs gap-1.5',
                isEditing
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  : 'bg-gray-800/80 border-cyan-500/30 hover:bg-gray-700 hover:border-cyan-400/50 text-cyan-300'
              )}
            >
              {isEditing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
              {isEditing ? 'Sair da Edição' : 'Editar Layout'}
            </Button>
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

      {/* FREE-FORM CANVAS */}
      <TVFreeformCanvas renderBlock={renderBlock} />

      {/* WIDGET PROPERTIES PANEL */}
      <TVWidgetProperties />

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
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0A1628]/90 backdrop-blur-md border-t border-cyan-500/10 px-4 py-2 z-30">
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
    <TVFreeformProvider>
      <DashboardTVContent />
    </TVFreeformProvider>
  );
}
