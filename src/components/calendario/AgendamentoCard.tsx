import { useMemo } from "react";
import { calcularEstadoAgendamento, getLabelTipo, type AgendamentoData } from "@/lib/calcularEstadoAgendamento";
import { formatJanela, getJanelaHorario, type HorarioContexto } from "@/lib/janelaHorarioPrestador";
import { format } from "date-fns";

interface AgendamentoCardProps {
  ficha: any;
  onClick: () => void;
  compact?: boolean;
  /** Which time window to display: 'cliente' (default), 'prestador', or 'ambos' */
  contextoHorario?: HorarioContexto;
}

const statusCancelados = ['Não foi adiante', 'Perdido', 'Orçamento Não Aprovado'];

export function AgendamentoCard({ ficha, onClick, compact = false, contextoHorario = 'cliente' }: AgendamentoCardProps) {
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

  const horaStr = useMemo(() => {
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
  }, [ficha, contextoHorario]);

  function fallbackHora(): string {
    if (ficha.horario_agendamento) {
      return format(new Date(ficha.horario_agendamento), 'HH:mm');
    }
    if (ficha.horario_visita_tecnica) {
      return format(new Date(ficha.horario_visita_tecnica), 'HH:mm');
    }
    return '';
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg px-2 py-1 text-xs font-medium text-white truncate transition-all duration-150 active:scale-[0.97] ${isCancelado ? 'opacity-50' : ''}`}
      style={{ backgroundColor: estado.cor }}
      title={`${ficha.id} - ${ficha.nome_cliente || 'Cliente'} - ${ficha.prestadores?.nome || 'Sem prestador'}`}
    >
      {compact ? (
        <span className="truncate block">
          {horaStr && <span className="font-bold mr-1">{horaStr}</span>}
          {ficha.id}
        </span>
      ) : (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1">
            {horaStr && <span className="font-bold">{horaStr}</span>}
            <span className="truncate">{ficha.id}</span>
          </div>
          <div className="truncate opacity-90">{ficha.nome_cliente || ficha.clientes?.nome || '—'}</div>
          <div className="truncate opacity-80">{ficha.prestadores?.nome || '—'}</div>
        </div>
      )}
    </button>
  );
}
