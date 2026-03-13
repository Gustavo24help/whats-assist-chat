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
/** Returns 'yyyy-MM-dd' string forced to America/Sao_Paulo timezone */
function getDateInBrazil(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

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
    if (ratio >= 0.9) return 'text-[#276749]';
    if (ratio >= 0.7) return 'text-[#DD6B20]';
    return 'text-[#E53E3E]';
  }
  if (ratio <= 1.1) return 'text-[#276749]';
  if (ratio <= 1.3) return 'text-[#DD6B20]';
  return 'text-[#E53E3E]';
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
  const {
    isEditing,
    setIsEditing,
    savedLayouts,
    loadLayout,
    layoutRotationEnabled,
    layoutRotationIntervalSec,
    layoutRotationItems,
  } = useTVFreeform();
  const [monitorSettings, setMonitorSettings] = useMonitorSettings();
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [rotatingWidgetIndex, setRotatingWidgetIndex] = useState(0);

  const [layoutRotationIndex, setLayoutRotationIndex] = useState(0);

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

  useEffect(() => {
    setRotatingWidgetIndex(0);

    const items = monitorSettings.rotatingWidgetItems?.length
      ? monitorSettings.rotatingWidgetItems
      : ['conversas-abertas'];

    if (items.length <= 1) return;

    const intervalSec = Math.max(5, monitorSettings.rotatingWidgetIntervalSec || 20);
    const t = window.setInterval(() => {
      setRotatingWidgetIndex(prev => (prev + 1) % items.length);
    }, intervalSec * 1000);

    return () => window.clearInterval(t);
  }, [monitorSettings.rotatingWidgetIntervalSec, monitorSettings.rotatingWidgetItems]);

  useEffect(() => {
    setLayoutRotationIndex(0);
  }, [layoutRotationEnabled, layoutRotationItems]);

  useEffect(() => {
    if (!layoutRotationEnabled || isEditing) return;

    const activeNames = layoutRotationItems.filter(name => savedLayouts.some(l => l.name === name));
    if (activeNames.length <= 1) return;

    const intervalSec = Math.max(5, layoutRotationIntervalSec || 20);
    const t = window.setInterval(() => {
      setLayoutRotationIndex(prev => {
        const next = (prev + 1) % activeNames.length;
        loadLayout(activeNames[next]);
        return next;
      });
    }, intervalSec * 1000);

    return () => window.clearInterval(t);
  }, [layoutRotationEnabled, layoutRotationIntervalSec, layoutRotationItems, savedLayouts, loadLayout, isEditing]);

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
      // Use Brazil timezone to avoid date drift on devices with different TZ
      const hojeDate = getDateInBrazil(now);
      // Derivar mês a partir da string já correta, sem depender de Date objects do date-fns
      const mesFromDate = hojeDate.substring(0, 7) + '-01';
      const [_y, _m] = hojeDate.substring(0, 7).split('-').map(Number);
      const lastDay = new Date(_y, _m, 0).getDate();
      const mesEndDate = hojeDate.substring(0, 7) + '-' + String(lastDay).padStart(2, '0');
      const diaFrom = `${hojeDate}T00:00:00-03:00`;
      const diaTo = `${hojeDate}T23:59:59-03:00`;
      const mesFrom = `${mesFromDate}T00:00:00-03:00`;
      const mesTo = `${mesEndDate}T23:59:59-03:00`;

      // Buscar fichas que entraram em "Agendado" e "Finalizado" (via histórico de status)
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

      // Buscar valor_total das fichas agendadas HOJE (sem filtro de Perdido — são do dia)
      let valorAgendDia = 0;
      let valorFinDia = 0;
      let valorFinMes = 0;

      if (agendDiaIds.length > 0) {
        const { data: fichas } = await supabase.from('fichas_de_servico').select('valor_total').in('id', agendDiaIds);
        valorAgendDia = (fichas || []).reduce((s, f) => s + (f.valor_total || 0), 0);
      }

      // MENSAL: filtrar fichas cujo status atual ≠ "Perdido"
      let agendamentosMes = 0;
      let valorAgendMes = 0;
      if (agendMesIds.length > 0) {
        const { data: fichasMes } = await supabase
          .from('fichas_de_servico')
          .select('id, status, valor_total')
          .in('id', agendMesIds)
          .neq('status', 'Perdido');
        const agendMesFiltrados = fichasMes || [];
        agendamentosMes = agendMesFiltrados.length;
        valorAgendMes = agendMesFiltrados.reduce((s, f) => s + (f.valor_total || 0), 0);
      }

      if (finDiaIds.length > 0) {
        const { data: fichas } = await supabase.from('fichas_de_servico').select('valor_total').in('id', finDiaIds);
        valorFinDia = (fichas || []).reduce((s, f) => s + (f.valor_total || 0), 0);
      }
      if (finMesIds.length > 0) {
        const { data: fichas } = await supabase.from('fichas_de_servico').select('valor_total').in('id', finMesIds);
        valorFinMes = (fichas || []).reduce((s, f) => s + (f.valor_total || 0), 0);
      }

      // Buscar metas de daily_goals
      const [metaDiariaRes, metasMesRes, metasAcumuladaRes] = await Promise.all([
        supabase.from('daily_goals').select('meta_agendamento_quantidade, meta_agendamento_valor').eq('date', hojeDate).maybeSingle(),
        supabase.from('daily_goals').select('meta_agendamento_quantidade, meta_agendamento_valor').gte('date', mesFromDate).lte('date', mesEndDate),
        supabase.from('daily_goals').select('meta_agendamento_quantidade, meta_agendamento_valor').gte('date', mesFromDate).lte('date', hojeDate),
      ]);

      const metaDiariaQtd = (metaDiariaRes.data as any)?.meta_agendamento_quantidade ?? 0;
      const metaDiariaValor = (metaDiariaRes.data as any)?.meta_agendamento_valor ?? 0;
      const metasMesData = (metasMesRes.data as any[]) || [];
      const metaMensalQtd = metasMesData.reduce((s: number, r: any) => s + (r.meta_agendamento_quantidade || 0), 0);
      const metaMensalValor = metasMesData.reduce((s: number, r: any) => s + (r.meta_agendamento_valor || 0), 0);
      const metasAcumuladaData = (metasAcumuladaRes.data as any[]) || [];
      const metaAcumuladaQtd = metasAcumuladaData.reduce((s: number, r: any) => s + (r.meta_agendamento_quantidade || 0), 0);
      const metaAcumuladaValor = metasAcumuladaData.reduce((s: number, r: any) => s + (r.meta_agendamento_valor || 0), 0);

      return {
        agendamentosDia: agendDiaIds.length,
        agendamentosMes,
        valorAgendDia,
        valorAgendMes,
        finalizadosDia: finDiaIds.length,
        finalizadosMes: finMesIds.length,
        valorFinDia,
        valorFinMes,
        metaDiariaQtd,
        metaDiariaValor,
        metaMensalQtd,
        metaMensalValor,
        metaAcumuladaQtd,
        metaAcumuladaValor,
      };
    },
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 0,
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] text-[#111827] p-6 space-y-4">
        <Skeleton className="h-16 w-full bg-gray-200" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 bg-gray-200" />
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
          <div className="text-[#374151] uppercase tracking-wider truncate" style={{ fontSize: dims.labelFontSize }}>{label}</div>
          <div className="font-bold text-[#1A56DB] leading-none mt-1" style={{ fontSize: dims.valueFontSize }}>{value}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('font-semibold', variation !== null && variation >= 0 ? 'text-[#276749]' : 'text-[#E53E3E]')} style={{ fontSize: dims.subFontSize }}>
              {variation !== null ? (variation >= 0 ? '↑' : '↓') : ''} {fmtPct(variation)}
            </span>
            <span className="text-[#6B7280]" style={{ fontSize: Math.max(7, dims.subFontSize * 0.8) }}>ant: {prevValue}</span>
          </div>
          <div className="text-[#6B7280] mt-0.5" style={{ fontSize: dims.subFontSize }}>{sub}</div>
          {progress !== null && progress !== undefined && (
            <div className="mt-auto pt-1">
              <div className="flex justify-between text-[#6B7280]" style={{ fontSize: Math.max(7, dims.subFontSize * 0.8) }}>
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
          <div className="font-bold text-[#111827] leading-none mt-1" style={{ fontSize: dims.valueFontSize }}>{fmtNum(value)}</div>
          <div className="text-[#374151] mt-1" style={{ fontSize: dims.labelFontSize }}>{label}</div>
          <div className="flex items-center gap-1 mt-1">
            <span className={cn('font-semibold', variation !== null && variation >= 0 ? 'text-[#276749]' : 'text-[#E53E3E]')} style={{ fontSize: dims.subFontSize }}>
              {fmtPct(variation)}
            </span>
            <span className="text-[#6B7280]" style={{ fontSize: Math.max(7, dims.subFontSize * 0.85) }}>({fmtNum(prev)})</span>
          </div>
        </div>
      )}
    </TVAutoSizeWidget>
  );

  const renderConversionWidget = (
    label: string, value: number, meta: number, calc: string,
  ) => {
    const pct = value;
    const statusClr = pct >= meta * 0.9 ? 'text-[#276749]' : pct >= meta * 0.7 ? 'text-[#DD6B20]' : 'text-[#E53E3E]';
    return (
      <TVAutoSizeWidget>
        {(dims) => (
          <div className="w-full h-full flex flex-col items-center justify-center" style={{ padding: dims.padding }}>
            <div className="text-[#374151] truncate text-center" style={{ fontSize: dims.labelFontSize }}>{label}</div>
            <div className={cn('font-bold leading-none mt-1', statusClr)} style={{ fontSize: dims.valueFontSize }}>
              {pct.toFixed(1)}%
            </div>
            <div className="text-[#6B7280] mt-1" style={{ fontSize: dims.subFontSize }}>{calc}</div>
            <div className="w-full mt-auto pt-1">
              <Progress value={Math.min((pct / meta) * 100, 100)} className="h-1" />
              <div className="text-[#6B7280] text-center mt-0.5" style={{ fontSize: Math.max(7, dims.subFontSize * 0.85) }}>Meta: {meta}%</div>
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
      <TVAutoSizeWidget>
        {(dims) => (
          <div className="w-full h-full flex flex-col items-center justify-center" style={{ padding: dims.padding }}>
            <div style={{ fontSize: dims.iconSize }}>{icon}</div>
            <div className="text-[#374151] mt-1" style={{ fontSize: dims.labelFontSize }}>{label}</div>
            <div className={cn('font-bold leading-none mt-1', hasValue ? statusColor(value!, target, false) : 'text-[#6B7280]')} style={{ fontSize: dims.valueFontSize }}>
              {hasValue ? `${value} ${unit}` : 'S/D'} {hasValue ? emoji : ''}
            </div>
            <div className="text-[#6B7280] mt-1" style={{ fontSize: dims.subFontSize }}>Meta: {'<'}{target} {unit}</div>
          </div>
        )}
      </TVAutoSizeWidget>
    );
  };

  const renderGoalGauge = (label: string, actual: number, target: number, isCurrency = false) => {
    const pct = target > 0 ? (actual / target) * 100 : 0;
    const clampPct = Math.min(pct, 120);
    const arcColor = pct >= 100 ? '#276749' : pct >= 80 ? '#2B6CB0' : pct >= 50 ? '#DD6B20' : '#E53E3E';
    const pctColor = pct >= 100 ? 'text-[#276749]' : pct >= 80 ? 'text-[#2B6CB0]' : pct >= 50 ? 'text-[#DD6B20]' : 'text-[#E53E3E]';
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
      <TVAutoSizeWidget>
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
              <span className="font-semibold text-[#374151] text-center" style={{ fontSize: dims.labelFontSize }}>{label}</span>
              <svg viewBox={`0 0 ${gaugeSize} ${gaugeSize * 0.55}`} className="mx-auto" style={{ width: gaugeSize, maxWidth: '100%' }}>
                <defs>
                  <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={arcColor} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={arcColor} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <path d={bgPath} fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth} strokeLinecap="round" />
                <path d={fillPath} fill="none" stroke={`url(#${gradId})`} strokeWidth={strokeWidth} strokeLinecap="round" />
                <text x={cx} y={cy - 2} textAnchor="middle" className="fill-[#111827] font-bold" style={{ fontSize: gaugeSize * 0.18 }}>
                  {pct.toFixed(0)}%
                </text>
              </svg>
              <div className="text-center -mt-1">
                <span className="text-[#111827] font-bold" style={{ fontSize: dims.valueFontSize * 0.55 }}>{fmtVal(actual)}</span>
                <span className="text-[#6B7280]" style={{ fontSize: dims.subFontSize }}> / {fmtVal(target)}</span>
              </div>
              <span className={cn('text-center mt-0.5', pctColor)} style={{ fontSize: dims.subFontSize }}>{statusText}</span>
            </div>
          );
        }}
      </TVAutoSizeWidget>
    );
  };

  const rotatingItems = monitorSettings.rotatingWidgetItems?.length
    ? monitorSettings.rotatingWidgetItems
    : ['conversas-abertas'];
  const activeRotatingWidget = rotatingItems[rotatingWidgetIndex % rotatingItems.length] || 'conversas-abertas';

  const renderOpenConversationsWidget = () => {
    if (!data?.conversasAbertas) return null;
    const alertas = (data.conversasAbertas.lista || [])
      .filter(c => c.status === 'Ficha Criada' && c.tempoNoStatus > 20);
    return (
      <TVAutoSizeWidget>
        {(dims) => {
          const pad = Math.max(4, dims.padding * 0.6);
          const headerH = Math.max(10, dims.labelFontSize) * 1.8;
          const availableH = dims.height - headerH - pad * 2;
          const minFs = 8;
          const itemSpacing = 2.4;
          const maxVisible = Math.max(1, Math.floor(availableH / (minFs * itemSpacing)));
          const visibleAlerts = alertas.slice(0, maxVisible);
          const hiddenCount = alertas.length - visibleAlerts.length;
          const itemFs = alertas.length > 0
            ? Math.max(minFs, Math.min(availableH / (Math.min(alertas.length, maxVisible) * itemSpacing), dims.subFontSize * 0.95))
            : dims.subFontSize;
          return (
          <div className="w-full h-full overflow-hidden" style={{ padding: pad }}>
            <div className="flex items-center gap-1 mb-1">
              <span style={{ fontSize: Math.max(10, dims.labelFontSize) }}>🚨</span>
              <span className="text-[#374151] uppercase tracking-wider font-semibold truncate" style={{ fontSize: Math.max(9, dims.labelFontSize * 0.9) }}>
                Fichas Criadas {'>'} 20min
              </span>
              <span className={cn(
                'ml-auto font-bold rounded-full flex items-center justify-center',
                alertas.length > 0 ? 'bg-red-100 text-[#E53E3E]' : 'bg-green-100 text-[#276749]'
              )} style={{
                fontSize: Math.max(10, dims.valueFontSize * 0.5),
                width: Math.max(20, dims.valueFontSize * 0.7),
                height: Math.max(20, dims.valueFontSize * 0.7),
              }}>
                {alertas.length}
              </span>
            </div>
            {alertas.length === 0 ? (
              <div className="flex items-center justify-center h-[70%]">
                <span className="text-[#276749]" style={{ fontSize: Math.max(10, dims.subFontSize) }}>✅ Nenhuma pendência</span>
              </div>
            ) : (
              <div className="space-y-0.5">
                {visibleAlerts.map((c, i) => {
                  const horas = Math.floor(c.tempoNoStatus / 60);
                  const mins = c.tempoNoStatus % 60;
                  const tempoStr = horas > 0 ? `${horas}h${mins}m` : `${mins}m`;
                  const muitoUrgente = c.tempoNoStatus > 60;
                  return (
                    <div key={i} className={cn(
                      'rounded px-1.5 py-0.5 flex items-center justify-between',
                      muitoUrgente ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
                    )}>
                      <div className="truncate" style={{ fontSize: Math.max(8, itemFs), maxWidth: '65%' }}>
                        <span className="text-[#111827] font-medium">{c.nome || c.telefone}</span>
                        {c.nome && <span className="text-[#6B7280] ml-1 font-mono">{c.telefone}</span>}
                      </div>
                      <span className={cn(
                        'font-mono font-bold shrink-0',
                        muitoUrgente ? 'text-[#E53E3E]' : 'text-[#DD6B20]'
                      )} style={{ fontSize: Math.max(8, itemFs) }}>
                        {tempoStr}
                      </span>
                    </div>
                  );
                })}
                {hiddenCount > 0 && (
                  <div className="text-center text-[#6B7280] font-medium" style={{ fontSize: Math.max(7, itemFs * 0.85) }}>
                    +{hiddenCount} mais
                  </div>
                )}
              </div>
            )}
          </div>
          );
        }}
      </TVAutoSizeWidget>
    );
  };

  const renderOrcamentoEnviadoWidget = () => {
    if (!data?.conversasAbertas) return null;
    const alertas = (data.conversasAbertas.lista || [])
      .filter(c => c.status === 'Orçamento Enviado' && c.tempoNoStatus > 30);
    return (
      <TVAutoSizeWidget>
        {(dims) => {
          const pad = Math.max(4, dims.padding * 0.6);
          const headerH = Math.max(10, dims.labelFontSize) * 1.8;
          const availableH = dims.height - headerH - pad * 2;
          const minFs = 8;
          const itemSpacing = 2.4;
          const maxVisible = Math.max(1, Math.floor(availableH / (minFs * itemSpacing)));
          const visibleAlerts = alertas.slice(0, maxVisible);
          const hiddenCount = alertas.length - visibleAlerts.length;
          const itemFs = alertas.length > 0
            ? Math.max(minFs, Math.min(availableH / (Math.min(alertas.length, maxVisible) * itemSpacing), dims.subFontSize * 0.95))
            : dims.subFontSize;
          return (
          <div className="w-full h-full overflow-hidden" style={{ padding: pad }}>
            <div className="flex items-center gap-1 mb-1">
              <span style={{ fontSize: Math.max(10, dims.labelFontSize) }}>📋</span>
              <span className="text-[#374151] uppercase tracking-wider font-semibold truncate" style={{ fontSize: Math.max(9, dims.labelFontSize * 0.9) }}>
                Orçamento Enviado {'>'} 30min
              </span>
              <span className={cn(
                'ml-auto font-bold rounded-full flex items-center justify-center',
                alertas.length > 0 ? 'bg-red-100 text-[#E53E3E]' : 'bg-green-100 text-[#276749]'
              )} style={{
                fontSize: Math.max(10, dims.valueFontSize * 0.5),
                width: Math.max(20, dims.valueFontSize * 0.7),
                height: Math.max(20, dims.valueFontSize * 0.7),
              }}>
                {alertas.length}
              </span>
            </div>
            {alertas.length === 0 ? (
              <div className="flex items-center justify-center h-[70%]">
                <span className="text-[#276749]" style={{ fontSize: Math.max(10, dims.subFontSize) }}>✅ Nenhuma pendência</span>
              </div>
            ) : (
              <div className="space-y-0.5">
                {visibleAlerts.map((c, i) => {
                  const horas = Math.floor(c.tempoNoStatus / 60);
                  const mins = c.tempoNoStatus % 60;
                  const tempoStr = horas > 0 ? `${horas}h${mins}m` : `${mins}m`;
                  const muitoUrgente = c.tempoNoStatus > 60;
                  return (
                    <div key={i} className={cn(
                      'rounded px-1.5 py-0.5 flex items-center justify-between',
                      muitoUrgente ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
                    )}>
                      <div className="truncate" style={{ fontSize: Math.max(8, itemFs), maxWidth: '65%' }}>
                        <span className="text-[#111827] font-medium">{c.nome || c.telefone}</span>
                        {c.nome && <span className="text-[#6B7280] ml-1 font-mono">{c.telefone}</span>}
                      </div>
                      <span className={cn(
                        'font-mono font-bold shrink-0',
                        muitoUrgente ? 'text-[#E53E3E]' : 'text-[#DD6B20]'
                      )} style={{ fontSize: Math.max(8, itemFs) }}>
                        {tempoStr}
                      </span>
                    </div>
                  );
                })}
                {hiddenCount > 0 && (
                  <div className="text-center text-[#6B7280] font-medium" style={{ fontSize: Math.max(7, itemFs * 0.85) }}>
                    +{hiddenCount} mais
                  </div>
                )}
              </div>
            )}
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
        const target = metasIndependentes?.metaDiariaQtd ?? 0;
        return renderGoalGauge('🎯 Meta Diária — Agendamentos', actual, target);
      }
      case 'meta-mensal-os': {
        const actual = metasIndependentes?.agendamentosMes ?? 0;
        const target = metasIndependentes?.metaMensalQtd ?? 0;
        return renderGoalGauge('📅 Meta Mensal — Agendamentos', actual, target);
      }
      case 'meta-diaria-receita':
        return renderGoalGauge('💰 Meta Diária — Valor OS Agendados', metasIndependentes?.valorAgendDia ?? 0, metasIndependentes?.metaDiariaValor ?? 0, true);
      case 'meta-mensal-receita':
        return renderGoalGauge('📊 Meta Mensal — Valor OS Agendados', metasIndependentes?.valorAgendMes ?? 0, metasIndependentes?.metaMensalValor ?? 0, true);

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

      // ── Metas Acumuladas (dia 1 até hoje) ──
      case 'meta-acumulada-os': {
        const actual = metasIndependentes?.agendamentosMes ?? 0;
        const target = metasIndependentes?.metaAcumuladaQtd ?? 0;
        return renderGoalGauge('📈 Acumulado Mês — Agendamentos', actual, target);
      }
      case 'meta-acumulada-receita': {
        const actual = metasIndependentes?.valorAgendMes ?? 0;
        const target = metasIndependentes?.metaAcumuladaValor ?? 0;
        return renderGoalGauge('📈 Acumulado Mês — Valor OS', actual, target, true);
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
        return renderFunnelWidget('Status Agendado', '📅', data?.agendados ?? 0, variations.agendados ?? null, previous.agendados ?? 0, 'border-amber-500/40');
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
        return renderOpenConversationsWidget();

      case 'alerta-orcamento-enviado':
        return renderOrcamentoEnviadoWidget();

      case 'widget-rotativo': {
        // Renderizar o widget ativo do ciclo rotativo reutilizando renderBlock
        if (activeRotatingWidget && activeRotatingWidget !== 'widget-rotativo') {
          return renderBlock(activeRotatingWidget);
        }
        return renderOpenConversationsWidget();
      }

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
        'min-h-screen bg-[#F0F2F5] text-[#111827] overflow-hidden transition-all',
        paymentFlash && 'ring-4 ring-emerald-400/60 ring-inset animate-pulse'
      )}
      style={{
        paddingRight: isEditing ? 280 : 0,
        fontSize: `${monitorSettings.fontSize}%`,
        filter: `brightness(${monitorSettings.brightness}%)`,
      }}
    >
      {/* HEADER */}
      <header className="bg-[#1E3A5F] border-b border-[#1E3A5F] px-4 py-2 relative z-40">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <img src={logoGreen} alt="24Help" className="h-7" />
            <span className="text-sm font-bold tracking-wider text-white uppercase">Centro de Comando de Vendas</span>
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
                      : 'bg-white/20 border-white/30 hover:bg-white/30 text-white'
                  )}
                >
                  {isEditing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                  {isEditing ? 'Sair da Edição' : 'Editar Layout'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMonitorOpen(true)} className="h-7 text-xs bg-white/20 border-white/30 gap-1 hover:bg-white/30 text-white">
                  <Settings className="h-3 w-3" />
                </Button>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-300 font-medium">AO VIVO</span>
                </span>
                <div className="text-right">
                  <span className="text-xs text-white/80 font-mono block">
                    {format(clock, "dd MMM yyyy HH:mm:ss", { locale: ptBR }).toUpperCase()}
                  </span>
                  <span className="text-[9px] text-white/60">
                    Atualizado: {format(lastUpdate, 'HH:mm')} · Próx: {countdownMin}:{String(countdownSec).padStart(2, '0')}
                  </span>
                </div>
              </div>
        </div>
        {/* FILTERS ROW */}
        <div className="flex items-center gap-2 flex-wrap">
          <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-7 bg-white/20 border-white/30 text-xs gap-1.5 text-white">
                <CalendarIcon className="h-3 w-3" />
                <span>Período: {formatRangeLabel(periodRange)}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-700" align="start">
              <div className="flex gap-1 p-2 border-b border-gray-200 flex-wrap">
                {[
                  { label: 'Hoje', value: 'today' },
                  { label: '7 dias', value: '7days' },
                  { label: '30 dias', value: '30days' },
                  { label: 'Mês', value: 'month' },
                  { label: 'Mês Ant.', value: 'last_month' },
                 ].map(s => (
                  <Button key={s.value} variant="ghost" size="sm" className="h-6 text-[10px] text-[#374151] hover:text-[#111827] hover:bg-gray-100" onClick={() => handlePeriodShortcut(s.value)}>
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
              <Button variant="outline" className="h-7 bg-white/20 border-white/30 text-xs gap-1.5 text-white">
                <CalendarIcon className="h-3 w-3" />
                <span>{comparisonRange?.from && comparisonRange?.to ? `Comparar: ${formatRangeLabel(comparisonRange)}` : 'Comparar...'}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-700" align="start">
              <div className="flex gap-1 p-2 border-b border-gray-200 flex-wrap">
                {periodRange.from && periodRange.to && [
                  { label: 'Período anterior', value: 'prev_period' },
                  { label: 'Mês anterior', value: 'prev_month' },
                 ].map(s => (
                  <Button key={s.value} variant="ghost" size="sm" className="h-6 text-[10px] text-[#374151] hover:text-[#111827] hover:bg-gray-100" onClick={() => {
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
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] text-[#E53E3E] hover:text-red-700 hover:bg-gray-100" onClick={() => {
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
            <Badge variant="outline" className="h-6 text-[10px] border-white/30 text-white font-normal">
              {periodInfo.corridos}d | {periodInfo.uteis} DU
            </Badge>
          )}
          {compInfo && (
            <>
              <span className="text-[10px] text-white/60">vs</span>
              <Badge variant="outline" className="h-6 text-[10px] border-white/30 text-white font-normal">
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
            <span className="text-[10px] text-white/70">Dias úteis</span>
          </div>
          <Select value={filters.prestadorCpf || '__all'} onValueChange={v => setFilters(f => ({ ...f, prestadorCpf: v === '__all' ? undefined : v }))}>
            <SelectTrigger className="h-7 w-[160px] bg-white/20 border-white/30 text-xs text-white"><SelectValue placeholder="Todos Prestadores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos Prestadores</SelectItem>
              {(prestadores || []).map(p => (
                <SelectItem key={p.cpf} value={p.cpf}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.categoriaId?.toString() || '__all'} onValueChange={v => setFilters(f => ({ ...f, categoriaId: v === '__all' ? undefined : Number(v) }))}>
            <SelectTrigger className="h-7 w-[150px] bg-white/20 border-white/30 text-xs text-white"><SelectValue placeholder="Todas Categorias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas Categorias</SelectItem>
              {(categorias || []).map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-7 text-xs bg-white/20 border-white/30 text-white" onClick={() => setMetasOpen(true)}>
            🎯 Metas
          </Button>
          {data?.comparisonLabel && (
            <span className="text-[10px] text-amber-200 font-medium ml-1">{data.comparisonLabel}</span>
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
      <footer className="fixed bottom-0 left-0 right-0 bg-[#1E3A5F] border-t border-[#1E3A5F] px-4 py-2 z-30">
        <div className="overflow-hidden">
          <div className="animate-marquee whitespace-nowrap text-xs text-white">
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
