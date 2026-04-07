import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { X, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PopupData {
  id: string;
  titulo: string;
  urgencia: string;
  criadorNome: string;
}

export const TarefaOpPopupOverlay = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [popups, setPopups] = useState<PopupData[]>([]);
  const shownIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // Listen for new task assignments
    const channel = supabase
      .channel("tarefa-op-atribuidos-popup")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "tarefas_operacionais_atribuidos",
      }, async (payload: any) => {
        const row = payload.new;
        if (row.user_id !== user.id) return;
        if (shownIds.current.has(row.tarefa_id)) return;
        shownIds.current.add(row.tarefa_id);

        // Get tarefa info
        const { data: tarefa } = await (supabase as any)
          .from("tarefas_operacionais")
          .select("titulo, urgencia, criado_por")
          .eq("id", row.tarefa_id)
          .single();

        if (!tarefa) return;

        let criadorNome = "Alguém";
        if (tarefa.criado_por) {
          const { data: profile } = await (supabase as any)
            .from("profiles")
            .select("full_name")
            .eq("id", tarefa.criado_por)
            .single();
          criadorNome = profile?.full_name || "Alguém";
        }

        const id = `${row.tarefa_id}-${Date.now()}`;
        setPopups(prev => [...prev, {
          id,
          titulo: tarefa.titulo,
          urgencia: tarefa.urgencia,
          criadorNome,
        }]);

        setTimeout(() => {
          setPopups(prev => prev.filter(p => p.id !== id));
        }, 15000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const dismiss = (id: string) => {
    setPopups(prev => prev.filter(p => p.id !== id));
  };

  if (popups.length === 0) return null;

  const urgenciaLabel: Record<string, string> = {
    baixa: "🟢 Baixa",
    media: "🔵 Média",
    alta: "🟠 Alta",
    critica: "🔴 Crítica",
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {popups.map(popup => (
        <div
          key={popup.id}
          className="bg-background border border-orange-300 rounded-lg shadow-lg p-4 animate-in slide-in-from-right-5 fade-in duration-300"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ListTodo className="h-5 w-5 text-orange-500 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm">Nova tarefa atribuída</p>
                <p className="text-xs text-muted-foreground truncate">{popup.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {urgenciaLabel[popup.urgencia] || popup.urgencia} • Por: {popup.criadorNome}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => dismiss(popup.id)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" className="mt-2 w-full" onClick={() => { dismiss(popup.id); navigate("/tarefas-operacionais"); }}>
            Ver tarefas
          </Button>
        </div>
      ))}
    </div>
  );
};
