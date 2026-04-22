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

// Configuração rica de cores por status (vibrante para TV)
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
  // Multi-select de status — começa com todos ativos
  const [statusAtivos, setStatusAtivos] = useState<Set<StatusAtual>>(
    () => new Set(STATUS_FILTRADOS)
  );

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
        .order('created_at', { ascending: true }); // mais antigo primeiro

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

  const cards = useMemo(() => {
    // Filtra pelos status ativos (multi-select). Se nenhum ativo, lista vazia.
    const filtradas = fichas.filter(f => statusAtivos.has(f.status as StatusAtual));

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
  }, [fichas, now, statusAtivos]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white text-3xl bg-[#0B1220]">
        Carregando acompanhamento...
      </div>
    );
  }

  const FILTROS: Array<{ key: StatusAtual; label: string; color: string; bg: string }> = [
    { key: 'Ficha Criada', label: '📝 Ficha Criada', color: '#3730A3', bg: '#E0E7FF' },
    { key: 'Orçamento Enviado', label: '💰 Orçamento', color: '#1E40AF', bg: '#DBEAFE' },
    { key: 'Visita Técnica', label: '🔧 Visita Técnica', color: '#92400E', bg: '#FEF3C7' },
    { key: 'Agendado', label: '📅 Agendado', color: '#065F46', bg: '#D1FAE5' },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-[#0B1220] overflow-hidden">
      {/* Header com título + filtros multi-select */}
      <div className="flex-shrink-0 bg-[#111827] border-b-4 border-[#1F2937] px-8 py-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-5xl font-extrabold text-white uppercase tracking-wider">
            Acompanhamento de Conversas
          </h3>
          <span className="text-3xl font-extrabold text-cyan-400">{cards.length} conversas</span>
        </div>

        {/* Filtros multi-select por status (chips clicáveis) */}
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xl font-bold text-white/70 mr-2">FILTRAR:</span>
          {FILTROS.map(f => {
            const ativo = statusAtivos.has(f.key);
            const count = counts[f.key] ?? 0;
            return (
              <button
                key={f.key}
                onClick={() => toggleStatus(f.key)}
                className={cn(
                  'px-5 py-3 rounded-full text-2xl font-extrabold transition-all border-4 flex items-center gap-2',
                  ativo ? 'shadow-xl scale-105' : 'opacity-40 hover:opacity-70 border-transparent',
                )}
                style={{
                  backgroundColor: ativo ? f.bg : '#1F2937',
                  color: ativo ? f.color : '#9CA3AF',
                  borderColor: ativo ? f.color : 'transparent',
                }}
              >
                <span className={cn('w-5 h-5 rounded border-2 flex items-center justify-center text-xs',
                  ativo ? 'bg-white' : 'bg-transparent')}
                  style={{ borderColor: ativo ? f.color : '#4B5563' }}
                >
                  {ativo && <span style={{ color: f.color }}>✓</span>}
                </span>
                {f.label}
                <span className="ml-1 px-2 py-0.5 rounded-full text-xl"
                  style={{ backgroundColor: ativo ? f.color : '#374151', color: ativo ? '#fff' : '#9CA3AF' }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista — grid 2 colunas, mais antigo no topo-esquerda */}
      <div className="flex-1 overflow-y-auto p-6">
        {cards.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/60 gap-4 py-16">
            <div className="text-8xl">📭</div>
            <div className="text-3xl font-bold">Nenhuma conversa nos status selecionados</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {cards.map(({ ficha, cfg, historico, etapas, tempoNoStatus, tempoTotal }) => (
              <div
                key={ficha.id}
                className="rounded-2xl border-[5px] shadow-2xl overflow-hidden bg-white"
                style={{ borderColor: cfg.border }}
              >
                {/* Faixa de status no topo */}
                <div
                  className="px-6 py-4 flex items-center justify-between"
                  style={{ background: cfg.gradient, color: '#FFFFFF' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-5xl">{cfg.icon}</span>
                    <span className="font-extrabold text-3xl uppercase tracking-wide">{cfg.label}</span>
                  </div>
                  <span className="text-xl font-mono opacity-90 font-extrabold bg-black/20 px-3 py-1 rounded-lg">
                    {ficha.id}
                  </span>
                </div>

                <div className="p-6 bg-white">
                  {/* Cliente + Valor */}
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-[#111827] text-3xl truncate">
                        {ficha.nome_cliente || ficha.nome_ficha || 'Sem nome'}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xl font-mono bg-gray-100 text-gray-800 px-3 py-1.5 rounded-lg font-bold">
                          {ficha.telefone_cliente}
                        </span>
                      </div>
                    </div>
                    {ficha.valor_total != null && ficha.valor_total > 0 && (
                      <div className="text-right">
                        <div className="text-base uppercase text-[#6B7280] font-extrabold">Valor</div>
                        <div className="text-3xl font-extrabold text-emerald-700">
                          {formatCurrency(ficha.valor_total)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Barra de progresso GROSSA */}
                  <div className="mb-5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xl font-extrabold text-[#374151]">Progresso</span>
                      <span className="text-3xl font-extrabold" style={{ color: cfg.bar }}>{cfg.percent}%</span>
                    </div>
                    <div className="h-12 w-full bg-gray-100 rounded-xl overflow-hidden border-[3px] border-gray-200">
                      <div
                        className="h-full transition-all duration-700 flex items-center justify-end px-4"
                        style={{ width: `${cfg.percent}%`, background: cfg.gradient }}
                      >
                        {cfg.percent >= 20 && (
                          <span className="text-xl font-extrabold text-white drop-shadow">{cfg.percent}%</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Timeline de etapas */}
                  <div className="grid grid-cols-4 gap-3 mb-5">
                    {etapas.map((etapa, idx) => {
                      const entry = findFirstEntry(historico, etapa);
                      const passed = !!entry;
                      const isCurrent = etapa === ficha.status;
                      const etapaCfg = getStatusConfig(etapa);

                      return (
                        <div key={`${etapa}-${idx}`} className="flex flex-col items-center text-center">
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full mb-2 border-[4px]',
                              isCurrent && 'animate-pulse'
                            )}
                            style={{
                              backgroundColor: passed ? etapaCfg.bar : '#E5E7EB',
                              borderColor: passed ? etapaCfg.border : '#D1D5DB',
                              ...(isCurrent ? { boxShadow: `0 0 0 8px ${etapaCfg.bar}33` } : {}),
                            }}
                          />
                          <div className="text-base font-extrabold text-[#374151] leading-tight">{etapa}</div>
                          {entry ? (
                            <>
                              <div className="text-sm text-[#6B7280] mt-1 font-bold">
                                {format(new Date(entry.data_inicio), 'dd/MM HH:mm')}
                              </div>
                              <div className="text-sm text-[#9CA3AF] italic font-semibold">
                                {formatRelative(new Date(entry.data_inicio), now)}
                              </div>
                            </>
                          ) : (
                            <div className="text-base text-[#D1D5DB] mt-1">—</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Métricas finais */}
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t-[3px] border-gray-100">
                    <div className="rounded-xl p-4 text-center" style={{ backgroundColor: cfg.bg }}>
                      <div className="text-base uppercase font-extrabold" style={{ color: cfg.text }}>
                        No status
                      </div>
                      <div className="text-2xl font-extrabold" style={{ color: cfg.text }}>
                        {formatDuration(tempoNoStatus)}
                      </div>
                    </div>
                    <div className="rounded-xl p-4 text-center bg-gray-100">
                      <div className="text-base uppercase font-extrabold text-[#6B7280]">Tempo total</div>
                      <div className="text-2xl font-extrabold text-[#111827]">{formatDuration(tempoTotal)}</div>
                    </div>
                    <div className="rounded-xl p-4 text-center bg-emerald-50">
                      <div className="text-base uppercase font-extrabold text-emerald-700">Valor</div>
                      <div className="text-2xl font-extrabold text-emerald-700">{formatCurrency(ficha.valor_total)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
