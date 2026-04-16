import { useEffect, useRef, useState } from "react";
import { UserPlus, X, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

type AtribuicaoNotification = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  referencia_id: string | null;
};

export const AtribuicaoOperadorPopup = () => {
  const { user } = useAuth();
  const [popup, setPopup] = useState<AtribuicaoNotification | null>(null);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<AtribuicaoNotification[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZRQ0PVKbn9adgGAg+ltz0yHYpBSh+zPDglEILEliy6OyrWBUIQ5zj8r1rIgYuhM/z1YU1Bhxqvu7mnEcODlOm5/WnXxgIPpTc9Md0KAUpf8vw4JRCCBJV");
  }, []);

  useEffect(() => {
    if (!popup && queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      setTimeout(() => setPopup(next), 300);
    }
  }, [popup]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`atribuicao-popup-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes" },
        (payload) => {
          const notif = payload.new as AtribuicaoNotification & {
            usuario_destino?: string;
            lida?: boolean;
          };

          if (!notif?.id || shownIdsRef.current.has(notif.id)) return;
          if (notif.usuario_destino !== user.id) return;
          if (notif.lida) return;
          if (notif.tipo !== "chat_atribuido") return;

          shownIdsRef.current.add(notif.id);

          if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }

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

  const handleOpenTarefas = () => {
    window.open("/tarefas-operacionais", "_blank");
    setPopup(null);
  };

  if (!popup) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] animate-in slide-in-from-right-full fade-in duration-500">
      <div className="w-[380px] rounded-xl border-2 border-orange-500 bg-background shadow-2xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/15">
              <UserPlus className="h-5 w-5 text-orange-500" />
            </div>
            <p className="font-bold text-base text-orange-600 dark:text-orange-400">
              {popup.titulo}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={() => setPopup(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {popup.descricao && (
          <p className="text-sm text-foreground leading-snug">{popup.descricao}</p>
        )}

        <Button
          variant="default"
          size="sm"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          onClick={handleOpenTarefas}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Ver Tarefas Operacionais
        </Button>
      </div>
    </div>
  );
};
