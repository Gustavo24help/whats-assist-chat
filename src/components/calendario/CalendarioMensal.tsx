import { useMemo } from "react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AgendamentoCard } from "./AgendamentoCard";
import { getAgendamentoDates } from "@/lib/calcularEstadoAgendamento";

interface Props {
  fichas: any[];
  currentDate: Date;
  onSelectFicha: (ficha: any) => void;
}

export function CalendarioMensal({ fichas, currentDate, onSelectFicha }: Props) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { locale: ptBR });
    const calEnd = endOfWeek(monthEnd, { locale: ptBR });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate]);

  const fichasByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    fichas.forEach(f => {
      const { inicio } = getAgendamentoDates(f);
      if (!inicio) return;
      const key = format(inicio, 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(f);
    });
    return map;
  }, [fichas]);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <div className="grid grid-cols-7">
        {weekDays.map(d => (
          <div key={d} className="p-2 text-center text-xs font-semibold text-muted-foreground border-b bg-muted/30">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const dayFichas = fichasByDay[key] || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={key}
              className={`min-h-[100px] 2xl:min-h-[120px] border-b border-r p-1 ${
                !isCurrentMonth ? 'bg-muted/20 opacity-50' : ''
              } ${isToday ? 'bg-primary/5' : ''}`}
            >
              <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5 max-h-[80px] 2xl:max-h-[100px] overflow-y-auto">
                {dayFichas.slice(0, 4).map(f => (
                  <AgendamentoCard key={f.id} ficha={f} onClick={() => onSelectFicha(f)} compact />
                ))}
                {dayFichas.length > 4 && (
                  <div className="text-[10px] text-muted-foreground text-center">+{dayFichas.length - 4} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
