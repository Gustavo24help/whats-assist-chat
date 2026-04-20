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

// Etapas fixas exibidas na timeline (a 3ª é dinâmica entre Agendado e Visita Técnica)
const ETAPAS_BASE = ['Ficha Criada', 'Orçamento Enviado', '__intermediario__', 'Finalizado'] as const;

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

function getStatusConfig(status: string) {
  switch (status) {
    case 'Ficha Criada':
      return { color: 'bg-gray-400', textColor: 'text-gray-700', barColor: 'bg-gray-400', percent: 12, badgeBg: 'bg-gray-200', badgeText: 'text-gray-800' };
    case 'Orçamento Enviado':
      return { color: 'bg-blue-500', textColor: 'text-blue-700', barColor: 'bg-blue-500', percent: 38, badgeBg: 'bg-blue-100', badgeText: 'text-blue-800' };
    case 'Visita Técnica':
      return { color: 'bg-amber-500', textColor: 'text-amber-700', barColor: 'bg-amber-500', percent: 55, badgeBg: 'bg-amber-100', badgeText: 'text-amber-800' };
    case 'Agendado':
      return { color: 'bg-emerald-500', textColor: 'text-emerald-700', barColor: 'bg-emerald-500', percent: 72, badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-800' };
    default:
      return { color: 'bg-gray-300', textColor: 'text-gray-600', barColor: 'bg-gray-300', percent: 0, badgeBg: 'bg-gray-100', badgeText: 'text-gray-700' };
  }
}

// Encontra a primeira ocorrência de um status no histórico
function findFirstEntry(historico: HistoricoEntry[], status: string): HistoricoEntry | undefined {
  return historico.find(h => h.status_novo === status);
}

// ===== Componente =====
export function ConversationTimelineTV() {
  const { toast } = useToast();
  const [fichas, setFichas] = useState<FichaTimeline[]>([]);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);

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

    // Realtime: qualquer mudança em fichas_de_servico ou histórico recarrega
    const channel = supabase
      .channel('conversation-timeline-tv')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fichas_de_servico' }, () => fetchFichas())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ficha_status_historico' }, () => fetchFichas())
      .subscribe();

    // Atualiza tempos relativos a cada minuto
    const tick = setInterval(() => setNow(new Date()), 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = useMemo(() => {
    return fichas.map(ficha => {
      const cfg = getStatusConfig(ficha.status);
      const historico = ficha.ficha_status_historico;

      // Primeira entrada (Ficha Criada) — fallback para created_at
      const primeiraEntrada =
        findFirstEntry(historico, 'Ficha Criada') ||
        (historico[0] || { status_novo: 'Ficha Criada', data_inicio: ficha.created_at });

      // Última entrada do histórico = status atual
      const ultimaEntrada = historico[historico.length - 1] || primeiraEntrada;

      // Determinar se intermediário é Visita Técnica ou Agendado
      const temVT = !!findFirstEntry(historico, 'Visita Técnica');
      const intermediarioStatus = temVT ? 'Visita Técnica' : 'Agendado';

      const etapas = ['Ficha Criada', 'Orçamento Enviado', intermediarioStatus, 'Finalizado'];

      const tempoNoStatus = now.getTime() - new Date(ultimaEntrada.data_inicio).getTime();
      const tempoTotal = now.getTime() - new Date(primeiraEntrada.data_inicio).getTime();

      return { ficha, cfg, historico, primeiraEntrada, ultimaEntrada, etapas, tempoNoStatus, tempoTotal };
    });
  }, [fichas, now]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[#6B7280] text-sm">
        Carregando acompanhamento...
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-[#6B7280] gap-1 p-4">
        <div className="text-3xl">📭</div>
        <div className="text-sm">Nenhuma conversa ativa no momento</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-white rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between sticky top-0 bg-white z-10 pb-2 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-[#111827] uppercase tracking-wider">
          Acompanhamento de Conversas
        </h3>
        <span className="text-xs text-[#6B7280]">{cards.length} ativas</span>
      </div>

      {cards.map(({ ficha, cfg, historico, primeiraEntrada, etapas, tempoNoStatus, tempoTotal }) => (
        <div
          key={ficha.id}
          className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[#111827] text-sm truncate">
                  {ficha.nome_ficha || ficha.id}
                </span>
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.badgeBg, cfg.badgeText)}>
                  {ficha.status}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-[#6B7280] truncate">{ficha.nome_cliente || 'Sem nome'}</span>
                <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                  {ficha.telefone_cliente}
                </span>
              </div>
            </div>
            {ficha.valor_total != null && ficha.valor_total > 0 && (
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-1 rounded whitespace-nowrap">
                {formatCurrency(ficha.valor_total)}
              </span>
            )}
          </div>

          {/* Barra de progresso */}
          <div className="relative mb-1">
            <div className="flex justify-end mb-1">
              <span className={cn('text-[10px] font-bold', cfg.textColor)}>{cfg.percent}%</span>
            </div>
            <div className="h-3.5 w-full bg-gray-100 rounded-[7px] overflow-hidden">
              <div
                className={cn('h-full transition-all duration-500', cfg.barColor)}
                style={{ width: `${cfg.percent}%` }}
              />
            </div>
          </div>

          {/* Nós da timeline */}
          <div className="grid grid-cols-4 gap-1 mt-3 mb-2">
            {etapas.map((etapa, idx) => {
              const entry = findFirstEntry(historico, etapa);
              const passed = !!entry;
              const isCurrent = etapa === ficha.status;
              const dotClass = isCurrent
                ? cn(cfg.color, 'animate-pulse ring-2 ring-offset-1', `ring-${cfg.color.replace('bg-', '')}/40`)
                : passed
                ? 'bg-emerald-500'
                : 'bg-gray-300';

              return (
                <div key={`${etapa}-${idx}`} className="flex flex-col items-center text-center">
                  <div className={cn('w-2.5 h-2.5 rounded-full mb-1', dotClass)} />
                  <div className="text-[9px] font-semibold text-[#374151] leading-tight">{etapa}</div>
                  {entry ? (
                    <>
                      <div className="text-[8px] text-[#6B7280] mt-0.5">
                        {format(new Date(entry.data_inicio), 'dd/MM HH:mm')}
                      </div>
                      <div className="text-[8px] text-[#9CA3AF]">
                        {formatRelative(new Date(entry.data_inicio), now)}
                      </div>
                    </>
                  ) : (
                    <div className="text-[8px] text-[#D1D5DB] mt-0.5">—</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Deltas entre etapas */}
          <div className="grid grid-cols-4 gap-1 mb-3">
            {etapas.map((etapa, idx) => {
              if (idx === etapas.length - 1) return <div key={`delta-${idx}`} />;
              const atual = findFirstEntry(historico, etapa);
              const proximo = findFirstEntry(historico, etapas[idx + 1]);
              return (
                <div key={`delta-${idx}`} className="col-start-auto" style={{ gridColumn: `${idx + 1} / span 2`, justifySelf: 'center' }}>
                  {atual && proximo ? (
                    <span className="text-[8px] text-[#6B7280] bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                      {formatDuration(new Date(proximo.data_inicio).getTime() - new Date(atual.data_inicio).getTime())} depois
                    </span>
                  ) : (
                    <span className="text-[8px] text-[#D1D5DB]">—</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
            <div className="bg-gray-50 rounded p-1.5 text-center">
              <div className="text-[8px] text-[#6B7280] uppercase">No status atual</div>
              <div className={cn('text-xs font-bold', cfg.textColor)}>{formatDuration(tempoNoStatus)}</div>
            </div>
            <div className="bg-gray-50 rounded p-1.5 text-center">
              <div className="text-[8px] text-[#6B7280] uppercase">Tempo total</div>
              <div className="text-xs font-bold text-[#111827]">{formatDuration(tempoTotal)}</div>
            </div>
            <div className="bg-gray-50 rounded p-1.5 text-center">
              <div className="text-[8px] text-[#6B7280] uppercase">Valor</div>
              <div className="text-xs font-bold text-emerald-700">{formatCurrency(ficha.valor_total)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
