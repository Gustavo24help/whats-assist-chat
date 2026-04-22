import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { FileText, FileCheck2, Wrench, CalendarCheck } from 'lucide-react';

// ===== Tipos =====
type StatusAtual = 'Ficha Criada' | 'Orçamento Enviado' | 'Visita Técnica' | 'Agendado';

interface HistoricoEntry {
  status_novo: string;
  data_inicio: string;
}

interface FichaTimeline {
  id: string;
  nome_ficha: string | null;
  nome_cliente: string | null;
  telefone_cliente: string;
  status: string;
  valor_total: number | null;
  created_at: string;
  updated_at: string | null;
  ficha_status_historico: HistoricoEntry[];
}

const STATUS_FILTRADOS: StatusAtual[] = ['Ficha Criada', 'Orçamento Enviado', 'Visita Técnica', 'Agendado'];

// ===== Helpers de formatação =====
function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;

  if (days > 0 && remainingHours > 0) return `${days}d ${remainingHours}h`;
  if (days > 0) return `${days}d`;
  if (hours > 0 && remainingMinutes > 0) return `${hours}h ${remainingMinutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatRelative(date: Date, now: Date): string {
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return 'agora';
  return `${formatDuration(diff)} atrás`;
}

function formatCurrency(v: number | null): string {
  if (v == null || v === 0) return '–';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '');
  if (digits.length === 13) {
    // 5541999999999 -> (41) 99999-9999
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 9);
    const part2 = digits.slice(9);
    return `(${ddd}) ${part1}-${part2}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return tel;
}

// Configuração de cores e ícones por status
function getStatusConfig(status: string) {
  switch (status) {
    case 'Ficha Criada':
      return {
        bar: '#8B5CF6', // violet-500
        gradient: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
        Icon: FileText,
        percent: 25,
        label: 'Ficha Criada',
      };
    case 'Orçamento Enviado':
      return {
        bar: '#38BDF8', // sky-400
        gradient: 'linear-gradient(135deg, #7DD3FC 0%, #0EA5E9 100%)',
        Icon: FileCheck2,
        percent: 50,
        label: 'Orçamento Enviado',
      };
    case 'Visita Técnica':
      return {
        bar: '#F59E0B', // amber-500
        gradient: 'linear-gradient(135deg, #FBBF24 0%, #D97706 100%)',
        Icon: Wrench,
        percent: 62,
        label: 'Visita Técnica',
      };
    case 'Agendado':
      return {
        bar: '#10B981', // emerald-500
        gradient: 'linear-gradient(135deg, #34D399 0%, #059669 100%)',
        Icon: CalendarCheck,
        percent: 75,
        label: 'Agendado',
      };
    case 'Finalizado':
      return {
        bar: '#22C55E',
        gradient: 'linear-gradient(135deg, #4ADE80 0%, #16A34A 100%)',
        Icon: CalendarCheck,
        percent: 100,
        label: 'Finalizado',
      };
    case 'Perdido':
      return {
        bar: '#EF4444',
        gradient: 'linear-gradient(135deg, #F87171 0%, #DC2626 100%)',
        Icon: FileText,
        percent: 100,
        label: 'Perdido',
      };
    default:
      return {
        bar: '#9CA3AF',
        gradient: 'linear-gradient(135deg, #D1D5DB 0%, #9CA3AF 100%)',
        Icon: FileText,
        percent: 0,
        label: status,
      };
  }
}

function findFirstEntry(historico: HistoricoEntry[], status: string): HistoricoEntry | undefined {
  return historico.find(h => h.status_novo === status);
}

// ===== Card =====
interface CardProps {
  ficha: FichaTimeline;
  now: Date;
}

