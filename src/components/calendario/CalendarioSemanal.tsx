import { useMemo } from "react";
import { startOfWeek, addDays, format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AgendamentoCard } from "./AgendamentoCard";
import { getAllAgendamentoSlots, type AgendamentoSlot } from "@/lib/calcularEstadoAgendamento";
import type { HorarioContexto } from "@/lib/janelaHorarioPrestador";
import type { ProximidadeMapa } from "@/lib/conflitoAgendamentoPrestador";

interface Props {
  fichas: any[];
  currentDate: Date;
  onSelectFicha: (ficha: any) => void;
  contextoHorario?: HorarioContexto;
  mostrarVisitaHistorica?: boolean;
  proximidadeMapa?: ProximidadeMapa;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

interface SlotItem { ficha: any; slot: AgendamentoSlot; }

export function CalendarioSemanal({ fichas, currentDate, onSelectFicha, contextoHorario = 'cliente', mostrarVisitaHistorica = true, proximidadeMapa }: Props) {
  const weekStart = useMemo(() => startOfWeek(currentDate, { locale: ptBR }), [currentDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const slotsByDayHour = useMemo(() => {
    const map: Record<string, SlotItem[]> = {};
    fichas.forEach(f => {
      const slots = getAllAgendamentoSlots(f);
      slots.forEach(slot => {
        const isVisitaHistorica = slot.tipoSlot === 'visita' && (f.status || '') !== 'Visita Técnica';
        if (isVisitaHistorica && !mostrarVisitaHistorica) return;
        const dayKey = format(slot.inicio, 'yyyy-MM-dd');
        const hour = Math.max(7, Math.min(22, slot.inicio.getHours()));
        const key = `${dayKey}-${hour}`;
        if (!map[key]) map[key] = [];
        map[key].push({ ficha: f, slot });
      });
    });
    return map;
  }, [fichas, mostrarVisitaHistorica]);

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <div className="grid grid-cols-[60px_repeat(7,1fr)]">
        <div className="border-b border-r bg-muted/30 p-2" />
        {weekDays.map(day => (
          <div
            key={day.toISOString()}
            className={`border-b border-r p-2 text-center text-xs font-semibold ${
              isSameDay(day, new Date()) ? 'bg-primary/10 text-primary' : 'text-muted-foreground bg-muted/30'
            }`}
          >
            <div>{format(day, 'EEE', { locale: ptBR })}</div>
            <div className="text-sm font-bold">{format(day, 'd')}</div>
          </div>
        ))}
      </div>

      <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
        {HOURS.map(hour => (
          <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[60px]">
            <div className="border-b border-r p-1 text-[11px] text-muted-foreground text-right pr-2 pt-1">
              {String(hour).padStart(2, '0')}:00
            </div>
            {weekDays.map(day => {
              const key = `${format(day, 'yyyy-MM-dd')}-${hour}`;
              const slotItems = slotsByDayHour[key] || [];
              return (
                <div key={key} className="border-b border-r p-0.5 space-y-0.5">
                  {slotItems.map(({ ficha, slot }, idx) => (
                    <AgendamentoCard
                      key={`${ficha.id}-${slot.tipoSlot}-${idx}`}
                      ficha={ficha}
                      onClick={() => onSelectFicha(ficha)}
                      compact
                      contextoHorario={contextoHorario}
                      tipoSlot={slot.tipoSlot}
                      slotInicio={slot.inicio}
                      slotFim={slot.fim}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
