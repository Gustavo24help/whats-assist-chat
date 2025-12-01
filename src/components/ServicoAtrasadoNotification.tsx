import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ServicoParaFinalizar {
  id: string;
  nome_ficha: string;
  telefone_cliente: string;
  horario_agendamento: string;
  endereco?: string;
}

interface ServicoAtrasadoNotificationProps {
  onSelectFicha: (fichaId: string, telefoneCliente: string) => void;
}

// Som de notificação (sino suave)
const NOTIFICATION_SOUND = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export function ServicoAtrasadoNotification({ onSelectFicha }: ServicoAtrasadoNotificationProps) {
  const [notifications, setNotifications] = useState<ServicoParaFinalizar[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousCountRef = useRef(0);

  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);
    fetchServicosParaFinalizar();

    // Realtime: escutar mudanças na tabela fichas_de_servico
    const channel = supabase
      .channel('fichas-para-finalizar')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fichas_de_servico' },
        () => {
          fetchServicosParaFinalizar();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Tocar som quando novos serviços aparecem
  useEffect(() => {
    if (notifications.length > previousCountRef.current && previousCountRef.current > 0) {
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.log('Could not play sound:', e));
      }
    }
    previousCountRef.current = notifications.length;
  }, [notifications.length]);

  const fetchServicosParaFinalizar = async () => {
    // Buscar fichas com status "Agendado" e horario_agendamento passou 2 horas
    const now = new Date();
    const duasHorasAtras = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    
    console.log("ServicoAtrasadoNotification - Buscando serviços atrasados, cutoff:", duasHorasAtras);
    
    const { data, error } = await supabase
      .from('fichas_de_servico')
      .select('id, nome_ficha, telefone_cliente, horario_agendamento, endereco')
      .eq('status', 'Agendado')
      .not('horario_agendamento', 'is', null)
      .lt('horario_agendamento', duasHorasAtras)
      .order('horario_agendamento', { ascending: true });

    if (!error && data) {
      setNotifications(data);
    }
  };

  const calcularTempoDecorrido = (horarioAgendamento: string) => {
    const agendamento = new Date(horarioAgendamento);
    const agora = new Date();
    const diffMs = agora.getTime() - agendamento.getTime();
    const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHoras < 1) return "menos de 1 hora";
    if (diffHoras === 1) return "1 hora";
    return `${diffHoras} horas`;
  };

  if (notifications.length === 0) return null;

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative"
        >
          <Bell className="h-5 w-5 text-red-500" />
          {notifications.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {notifications.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b bg-red-50 dark:bg-red-950">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-red-900 dark:text-red-100">
              Serviços para Finalizar ou Reagendar
            </h3>
          </div>
          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
            {notifications.length} {notifications.length === 1 ? 'serviço precisa' : 'serviços precisam'} de atualização
          </p>
        </div>
        
        <ScrollArea className="h-[400px]">
          <div className="p-2 space-y-2">
            {notifications.map((servico) => (
              <button
                key={servico.id}
                onClick={() => {
                  onSelectFicha(servico.id, servico.telefone_cliente);
                  setPopoverOpen(false);
                }}
                className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500 shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {servico.nome_ficha || servico.id}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Agendado: {format(new Date(servico.horario_agendamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    {servico.endereco && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        📍 {servico.endereco}
                      </p>
                    )}
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">
                      ⏰ Passou há {calcularTempoDecorrido(servico.horario_agendamento)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
