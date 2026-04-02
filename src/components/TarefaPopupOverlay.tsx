import { useEffect, useRef, useState } from "react";
import { ClipboardList, CheckCircle2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

type TarefaNotification = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  referencia_id: string | null;
};

export const TarefaPopupOverlay = () => {
  const { user } = useAuth();
  const [popup, setPopup] = useState<TarefaNotification | null>(null);
  const [canClose, setCanClose] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<TarefaNotification[]>([]);

  useEffect(() => {
    if (!popup) {
      setCanClose(false);
      // Show next in queue
      if (queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;
        setTimeout(() => setPopup(next), 300);
      }
      return;
    }

    const timer = setTimeout(() => setCanClose(true), 2000);

    const handleOutsideClick = (event: MouseEvent) => {
      if (canClose && popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setPopup(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [popup, canClose]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`tarefa-popup-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes" },
        (payload) => {
          const notif = payload.new as TarefaNotification & { usuario_destino?: string; lida?: boolean };

          if (!notif?.id || shownIdsRef.current.has(notif.id)) return;
          if (notif.usuario_destino !== user.id) return;
          if (notif.lida) return;
          if (notif.tipo !== "tarefa_criada" && notif.tipo !== "tarefa_concluida") return;

          shownIdsRef.current.add(notif.id);

          if (popup) {
            queueRef.current.push(notif);
          } else {
            setPopup(notif);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, popup]);

  if (!popup) return null;

  const isConcluida = popup.tipo === "tarefa_concluida";
  const Icon = isConcluida ? CheckCircle2 : ClipboardList;
  const iconColor = isConcluida ? "text-green-500" : "text-blue-500";
  const borderColor = isConcluida ? "border-green-500" : "border-blue-500";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div
        ref={popupRef}
        className={`w-[90vw] max-w-lg rounded-xl border-2 ${borderColor} bg-background shadow-2xl p-6 space-y-4 animate-in zoom-in-95 fade-in duration-300`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-base font-bold">
            <Icon className={`h-5 w-5 ${iconColor}`} />
            {isConcluida ? "Tarefa Concluída" : "Nova Tarefa"}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={!canClose}
            onClick={() => setPopup(null)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div>
          <p className="font-semibold text-lg leading-tight">{popup.titulo}</p>
          {popup.descricao && (
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{popup.descricao}</p>
          )}
        </div>
        {!canClose && (
          <p className="text-xs text-muted-foreground text-center animate-pulse">Aguarde para fechar...</p>
        )}
      </div>
    </div>
  );
};
