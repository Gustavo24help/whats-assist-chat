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

const DISMISS_STORAGE_KEY = "bot_sem_ficha_dismissed_v1";

// Carrega dispensados do localStorage, removendo os expirados (>24h)
function loadDismissed(): Map<string, string> {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, string>;
    const map = new Map<string, string>();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [tel, iso] of Object.entries(parsed)) {
      if (new Date(iso).getTime() >= cutoff) map.set(tel, iso);
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveDismissed(map: Map<string, string>) {
  const obj: Record<string, string> = {};
  map.forEach((v, k) => { obj[k] = v; });
  try { localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(obj)); } catch {}
}

export function BotSemFichaNotification({ onSelectCliente }: BotSemFichaNotificationProps) {
  const [alerts, setAlerts] = useState<ClienteSemFicha[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  // Map<telefone, data_bot_desabilitado_iso> — persistente, TTL 24h
  const dismissedRef = useRef<Map<string, string>>(loadDismissed());
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

    // Limpa entradas expiradas do dispensados antes de filtrar
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let mutated = false;
    dismissedRef.current.forEach((iso, tel) => {
      if (new Date(iso).getTime() < cutoff) {
        dismissedRef.current.delete(tel);
        mutated = true;
      }
    });
    if (mutated) saveDismissed(dismissedRef.current);

    // Filtra: dispensa se já está em dismissedRef E o data_bot_desabilitado não mudou.
    // Se o bot foi desligado de novo (timestamp mais novo), o alerta volta — comportamento esperado.
    const filtered = (data || []).filter(c => {
      const dismissedAt = dismissedRef.current.get(c.telefone);
      if (!dismissedAt) return true;
      // Se o evento atual é mais recente que o que foi dispensado → mostra de novo
      return new Date(c.data_bot_desabilitado).getTime() > new Date(dismissedAt).getTime();
    });

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

  const handleDismiss = (alert: ClienteSemFicha, e: React.MouseEvent) => {
    e.stopPropagation();
    // Persiste o dispensar com o timestamp do evento de desligamento atual.
    // Assim, novas execuções do fetch não trazem este registro de volta.
    dismissedRef.current.set(alert.telefone, alert.data_bot_desabilitado);
    saveDismissed(dismissedRef.current);
    setAlerts(prev => prev.filter(a => a.telefone !== alert.telefone));
    previousCountRef.current = Math.max(0, previousCountRef.current - 1);
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
                onClick={(e) => handleDismiss(alert, e)}
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
