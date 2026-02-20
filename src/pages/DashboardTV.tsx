import React, { useState, useEffect } from 'react';
import { useDashboardTV, TVFilters, TVPeriod, TVComparison } from '@/hooks/useDashboardTV';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { MetasModal } from '@/components/dashboard/tv/MetasModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
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

export default function DashboardTV() {
  const [filters, setFilters] = useState<TVFilters>({
    period: 'today',
    comparison: 'yesterday',
    onlyBusinessDays: false,
  });
  const [metasOpen, setMetasOpen] = useState(false);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading } = useDashboardTV(filters);

  // Load prestadores and categorias for filters
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
      <div className="min-h-screen bg-gray-950 text-white p-6 space-y-4">
        <Skeleton className="h-16 w-full bg-gray-800" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-40 bg-gray-800" />
          <Skeleton className="h-40 bg-gray-800" />
          <Skeleton className="h-40 bg-gray-800" />
        </div>
        <Skeleton className="h-32 bg-gray-800" />
        <Skeleton className="h-32 bg-gray-800" />
      </div>
    );
  }

  const metas = data.metas;

  // Computed conversion rates
  const taxaAgendFS = data.fsCriadas > 0 ? (data.agendados / data.fsCriadas) * 100 : 0;
  const taxaPagosFS = data.fsCriadas > 0 ? (data.pagos / data.fsCriadas) * 100 : 0;
  const taxaPagosAgend = data.agendados > 0 ? (data.pagos / data.agendados) * 100 : 0;
  const taxaPagosCliques = data.cliquesAnuncios > 0 ? (data.pagos / data.cliquesAnuncios) * 100 : 0;
  const taxaConvCliques = data.cliquesAnuncios > 0 ? (data.conversasIniciadas / data.cliquesAnuncios) * 100 : 0;
  const taxaExecAgend = data.agendados > 0 ? (data.executados / data.agendados) * 100 : 0;
  const conversaoTotal = data.cliquesAnuncios > 0 ? (data.pagos / data.cliquesAnuncios) * 100 : (data.conversasIniciadas > 0 ? (data.pagos / data.conversasIniciadas) * 100 : 0);

  const funnelSteps = [
    { label: 'Cliques', icon: '🎯', value: data.cliquesAnuncios, variation: data.variations.cliquesAnuncios, color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30' },
    { label: 'Conversas', icon: '💬', value: data.conversasIniciadas, variation: data.variations.conversasIniciadas, color: 'from-blue-500/20 to-blue-500/5 border-blue-500/30' },
    { label: 'FS Criadas', icon: '📋', value: data.fsCriadas, variation: data.variations.fsCriadas, color: 'from-violet-500/20 to-violet-500/5 border-violet-500/30' },
    { label: 'Agendados', icon: '📅', value: data.agendados, variation: data.variations.agendados, color: 'from-amber-500/20 to-amber-500/5 border-amber-500/30' },
    { label: 'Executados', icon: '✅', value: data.executados, variation: data.variations.executados, color: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30' },
    { label: 'Pagos', icon: '💰', value: data.pagos, variation: data.variations.pagos, color: 'from-green-500/20 to-green-500/5 border-green-500/30' },
  ];

  const conversionCards = [
    { label: 'Agendados / FS', value: taxaAgendFS, meta: metas?.taxa_fs_agendado || 25, calc: `${data.agendados} / ${data.fsCriadas}` },
    { label: 'Pagos / FS', value: taxaPagosFS, meta: 20, calc: `${data.pagos} / ${data.fsCriadas}` },
    { label: 'Pagos / Agendados', value: taxaPagosAgend, meta: metas?.taxa_agendado_pago || 85, calc: `${data.pagos} / ${data.agendados}` },
    { label: 'Pagos / Cliques', value: taxaPagosCliques, meta: metas?.taxa_conversao_total || 10, calc: `${data.pagos} / ${data.cliquesAnuncios}` },
    { label: 'Conversas / Cliques', value: taxaConvCliques, meta: 60, calc: `${data.conversasIniciadas} / ${data.cliquesAnuncios}` },
    { label: 'Executados / Agendados', value: taxaExecAgend, meta: 90, calc: `${data.executados} / ${data.agendados}` },
  ];

  const timeCards = [
    { label: 'Tempo Resposta', value: data.tempoRespostaMin, unit: 'min', target: metas?.tempo_resposta_max || 60, icon: '⚡' },
    { label: 'Recebimento Orçamento', value: data.tempoOrcamentoMin, unit: 'min', target: metas?.tempo_orcamento_max || 120, icon: '🎯' },
    { label: 'FS → Agendado', value: data.tempoFSAgendadoDias !== null ? data.tempoFSAgendadoDias : null, unit: 'dias', target: 2, icon: '📅' },
    { label: 'Agendado → Executado', value: data.tempoAgendadoExecDias !== null ? data.tempoAgendadoExecDias : null, unit: 'dias', target: 3, icon: '🔄' },
    { label: 'Ciclo Completo', value: data.tempoCicloCompletoDias !== null ? data.tempoCicloCompletoDias : null, unit: 'dias', target: 7, icon: '🎪' },
  ];

  // Ticker messages
  const tickerItems = [
    data.orcamentosPendentes2h > 0 ? `🔥 ${data.orcamentosPendentes2h} orçamentos pendentes >2h` : null,
    data.proximaMeta ? `🎯 ${data.proximaMeta}` : null,
    data.npsGeral !== null ? `⭐ NPS Geral: ${data.npsGeral.toFixed(1)}` : null,
    data.avaliacaoMediaPrestadores !== null ? `👷 Avaliação Prestadores: ${data.avaliacaoMediaPrestadores.toFixed(1)}` : null,
  ].filter(Boolean).join('   |   ');

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
      {/* HEADER */}
      <header className="bg-gray-900/80 backdrop-blur border-b border-gray-800 px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <img src={logoGreen} alt="24Help" className="h-7" />
            <span className="text-sm font-bold tracking-wider text-gray-300 uppercase">Centro de Comando de Vendas</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 font-medium">AO VIVO</span>
            </span>
            <span className="text-xs text-gray-400 font-mono">
              {format(clock, "dd MMM yyyy HH:mm:ss", { locale: ptBR }).toUpperCase()}
            </span>
          </div>
        </div>
        {/* FILTERS */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filters.period} onValueChange={v => setFilters(f => ({ ...f, period: v as TVPeriod }))}>
            <SelectTrigger className="h-7 w-[130px] bg-gray-800 border-gray-700 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
              <SelectItem value="month">Mês Atual</SelectItem>
              <SelectItem value="last_month">Mês Anterior</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.comparison} onValueChange={v => setFilters(f => ({ ...f, comparison: v as TVComparison }))}>
            <SelectTrigger className="h-7 w-[160px] bg-gray-800 border-gray-700 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yesterday">vs Ontem</SelectItem>
              <SelectItem value="last_week">vs Semana Passada</SelectItem>
              <SelectItem value="last_month">vs Mês Anterior</SelectItem>
              <SelectItem value="same_day_last_month">vs Mesmo dia mês ant.</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Switch
              checked={filters.onlyBusinessDays}
              onCheckedChange={v => setFilters(f => ({ ...f, onlyBusinessDays: v }))}
              className="h-4 w-7"
            />
            <span className="text-[10px] text-gray-400">Dias úteis</span>
          </div>
          <Select value={filters.prestadorCpf || '__all'} onValueChange={v => setFilters(f => ({ ...f, prestadorCpf: v === '__all' ? undefined : v }))}>
            <SelectTrigger className="h-7 w-[160px] bg-gray-800 border-gray-700 text-xs"><SelectValue placeholder="Todos Prestadores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos Prestadores</SelectItem>
              {(prestadores || []).map(p => (
                <SelectItem key={p.cpf} value={p.cpf}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.categoriaId?.toString() || '__all'} onValueChange={v => setFilters(f => ({ ...f, categoriaId: v === '__all' ? undefined : Number(v) }))}>
            <SelectTrigger className="h-7 w-[150px] bg-gray-800 border-gray-700 text-xs"><SelectValue placeholder="Todas Categorias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas Categorias</SelectItem>
              {(categorias || []).map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-7 text-xs bg-gray-800 border-gray-700" onClick={() => setMetasOpen(true)}>
            🎯 Metas
          </Button>
        </div>
      </header>

      {/* KPIs PRINCIPAIS */}
      <section className="grid grid-cols-3 gap-3 px-4 py-3">
        {[
          {
            label: 'Receita Total', value: fmtCurrency(data.receitaTotal),
            variation: data.variations.receitaTotal,
            meta: metas?.valor_os, progress: metas?.valor_os ? Math.min((data.receitaTotal / metas.valor_os) * 100, 100) : null,
            sub: `Ticket Médio: ${fmtCurrency(data.ticketMedio)}`,
          },
          {
            label: 'Lucro Bruto', value: fmtCurrency(data.lucroBruto),
            variation: data.variations.lucroBruto,
            meta: metas?.lucro_bruto, progress: metas?.lucro_bruto ? Math.min((data.lucroBruto / metas.lucro_bruto) * 100, 100) : null,
            sub: `Margem: ${data.margemMedia.toFixed(1)}%`,
          },
          {
            label: 'Serviços Fechados', value: fmtNum(data.servicosFechados),
            variation: data.variations.servicosFechados,
            meta: metas?.quantidade_servicos, progress: metas?.quantidade_servicos ? Math.min((data.servicosFechados / metas.quantidade_servicos) * 100, 100) : null,
            sub: `Conv. Total: ${conversaoTotal.toFixed(1)}%`,
          },
        ].map((kpi, i) => (
          <div key={i} className="bg-gray-900/60 backdrop-blur border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{kpi.label}</div>
            <div className="text-2xl font-bold">{kpi.value}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('text-sm font-semibold', kpi.variation !== null && kpi.variation >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {kpi.variation !== null ? (kpi.variation >= 0 ? '↑' : '↓') : ''} {fmtPct(kpi.variation)}
              </span>
              <span className="text-xs text-gray-500">{kpi.sub}</span>
            </div>
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

      {/* FUNIL */}
      <section className="px-4 pb-3">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Funil de Vendas — Conversão ao Vivo</div>
        <div className="flex items-center gap-1">
          {funnelSteps.map((step, i) => (
            <React.Fragment key={i}>
              <div className={cn('flex-1 bg-gradient-to-b border rounded-lg p-2 text-center', step.color)}>
                <div className="text-lg">{step.icon}</div>
                <div className="text-xl font-bold">{fmtNum(step.value)}</div>
                <div className="text-[10px] text-gray-300">{step.label}</div>
                <div className={cn('text-[10px] font-semibold mt-0.5', step.variation !== null && step.variation >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {fmtPct(step.variation)}
                </div>
              </div>
              {i < funnelSteps.length - 1 && <span className="text-gray-600 text-lg">→</span>}
            </React.Fragment>
          ))}
        </div>
        <div className="text-center text-xs text-gray-500 mt-1">
          Conversão Total: {data.cliquesAnuncios > 0 ? `${fmtNum(data.cliquesAnuncios)} → ${fmtNum(data.pagos)} = ${conversaoTotal.toFixed(1)}%` : `${fmtNum(data.conversasIniciadas)} → ${fmtNum(data.pagos)}`}
        </div>
      </section>

      {/* TAXAS DE CONVERSÃO */}
      <section className="px-4 pb-3">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Taxas de Conversão</div>
        <div className="grid grid-cols-6 gap-2">
          {conversionCards.map((c, i) => {
            const pct = c.value;
            const status = pct >= c.meta * 0.9 ? 'emerald' : pct >= c.meta * 0.7 ? 'amber' : 'red';
            return (
              <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-lg p-2 text-center">
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

      {/* MÉTRICAS DE TEMPO */}
      <section className="px-4 pb-3">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Métricas de Tempo</div>
        <div className="grid grid-cols-5 gap-2">
          {timeCards.map((t, i) => {
            const hasValue = t.value !== null;
            const emoji = hasValue ? statusEmoji(t.value!, t.target, false) : '—';
            return (
              <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-lg p-2 text-center">
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

      {/* TICKER */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur border-t border-gray-800 px-4 py-2">
        <div className="overflow-hidden">
          <div className="animate-marquee whitespace-nowrap text-xs text-gray-300">
            {tickerItems || 'Carregando alertas...'}
          </div>
        </div>
      </footer>

      <MetasModal open={metasOpen} onClose={() => setMetasOpen(false)} />

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
