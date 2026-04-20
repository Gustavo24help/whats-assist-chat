import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
  motivo_perda: string | null;
  created_at: string;
  ficha_status_historico: HistoricoEntry[];
}

const STATUS_FILTRADOS: StatusAtual[] = ['Ficha Criada', 'Orçamento Enviado', 'Agendado', 'Visita Técnica'];

// ===== Helpers =====
function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const hRest = h % 24;
  return hRest > 0 ? `${d}d ${hRest}h` : `${d}d`;
}

function formatRelative(date: Date, now: Date): string {
  const diff = now.getTime() - date.getTime();
  if (diff < 0) return 'agora';
  return `${formatDuration(diff)} atrás`;
}

function formatCurrency(v: number | null): string {
  if (v == null || v === 0) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Configuração rica de cores por status (mais vibrante para TV)
function getStatusConfig(status: string) {
  switch (status) {
    case 'Ficha Criada':
      return {
        bg: '#E0E7FF', text: '#3730A3', bar: '#6366F1',
        gradient: 'linear-gradient(90deg, #818CF8 0%, #6366F1 100%)',
        border: '#6366F1', percent: 25, icon: '📝', label: 'Ficha Criada',
      };
    case 'Orçamento Enviado':
      return {
        bg: '#DBEAFE', text: '#1E40AF', bar: '#3B82F6',
        gradient: 'linear-gradient(90deg, #60A5FA 0%, #3B82F6 100%)',
        border: '#3B82F6', percent: 50, icon: '💰', label: 'Orçamento Enviado',
      };
    case 'Visita Técnica':
      return {
        bg: '#FEF3C7', text: '#92400E', bar: '#F59E0B',
        gradient: 'linear-gradient(90deg, #FBBF24 0%, #F59E0B 100%)',
        border: '#F59E0B', percent: 65, icon: '🔧', label: 'Visita Técnica',
      };
    case 'Agendado':
      return {
        bg: '#D1FAE5', text: '#065F46', bar: '#10B981',
        gradient: 'linear-gradient(90deg, #34D399 0%, #10B981 100%)',
        border: '#10B981', percent: 85, icon: '📅', label: 'Agendado',
      };
    default:
      return {
        bg: '#F3F4F6', text: '#374151', bar: '#9CA3AF',
        gradient: 'linear-gradient(90deg, #D1D5DB 0%, #9CA3AF 100%)',
        border: '#9CA3AF', percent: 0, icon: '•', label: status,
      };
  }
}

function findFirstEntry(historico: HistoricoEntry[], status: string): HistoricoEntry | undefined {
  return historico.find(h => h.status_novo === status);
}

// ===== Componente =====
export function ConversationTimelineTV() {
  const { toast } = useToast();
  const [fichas, setFichas] = useState<FichaTimeline[]>([]);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [statusFiltro, setStatusFiltro] = useState<StatusAtual | 'TODOS'>('TODOS');

  const fetchFichas = async () => {
    try {
      const { data, error } = await supabase
        .from('fichas_de_servico')
        .select(`
          id, nome_ficha, nome_cliente, telefone_cliente,
          status, valor_total, motivo_perda, created_at,
          ficha_status_historico (
            status_novo, data_inicio
          )
        `)
        .in('status', STATUS_FILTRADOS as any)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((f: any) => ({
        ...f,
        ficha_status_historico: [...(f.ficha_status_historico || [])].sort(
          (a: HistoricoEntry, b: HistoricoEntry) =>
            new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime()
        ),
      })) as FichaTimeline[];

      setFichas(normalized);
    } catch (err: any) {
      console.error('Erro ao buscar fichas para timeline:', err);
      toast({ title: 'Erro ao carregar acompanhamento', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFichas();

    const channel = supabase
      .channel('conversation-timeline-tv')
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

  // Contagens por status
  const counts = useMemo(() => {
    const c: Record<string, number> = { TODOS: fichas.length };
    STATUS_FILTRADOS.forEach(s => { c[s] = 0; });
    fichas.forEach(f => { if (c[f.status] !== undefined) c[f.status]++; });
    return c;
  }, [fichas]);

  const cards = useMemo(() => {
    const filtradas = statusFiltro === 'TODOS' ? fichas : fichas.filter(f => f.status === statusFiltro);

    return filtradas.map(ficha => {
      const cfg = getStatusConfig(ficha.status);
      const historico = ficha.ficha_status_historico;

      const primeiraEntrada =
        findFirstEntry(historico, 'Ficha Criada') ||
        (historico[0] || { status_novo: 'Ficha Criada', data_inicio: ficha.created_at });

      const ultimaEntrada = historico[historico.length - 1] || primeiraEntrada;

      const temVT = !!findFirstEntry(historico, 'Visita Técnica');
      const intermediarioStatus = temVT ? 'Visita Técnica' : 'Agendado';
      const etapas = ['Ficha Criada', 'Orçamento Enviado', intermediarioStatus, 'Finalizado'];

      const tempoNoStatus = now.getTime() - new Date(ultimaEntrada.data_inicio).getTime();
      const tempoTotal = now.getTime() - new Date(primeiraEntrada.data_inicio).getTime();

      return { ficha, cfg, historico, primeiraEntrada, ultimaEntrada, etapas, tempoNoStatus, tempoTotal };
    });
  }, [fichas, now, statusFiltro]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[#6B7280] text-base bg-white rounded-lg">
        Carregando acompanhamento...
      </div>
    );
  }

  const FILTROS: Array<{ key: StatusAtual | 'TODOS'; label: string; color: string; bg: string }> = [
    { key: 'TODOS', label: 'Todos', color: '#111827', bg: '#F3F4F6' },
    { key: 'Ficha Criada', label: '📝 Ficha Criada', color: '#3730A3', bg: '#E0E7FF' },
    { key: 'Orçamento Enviado', label: '💰 Orçamento', color: '#1E40AF', bg: '#DBEAFE' },
    { key: 'Visita Técnica', label: '🔧 Visita Técnica', color: '#92400E', bg: '#FEF3C7' },
    { key: 'Agendado', label: '📅 Agendado', color: '#065F46', bg: '#D1FAE5' },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg overflow-hidden">
      {/* Header com título + filtros */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[#111827] uppercase tracking-wider">
            Acompanhamento de Conversas
          </h3>
          <span className="text-sm font-semibold text-[#6B7280]">{cards.length} conversas</span>
        </div>

        {/* Filtros por status (chips) */}
        <div className="flex flex-wrap gap-2">
          {FILTROS.map(f => {
            const ativo = statusFiltro === f.key;
            const count = counts[f.key] ?? 0;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFiltro(f.key)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-semibold transition-all border-2',
                  ativo ? 'shadow-md scale-105' : 'opacity-70 hover:opacity-100 border-transparent'
                )}
                style={{
                  backgroundColor: f.bg,
                  color: f.color,
                  borderColor: ativo ? f.color : 'transparent',
                }}
              >
                {f.label} <span className="ml-1 font-bold">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista scrollável */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {cards.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#6B7280] gap-2 py-12">
            <div className="text-5xl">📭</div>
            <div className="text-base">Nenhuma conversa nesse status</div>
          </div>
        ) : (
          cards.map(({ ficha, cfg, historico, etapas, tempoNoStatus, tempoTotal }) => (
            <div
              key={ficha.id}
              className="rounded-xl border-2 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              style={{ borderColor: cfg.border }}
            >
              {/* Faixa de status no topo */}
              <div
                className="px-4 py-2 flex items-center justify-between"
                style={{ background: cfg.gradient, color: '#FFFFFF' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cfg.icon}</span>
                  <span className="font-bold text-sm uppercase tracking-wide">{cfg.label}</span>
                </div>
                <span className="text-xs font-mono opacity-90">{ficha.id}</span>
              </div>

              <div className="p-4 bg-white">
                {/* Cliente + Valor */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#111827] text-base truncate">
                      {ficha.nome_cliente || ficha.nome_ficha || 'Sem nome'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {ficha.telefone_cliente}
                      </span>
                    </div>
                  </div>
                  {ficha.valor_total != null && ficha.valor_total > 0 && (
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-[#6B7280] font-semibold">Valor</div>
                      <div className="text-base font-bold text-emerald-700">
                        {formatCurrency(ficha.valor_total)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Barra de progresso GROSSA */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-semibold text-[#374151]">Progresso</span>
                    <span className="text-sm font-bold" style={{ color: cfg.bar }}>{cfg.percent}%</span>
                  </div>
                  <div className="h-6 w-full bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                    <div
                      className="h-full transition-all duration-700 flex items-center justify-end px-2"
                      style={{ width: `${cfg.percent}%`, background: cfg.gradient }}
                    >
                      {cfg.percent >= 20 && (
                        <span className="text-[10px] font-bold text-white drop-shadow">{cfg.percent}%</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline de etapas */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {etapas.map((etapa, idx) => {
                    const entry = findFirstEntry(historico, etapa);
                    const passed = !!entry;
                    const isCurrent = etapa === ficha.status;
                    const etapaCfg = getStatusConfig(etapa);

                    return (
                      <div key={`${etapa}-${idx}`} className="flex flex-col items-center text-center">
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full mb-1.5 border-2',
                            isCurrent && 'animate-pulse ring-4 ring-offset-1'
                          )}
                          style={{
                            backgroundColor: passed ? etapaCfg.bar : '#E5E7EB',
                            borderColor: passed ? etapaCfg.border : '#D1D5DB',
                            ...(isCurrent ? { boxShadow: `0 0 0 4px ${etapaCfg.bar}33` } : {}),
                          }}
                        />
                        <div className="text-[10px] font-bold text-[#374151] leading-tight">{etapa}</div>
                        {entry ? (
                          <>
                            <div className="text-[9px] text-[#6B7280] mt-0.5">
                              {format(new Date(entry.data_inicio), 'dd/MM HH:mm')}
                            </div>
                            <div className="text-[9px] text-[#9CA3AF] italic">
                              {formatRelative(new Date(entry.data_inicio), now)}
                            </div>
                          </>
                        ) : (
                          <div className="text-[9px] text-[#D1D5DB] mt-0.5">—</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Métricas finais */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                  <div className="rounded-lg p-2 text-center" style={{ backgroundColor: cfg.bg }}>
                    <div className="text-[9px] uppercase font-semibold" style={{ color: cfg.text }}>
                      No status
                    </div>
                    <div className="text-sm font-bold" style={{ color: cfg.text }}>
                      {formatDuration(tempoNoStatus)}
                    </div>
                  </div>
                  <div className="rounded-lg p-2 text-center bg-gray-50">
                    <div className="text-[9px] uppercase font-semibold text-[#6B7280]">Tempo total</div>
                    <div className="text-sm font-bold text-[#111827]">{formatDuration(tempoTotal)}</div>
                  </div>
                  <div className="rounded-lg p-2 text-center bg-emerald-50">
                    <div className="text-[9px] uppercase font-semibold text-emerald-700">Valor</div>
                    <div className="text-sm font-bold text-emerald-700">{formatCurrency(ficha.valor_total)}</div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
