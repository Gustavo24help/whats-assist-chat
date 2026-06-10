// FseLeadNotification — popup de lead de landing page (FSE)
// Lê `notificacoes` (tipo='fse_lead', não lidas, do usuário logado).
// "Dispensar" marca lida=true. referencia_id = id da ficha FSE → clicar abre a conversa.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FseAlert {
  id: string;
  referencia_id: string | null; // id da ficha FSE
  titulo: string;
  descricao: string | null;
  created_at: string;
}

interface FseLeadNotificationProps {
  onSelectCliente: (cliente: any) => void;
}

export function FseLeadNotification({ onSelectCliente }: FseLeadNotificationProps) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const audioRef = useRef(null);
  const previousCountRef = useRef(0);

  useEffect(() => {
    if (!user?.id) {
      setAlerts([]);
      return;
    }

    audioRef.current = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
    fetchAlerts();

    const channel = supabase
      .channel(`fse-lead-monitor-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes" },
        (payload) => {
          const n = payload.new as any;
          if (n.tipo === "fse_lead" && n.usuario_destino === user.id && !n.lida) {
            setAlerts((prev) => {
              if (prev.some((a) => a.id === n.id)) return prev;
              audioRef.current?.play().catch(() => {});
              return [n as FseAlert, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchAlerts = async () => {
    if (!user?.id) return;
    const ontem = new Date();
    ontem.setHours(ontem.getHours() - 24);

    const db = supabase as any;
    const { data, error } = await db
      .from("notificacoes")
      .select("id, referencia_id, titulo, descricao, created_at")
      .eq("tipo", "fse_lead")
      .eq("usuario_destino", user.id)
      .eq("lida", false)
      .gte("created_at", ontem.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar leads FSE:", error);
      return;
    }

    const rows = (data ?? []) as FseAlert[];
    if (rows.length > previousCountRef.current) {
      audioRef.current?.play().catch(() => {});
    }
    previousCountRef.current = rows.length;
    setAlerts(rows);
  };

  const handleSelect = async (alert: FseAlert) => {
    if (!alert.referencia_id) return;

    const { data: ficha } = await supabase
      .from("fichas_de_servico")
      .select("telefone_cliente")
      .eq("id", alert.referencia_id)
      .maybeSingle();

    if (ficha?.telefone_cliente) {
      const { data: cliente } = await supabase
        .from("clientes")
        .select("*")
        .eq("telefone", ficha.telefone_cliente)
        .maybeSingle();

      if (cliente) {
        onSelectCliente(cliente);
        setPopoverOpen(false);
        await markAsRead(alert);
      }
    }
  };

  const markAsRead = async (alert: FseAlert) => {
    const db = supabase as any;
    await db.from("notificacoes").update({ lida: true }).eq("id", alert.id);
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    previousCountRef.current = Math.max(0, previousCountRef.current - 1);
  };

  const handleDismiss = (alert: FseAlert, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead(alert);
  };

  if (alerts.length === 0) return null;

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative border-orange-300 text-orange-600 hover:bg-orange-50">
          <Flame className="h-4 w-4 mr-1" />
          <span className="hidden md:inline">Lead do Site</span>
          <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-xs">
            {alerts.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b bg-orange-50">
          <p className="font-medium text-sm text-orange-800">
            🔥 Lead de landing page (FSE)
          </p>
          <p className="text-xs text-orange-600 mt-1">
            Bot desligado — o cliente está esperando um operador AGORA
          </p>
        </div>
        <ScrollArea className="max-h-64">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="p-3 border-b hover:bg-muted/50 cursor-pointer flex items-center justify-between"
              onClick={() => handleSelect(alert)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{alert.referencia_id}</p>
                {alert.descricao && (
                  <p className="text-xs text-muted-foreground truncate">{alert.descricao}</p>
                )}
                <p className="text-xs text-orange-600">
                  {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                </p>
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
