import { useEffect, useMemo, useState } from "react";
import { calcularEstadoAgendamento, type AgendamentoData, type TipoSlot } from "@/lib/calcularEstadoAgendamento";
import { formatJanela, getJanelaHorario, type HorarioContexto } from "@/lib/janelaHorarioPrestador";
import { format } from "date-fns";
import { carregarCoresStatus, type CoresStatusMap } from "@/lib/calendarioStatusCores";
import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ConflitoSlot } from "@/lib/conflitoAgendamentoPrestador";

interface AgendamentoCardProps {
  ficha: any;
  onClick: () => void;
  compact?: boolean;
  /** Which time window to display: 'cliente' (default), 'prestador', or 'ambos' */
  contextoHorario?: HorarioContexto;
  /** Slot type — when 'visita' and status differs from 'Visita Técnica', renders as historical */
  tipoSlot?: TipoSlot;
  /** Pre-computed slot start/end (when provided, used to display the time of THIS slot) */
  slotInicio?: Date | null;
  slotFim?: Date | null;
  /** Vizinhos próximos do mesmo prestador (≤ 60 min). Quando presente, mostra alerta. */
  vizinhosProximos?: ConflitoSlot[];
}

const statusCancelados = ['Não foi adiante', 'Perdido', 'Orçamento Não Aprovado'];

const CORES_POR_STATUS_PADRAO: Record<string, string> = {
  'Em andamento': '#3B82F6',
  'Finalizado': '#6B7280',
  'Garantia': '#A855F7',
};

