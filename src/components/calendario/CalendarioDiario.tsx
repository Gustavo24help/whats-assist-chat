import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AgendamentoCard } from "./AgendamentoCard";
import { getAllAgendamentoSlots, type AgendamentoSlot } from "@/lib/calcularEstadoAgendamento";
import type { HorarioContexto } from "@/lib/janelaHorarioPrestador";

interface Props {
  fichas: any[];
  currentDate: Date;
  onSelectFicha: (ficha: any) => void;
  contextoHorario?: HorarioContexto;
  mostrarVisitaHistorica?: boolean;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

interface SlotItem { ficha: any; slot: AgendamentoSlot; }

export function CalendarioDiario({ fichas, currentDate, onSelectFicha, contextoHorario = 'cliente', mostrarVisitaHistorica = true }: Props) {
  const slotsByHour = useMemo(() => {
    const map: Record<number, SlotItem[]> = {};
    fichas.forEach(f => {
      const slots = getAllAgendamentoSlots(f);
      slots.forEach(slot => {
        if (!isSameDay(slot.inicio, currentDate)) return;
        const isVisitaHistorica = slot.tipoSlot === 'visita' && (f.status || '') !== 'Visita Técnica';
        if (isVisitaHistorica && !mostrarVisitaHistorica) return;
        const hour = Math.max(7, Math.min(22, slot.inicio.getHours()));
        if (!map[hour]) map[hour] = [];
        map[hour].push({ ficha: f, slot });
      });
    });
    return map;
  }, [fichas, currentDate, mostrarVisitaHistorica]);

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <div className="p-3 border-b bg-muted/30 text-center font-semibold">
        {format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
      </div>
      <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
        {HOURS.map(hour => {
          const slotItems = slotsByHour[hour] || [];
          return (
            <div key={hour} className="grid grid-cols-[80px_1fr] min-h-[70px] border-b">
              <div className="border-r p-2 text-sm text-muted-foreground text-right pr-3 pt-2 font-medium">
                {String(hour).padStart(2, '0')}:00
              </div>
              <div className="p-1 space-y-1">
                {slotItems.map(({ ficha, slot }, idx) => (
                  <AgendamentoCard
                    key={`${ficha.id}-${slot.tipoSlot}-${idx}`}
                    ficha={ficha}
                    onClick={() => onSelectFicha(ficha)}
                    contextoHorario={contextoHorario}
                    tipoSlot={slot.tipoSlot}
                    slotInicio={slot.inicio}
                    slotFim={slot.fim}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
