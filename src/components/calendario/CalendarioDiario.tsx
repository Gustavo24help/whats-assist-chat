import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AgendamentoCard } from "./AgendamentoCard";
import { getAgendamentoDates } from "@/lib/calcularEstadoAgendamento";

interface Props {
  fichas: any[];
  currentDate: Date;
  onSelectFicha: (ficha: any) => void;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

export function CalendarioDiario({ fichas, currentDate, onSelectFicha }: Props) {
  const fichasByHour = useMemo(() => {
    const map: Record<number, any[]> = {};
    fichas.forEach(f => {
      const { inicio } = getAgendamentoDates(f);
      if (!inicio || !isSameDay(inicio, currentDate)) return;
      const hour = Math.max(7, Math.min(22, inicio.getHours()));
      if (!map[hour]) map[hour] = [];
      map[hour].push(f);
    });
    return map;
  }, [fichas, currentDate]);

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <div className="p-3 border-b bg-muted/30 text-center font-semibold">
        {format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
      </div>
      <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
        {HOURS.map(hour => {
          const slotFichas = fichasByHour[hour] || [];
          return (
            <div key={hour} className="grid grid-cols-[80px_1fr] min-h-[70px] border-b">
              <div className="border-r p-2 text-sm text-muted-foreground text-right pr-3 pt-2 font-medium">
                {String(hour).padStart(2, '0')}:00
              </div>
              <div className="p-1 space-y-1">
                {slotFichas.map(f => (
                  <AgendamentoCard key={f.id} ficha={f} onClick={() => onSelectFicha(f)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
