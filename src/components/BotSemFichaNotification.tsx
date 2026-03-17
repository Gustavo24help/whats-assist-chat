import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClienteSemFicha {
  telefone: string;
  nome: string;
  data_bot_desabilitado: string;
}

interface BotSemFichaNotificationProps {
  onSelectCliente: (cliente: any) => void;
}

export function BotSemFichaNotification({ onSelectCliente }: BotSemFichaNotificationProps) {
  const [alerts, setAlerts] = useState<ClienteSemFicha[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousCountRef = useRef(0);

  useEffect(() => {
    audioRef.current = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
    fetchClientesSemFicha();

    const interval = setInterval(fetchClientesSemFicha, 60000); // check every minute

    const channel = supabase
      .channel('bot-sem-ficha-monitor')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clientes' },
        () => fetchClientesSemFicha()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchClientesSemFicha = async () => {
    // Buscar clientes onde:
    // - bot foi desabilitado (bot_habilitado = false)
    // - bot já foi desligado alguma vez (bot_ja_desligado_alguma_vez = true)
    // - não tem ficha ativa (ficha_ativa_id is null)
    // - bot foi desabilitado nas últimas 24h
    const ontem = new Date();
    ontem.setHours(ontem.getHours() - 24);

    const { data, error } = await supabase
      .from('clientes')
      .select('telefone, nome, data_bot_desabilitado')
      .eq('bot_habilitado', false)
      .eq('bot_ja_desligado_alguma_vez', true)
      .is('ficha_ativa_id', null)
      .not('data_bot_desabilitado', 'is', null)
      .gte('data_bot_desabilitado', ontem.toISOString())
      .order('data_bot_desabilitado', { ascending: false });

    if (error) {
      console.error('Erro ao buscar clientes sem ficha:', error);
      return;
    }

    const filtered = (data || []).filter(c => !dismissed.has(c.telefone));
    
    if (filtered.length > previousCountRef.current && previousCountRef.current >= 0) {
      audioRef.current?.play().catch(() => {});
    }
    previousCountRef.current = filtered.length;
    setAlerts(filtered);
  };

  const handleSelect = async (alert: ClienteSemFicha) => {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefone', alert.telefone)
      .maybeSingle();

    if (cliente) {
      onSelectCliente(cliente);
      setPopoverOpen(false);
    }
  };

  const handleDismiss = (telefone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(prev => new Set(prev).add(telefone));
    setAlerts(prev => prev.filter(a => a.telefone !== telefone));
  };

  const visibleCount = alerts.length;

  if (visibleCount === 0) return null;

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative border-orange-300 text-orange-600 hover:bg-orange-50">
          <AlertTriangle className="h-4 w-4 mr-1" />
          <span className="hidden md:inline">Bot sem Ficha</span>
          <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-xs bg-orange-500">
            {visibleCount}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b bg-orange-50">
          <p className="font-medium text-sm text-orange-800">⚠️ Bot desligou sem criar ficha</p>
          <p className="text-xs text-orange-600 mt-1">Clientes que precisam de atenção manual</p>
        </div>
        <ScrollArea className="max-h-64">
          {alerts.map((alert) => (
            <div
              key={alert.telefone}
              className="p-3 border-b hover:bg-muted/50 cursor-pointer flex items-center justify-between"
              onClick={() => handleSelect(alert)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{alert.nome}</p>
                <p className="text-xs text-muted-foreground">{alert.telefone}</p>
                {alert.data_bot_desabilitado && (
                  <p className="text-xs text-orange-600">
                    Bot desligou {formatDistanceToNow(new Date(alert.data_bot_desabilitado), { addSuffix: true, locale: ptBR })}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground shrink-0"
                onClick={(e) => handleDismiss(alert.telefone, e)}
              >
                Dispensar
              </Button>
            </div>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