function FichaCard({ ficha, now }: CardProps) {
  const cfg = getStatusConfig(ficha.status);
  const Icon = cfg.Icon;
  const historico = ficha.ficha_status_historico;

  const temVT = !!findFirstEntry(historico, 'Visita Técnica');
  const intermediarioStatus = temVT ? 'Visita Técnica' : 'Agendado';
  const etapas = ['Ficha Criada', 'Orçamento Enviado', intermediarioStatus, 'Finalizado'];

  // TEMPO TOTAL = sempre desde a criação da ficha
  const tempoTotal = now.getTime() - new Date(ficha.created_at).getTime();

  // NO STATUS = desde a entrada mais recente no status atual
  const statusAtualHistorico = historico
    .filter(h => h.status_novo === ficha.status)
    .sort((a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime())[0];

  const tempoNoStatus = statusAtualHistorico
    ? now.getTime() - new Date(statusAtualHistorico.data_inicio).getTime()
    : tempoTotal;

  // Deltas entre etapas (intervalos)
  const deltas: (string | null)[] = [];
  for (let i = 0; i < etapas.length - 1; i++) {
    const a = findFirstEntry(historico, etapas[i]);
    const b = findFirstEntry(historico, etapas[i + 1]);
    if (a && b) {
      const diff = new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime();
      deltas.push(formatDuration(diff));
    } else {
      deltas.push(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header colorido — compacto */}
      <div
        className="px-4 py-2.5 flex items-center justify-between text-white"
        style={{ background: cfg.gradient }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Icon className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold uppercase tracking-wide truncate">{cfg.label}</span>
        </div>
        <span className="text-xs font-mono font-medium bg-black/25 px-2 py-1 rounded shrink-0">
          {ficha.id}
        </span>
      </div>

      {/* Body — padding compacto */}
      <div className="p-3 space-y-3">
        {/* Cliente + telefone */}
        <div>
          <div className="text-2xl font-semibold text-foreground truncate leading-tight">
            {ficha.nome_cliente || ficha.nome_ficha || 'Sem nome'}
          </div>
          <div className="mt-1">
            <span className="inline-block text-xl font-normal bg-muted text-foreground px-2 py-0.5 rounded-md font-mono">
              {formatTelefone(ficha.telefone_cliente)}
            </span>
          </div>
        </div>

        {/* Progresso */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Progresso
            </span>
            <span className="text-lg font-semibold" style={{ color: cfg.bar }}>
              {cfg.percent}%
            </span>
          </div>
          <div
            className="w-full bg-muted rounded-full overflow-hidden"
            style={{ height: '14px' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${cfg.percent}%`, background: cfg.gradient }}
            />
          </div>
        </div>

        {/* Linha de nós com deltas intercalados */}
        <div
          className="grid items-start gap-1"
          style={{ gridTemplateColumns: 'auto 1fr auto 1fr auto 1fr auto' }}
        >
          {etapas.map((etapa, idx) => {
            const entry = findFirstEntry(historico, etapa);
            const passed = !!entry;
            const isCurrent = etapa === ficha.status;
            const etapaCfg = getStatusConfig(etapa);

            return (
              <React.Fragment key={`step-${etapa}-${idx}`}>
                {/* Nó */}
                <div className="flex flex-col items-center text-center px-1 min-w-[72px]">
                  <div
                    className={cn(
                      'rounded-full mb-1.5 transition-all',
                      isCurrent && 'animate-pulse',
                    )}
                    style={{
                      width: '14px',
                      height: '14px',
                      backgroundColor: passed ? etapaCfg.bar : 'transparent',
                      border: `2px solid ${passed ? etapaCfg.bar : 'hsl(var(--muted-foreground) / 0.4)'}`,
                      boxShadow: isCurrent ? `0 0 0 4px ${etapaCfg.bar}33` : undefined,
                    }}
                  />
                  <div className="text-sm font-medium leading-tight text-foreground">
                    {etapa}
                  </div>
                  {entry && (
                    <>
                      <div className="text-sm font-normal text-muted-foreground mt-0.5">
                        {format(new Date(entry.data_inicio), 'dd/MM HH:mm')}
                      </div>
                      <div className="text-sm font-normal italic text-muted-foreground">
                        {formatRelative(new Date(entry.data_inicio), now)}
                      </div>
                    </>
                  )}
                </div>

                {/* Delta (intervalo) — só se não for o último */}
                {idx < etapas.length - 1 && (
                  <div className="flex items-center justify-center pt-1">
                    {deltas[idx] && (
                      <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
                        ⏱ {deltas[idx]}
                      </span>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Métricas inferiores — sem caixas, divisor sutil */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest font-medium text-muted-foreground">
              No status
            </div>
            <div className="text-3xl font-bold mt-1" style={{ color: cfg.bar }}>
              {formatDuration(tempoNoStatus)}
            </div>
          </div>
          <div className="text-center border-x border-border">
            <div className="text-xs uppercase tracking-widest font-medium text-muted-foreground">
              Tempo total
            </div>
            <div className="text-3xl font-bold mt-1 text-foreground">
              {formatDuration(tempoTotal)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest font-medium text-muted-foreground">
              Valor
            </div>
            <div
              className={cn(
                'text-3xl font-bold mt-1',
                ficha.valor_total && ficha.valor_total > 0 ? 'text-emerald-500' : 'text-muted-foreground',
              )}
            >
              {formatCurrency(ficha.valor_total)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Página principal =====
export function AcompanhamentoConversas() {
  const { toast } = useToast();
  const [fichas, setFichas] = useState<FichaTimeline[]>([]);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [statusAtivos, setStatusAtivos] = useState<Set<StatusAtual>>(
    () => new Set(STATUS_FILTRADOS),
  );

  const fetchFichas = async () => {
    try {
      const { data, error } = await supabase
        .from('fichas_de_servico')
        .select(`
          id, nome_ficha, nome_cliente, telefone_cliente,
          status, valor_total, created_at, updated_at,
          ficha_status_historico ( status_novo, data_inicio )
        `)
        .in('status', STATUS_FILTRADOS as any)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((f: any) => ({
        ...f,
        ficha_status_historico: [...(f.ficha_status_historico || [])].sort(
          (a: HistoricoEntry, b: HistoricoEntry) =>
            new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime(),
        ),
      })) as FichaTimeline[];

      setFichas(normalized);
    } catch (err: any) {
      console.error('Erro ao buscar fichas:', err);
      toast({
        title: 'Erro ao carregar acompanhamento',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFichas();

    const channel = supabase
      .channel('acompanhamento-conversas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fichas_de_servico' }, () => fetchFichas())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ficha_status_historico' }, () => fetchFichas())
      .subscribe();

    const tick = setInterval(() => setNow(new Date()), 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    STATUS_FILTRADOS.forEach(s => { c[s] = 0; });
    fichas.forEach(f => { if (c[f.status] !== undefined) c[f.status]++; });
    return c;
  }, [fichas]);

  const toggleStatus = (status: StatusAtual) => {
    setStatusAtivos(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const fichasFiltradas = useMemo(
    () => fichas.filter(f => statusAtivos.has(f.status as StatusAtual)),
    [fichas, statusAtivos],
  );

  return (
    <div className="h-full min-h-screen overflow-y-auto bg-background">
      {/* Header com filtros */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Acompanhamento de Conversas</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Timeline em tempo real das fichas em andamento
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total
              </div>
              <div className="text-3xl font-bold text-foreground">{fichasFiltradas.length}</div>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="mt-4 flex flex-wrap gap-4">
            {STATUS_FILTRADOS.map(status => {
              const cfg = getStatusConfig(status);
              const ativo = statusAtivos.has(status);
              return (
                <label
                  key={status}
                  className={cn(
                    'flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-md border transition-colors',
                    ativo ? 'bg-card border-border' : 'opacity-60 hover:opacity-100 border-transparent',
                  )}
                >
                  <Checkbox
                    checked={ativo}
                    onCheckedChange={() => toggleStatus(status)}
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cfg.bar }}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {status}
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">
                    ({counts[status] ?? 0})
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid de cards */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="text-center text-muted-foreground py-16">Carregando…</div>
        ) : fichasFiltradas.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            Nenhuma conversa nos status selecionados.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fichasFiltradas.map(ficha => (
              <FichaCard key={ficha.id} ficha={ficha} now={now} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AcompanhamentoConversas;