export function AgendamentoCard({
  ficha,
  onClick,
  compact = false,
  contextoHorario = 'cliente',
  tipoSlot,
  slotInicio,
  slotFim,
  vizinhosProximos,
}: AgendamentoCardProps) {
  const agData: AgendamentoData = {
    tipo_agendamento: ficha.tipo_agendamento,
    horario_agendamento: ficha.horario_agendamento,
    hora_inicio_agendamento: ficha.hora_inicio_agendamento,
    hora_fim_agendamento: ficha.hora_fim_agendamento,
    data_retorno: ficha.data_retorno,
    hora_inicio_retorno: ficha.hora_inicio_retorno,
    hora_fim_retorno: ficha.hora_fim_retorno,
    status: ficha.status,
    data_visita_tecnica: ficha.data_visita_tecnica,
    horario_visita_tecnica: ficha.horario_visita_tecnica,
    hora_inicio_prestador_agendamento: ficha.hora_inicio_prestador_agendamento,
    hora_fim_prestador_agendamento: ficha.hora_fim_prestador_agendamento,
    hora_inicio_prestador_retorno: ficha.hora_inicio_prestador_retorno,
    hora_fim_prestador_retorno: ficha.hora_fim_prestador_retorno,
  };

  const estado = useMemo(() => calcularEstadoAgendamento(agData), [ficha]);
  const isCancelado = statusCancelados.includes(ficha.status || '');

  // Slot histórico de visita técnica (status atual ≠ 'Visita Técnica')
  const isVisitaHistorica = tipoSlot === 'visita' && (ficha.status || '') !== 'Visita Técnica';

  const [coresCustom, setCoresCustom] = useState<CoresStatusMap>(() => carregarCoresStatus());
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as CoresStatusMap | undefined;
      setCoresCustom(detail || carregarCoresStatus());
    };
    window.addEventListener("calendario:cores-atualizadas", handler);
    return () => window.removeEventListener("calendario:cores-atualizadas", handler);
  }, []);

  const corFundo = useMemo(() => {
    if (tipoSlot === 'visita') return coresCustom['Visita Técnica'] || '#FBBF24';
    if (tipoSlot === 'retorno' && (ficha.status || '') === 'Retorno') {
      return coresCustom['Retorno'] || '#F97316';
    }
    const status = ficha.status || '';
    // Override para status presentes no painel de cores
    if (coresCustom[status]) return coresCustom[status];
    const statusCor = CORES_POR_STATUS_PADRAO[status];
    if (statusCor) return statusCor;
    return estado.cor;
  }, [ficha.status, estado.cor, tipoSlot, coresCustom]);

  const horaStr = useMemo(() => {
    // Quando temos um slot específico (visita/retorno), priorizamos seu horário
    if (slotInicio) {
      const h = format(slotInicio, 'HH:mm');
      const f = slotFim ? format(slotFim, 'HH:mm') : '';
      return f && f !== h ? `${h}-${f}` : h;
    }

    if (contextoHorario === 'ambos') {
      const janelas = getJanelaHorario(ficha, 'ambos') as any;
      const cStr = formatJanela(janelas?.cliente?.inicio, janelas?.cliente?.fim);
      const pStr = formatJanela(janelas?.prestador?.inicio, janelas?.prestador?.fim);
      if (cStr && pStr && cStr !== pStr) return `C:${cStr} | P:${pStr}`;
      return cStr || pStr || fallbackHora();
    }

    const janela = getJanelaHorario(ficha, contextoHorario);
    const janelaStr = formatJanela((janela as any)?.inicio, (janela as any)?.fim);
    if (janelaStr) return janelaStr;

    return fallbackHora();
  }, [ficha, contextoHorario, slotInicio, slotFim]);

  function fallbackHora(): string {
    if (ficha.horario_agendamento) {
      return format(new Date(ficha.horario_agendamento), 'HH:mm');
    }
    if (ficha.horario_visita_tecnica) {
      return format(new Date(ficha.horario_visita_tecnica), 'HH:mm');
    }
    return '';
  }

  const opacidadeClasse = isCancelado ? 'opacity-50' : isVisitaHistorica ? 'opacity-70' : '';
  const prefixo = tipoSlot === 'visita' ? '[VT] ' : '';
  const tooltipExtra = isVisitaHistorica ? ' — Visita técnica realizada' : '';

  const temVizinhos = !!(vizinhosProximos && vizinhosProximos.length > 0);
  const tooltipVizinhos = temVizinhos
    ? vizinhosProximos!
        .map(v => {
          const h = format(v.inicio, 'HH:mm');
          const tipoL = v.tipoSlot === 'visita' ? 'VT' : v.tipoSlot === 'retorno' ? 'Ret' : 'Serv';
          return `${h} ${tipoL} — ${v.nomeCliente || v.nomeFicha || v.fichaId} (#${v.fichaId})`;
        })
        .join('\n')
    : '';

  const button = (
    <button
      onClick={onClick}
      className={`relative w-full text-left rounded-lg px-2 py-1 text-xs font-medium text-white truncate transition-all duration-150 active:scale-[0.97] ${opacidadeClasse} ${isVisitaHistorica ? 'border border-dashed border-white/60' : ''} ${temVizinhos ? 'ring-1 ring-amber-400/80' : ''}`}
      style={{ backgroundColor: corFundo }}
      title={`${prefixo}${ficha.id} - ${ficha.nome_cliente || 'Cliente'} - ${ficha.prestadores?.nome || 'Sem prestador'}${tooltipExtra}${temVizinhos ? `\n⚠ Próximo:\n${tooltipVizinhos}` : ''}`}
    >
      {temVizinhos && (
        <AlertTriangle className="absolute top-0.5 right-0.5 h-3 w-3 text-amber-300 drop-shadow" />
      )}
      {compact ? (
        <span className="truncate block">
          {prefixo && <span className="font-bold mr-0.5">{prefixo}</span>}
          {horaStr && <span className="font-bold mr-1">{horaStr}</span>}
          {ficha.id}
        </span>
      ) : (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1">
            {prefixo && <span className="font-bold">{prefixo}</span>}
            {horaStr && <span className="font-bold">{horaStr}</span>}
            <span className="truncate">{ficha.id}</span>
          </div>
          <div className="truncate opacity-90">{ficha.nome_cliente || ficha.clientes?.nome || '—'}</div>
          <div className="truncate opacity-80">{ficha.prestadores?.nome || '—'}</div>
        </div>
      )}
    </button>
  );

  return button;
}
