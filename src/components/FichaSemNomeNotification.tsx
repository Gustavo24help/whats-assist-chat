import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface FichaSemNome {
  id: string;
  nome_ficha: string | null;
  telefone_cliente: string | null;
  nome_cliente: string | null;
  status: string | null;
  created_at: string;
}

const DISMISS_KEY = "ficha_sem_nome_dismissed_v1";

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as Array<[string, number]>;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return new Set(arr.filter(([, t]) => t >= cutoff).map(([id]) => id));
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  const arr = Array.from(set).map((id) => [id, Date.now()] as [string, number]);
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(arr)); } catch {}
}

export function FichaSemNomeNotification() {
  const [alerts, setAlerts] = useState<FichaSemNome[]>([]);
  const [open, setOpen] = useState(false);
  const dismissedRef = useRef<Set<string>>(loadDismissed());
  const previousCountRef = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFichas();
    const interval = setInterval(fetchFichas, 60000);
    const channel = supabase
      .channel("fichas-sem-nome-monitor")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fichas_de_servico" },
        () => fetchFichas()
      )
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFichas = async () => {
    const { data, error } = await supabase.rpc("fichas_sem_nome_cliente_recentes");
    if (error) {
      console.error("[FichaSemNomeNotification] erro:", error);
      return;
    }
    const filtered = ((data as FichaSemNome[]) || []).filter((f) => !dismissedRef.current.has(f.id));
    if (filtered.length > previousCountRef.current && previousCountRef.current >= 0 && filtered.length > 0) {
      toast.warning(`${filtered.length} ficha(s) sem nome de cliente — risco de falha no Zoho/Make`);
    }
    previousCountRef.current = filtered.length;
    setAlerts(filtered);
  };

  const handleSelect = (f: FichaSemNome) => {
    setOpen(false);
    navigate(`/fichas/${f.id}`);
  };

  const handleDismiss = (f: FichaSemNome, e: React.MouseEvent) => {
    e.stopPropagation();
    dismissedRef.current.add(f.id);
    saveDismissed(dismissedRef.current);
    setAlerts((prev) => prev.filter((a) => a.id !== f.id));
  };

  if (alerts.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative border-red-300 text-red-600 hover:bg-red-50">
          <UserX className="h-4 w-4 mr-1" />
          <span className="hidden md:inline">Ficha sem Nome</span>
          <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-xs">
            {alerts.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b bg-red-50">
          <p className="font-medium text-sm text-red-800">⚠️ Fichas sem nome do cliente</p>
          <p className="text-xs text-red-600 mt-1">Preencha o nome para evitar falha no envio ao Zoho/CRM</p>
        </div>
        <ScrollArea className="max-h-64">
          {alerts.map((f) => (
            <div
              key={f.id}
              className="p-3 border-b hover:bg-muted/50 cursor-pointer flex items-center justify-between"
              onClick={() => handleSelect(f)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{f.nome_ficha || f.id}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {f.telefone_cliente || "sem telefone"} · {f.status || "sem status"}
                </p>
                <p className="text-xs text-red-600">
                  Criada {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground shrink-0"
                onClick={(e) => handleDismiss(f, e)}
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
