import { useState, useMemo } from "react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AgendamentoCard } from "./AgendamentoCard";
import { getAgendamentoDates } from "@/lib/calcularEstadoAgendamento";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  fichas: any[];
  currentDate: Date;
  onSelectFicha: (ficha: any) => void;
}

export function CalendarioMensal({ fichas, currentDate, onSelectFicha }: Props) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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

  const selectedDayFichas = selectedDay ? (fichasByDay[selectedDay] || []) : [];
  const selectedDayDate = selectedDay ? parse(selectedDay, 'yyyy-MM-dd', new Date()) : null;

  return (
    <div className="flex gap-4">
      {/* Calendar grid */}
      <div className={`border rounded-xl overflow-hidden bg-card ${selectedDay ? 'flex-1' : 'w-full'}`}>
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
            const isSelected = selectedDay === key;

            return (
              <div
                key={key}
                className={`min-h-[100px] 2xl:min-h-[120px] border-b border-r p-1 ${
                  !isCurrentMonth ? 'bg-muted/20 opacity-50' : ''
                } ${isToday ? 'bg-primary/5' : ''} ${isSelected ? 'ring-2 ring-primary/50' : ''}`}
              >
                <div
                  className={`text-xs font-medium mb-1 cursor-pointer hover:text-primary transition-colors ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}
                  onClick={() => dayFichas.length > 0 && setSelectedDay(isSelected ? null : key)}
                >
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5 max-h-[80px] 2xl:max-h-[100px] overflow-y-auto">
                  {dayFichas.slice(0, 4).map(f => (
                    <AgendamentoCard key={f.id} ficha={f} onClick={() => onSelectFicha(f)} compact />
                  ))}
                  {dayFichas.length > 4 && (
                    <div
                      className="text-[10px] text-primary font-medium text-center cursor-pointer hover:underline"
                      onClick={() => setSelectedDay(key)}
                    >
                      +{dayFichas.length - 4} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side panel */}
      {selectedDay && selectedDayDate && (
        <div className="w-[320px] shrink-0 border rounded-xl bg-card flex flex-col max-h-[calc(100vh-220px)]">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="text-sm font-semibold capitalize">
              {format(selectedDayDate, "dd 'de' MMMM", { locale: ptBR })}
              <span className="text-muted-foreground font-normal ml-1">({selectedDayFichas.length})</span>
            </h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDay(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1.5">
              {selectedDayFichas.map(f => (
                <AgendamentoCard key={f.id} ficha={f} onClick={() => onSelectFicha(f)} compact={false} />
              ))}
              {selectedDayFichas.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum agendamento</p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
