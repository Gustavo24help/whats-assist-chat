import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { X, UserCheck, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PopupData {
  id: string;
  clienteNome: string;
  clienteTelefone: string;
  descricao?: string;
}

const REDISTRIBUTION_FLAG = "redistribuicao-em-andamento";

export const AtribuicaoOperadorPopup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [popups, setPopups] = useState<PopupData[]>([]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("atribuicao-operador-popup")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "clientes",
      }, async (payload: any) => {
        const newRow = payload.new;
        const oldRow = payload.old;

        if (newRow.atendente_id === user.id && oldRow.atendente_id !== user.id) {
          // Skip self-assignments (sending message, "assumir para mim")
          if ((window as any).__selfAssignmentInProgress) return;
          // Skip if redistribution is in progress (bulk reassignment)
          try {
            if (localStorage.getItem(REDISTRIBUTION_FLAG) === "true") return;
          } catch {}

          // Dedup: skip if there's already a popup for this phone
          setPopups(prev => {
            if (prev.some(p => p.clienteTelefone === newRow.telefone)) return prev;

            // We need to fetch description async, so we add first then update
            const id = `${newRow.telefone}-${Date.now()}`;
            const newPopup: PopupData = {
              id,
              clienteNome: newRow.nome || "Cliente",
              clienteTelefone: newRow.telefone,
            };

            // Fetch description in background
            (async () => {
              try {
                const { data: tarefa } = await (supabase as any)
                  .from("tarefas_operacionais")
                  .select("descricao")
                  .eq("cliente_telefone", newRow.telefone)
                  .eq("tipo", "atribuicao_chat")
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                if (tarefa?.descricao) {
                  setPopups(p => p.map(pp =>
                    pp.id === id ? { ...pp, descricao: tarefa.descricao } : pp
                  ));
                }
              } catch {}
            })();

            return [...prev, newPopup];
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const dismiss = (id: string) => {
    setPopups(prev => prev.filter(p => p.id !== id));
  };

  const goToChat = (popup: PopupData) => {
    dismiss(popup.id);
    const tel = encodeURIComponent(popup.clienteTelefone);
    if (location.pathname === "/chat") {
      // Already on chat page - use window event to trigger selection
      window.dispatchEvent(new CustomEvent("select-chat-cliente", { detail: { telefone: popup.clienteTelefone } }));
    } else {
      navigate(`/chat?telefone=${tel}`);
    }
  };

  if (popups.length === 0) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-[99]" />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="flex flex-col gap-3 max-w-md w-full">
          {popups.map(popup => (
            <div
              key={popup.id}
              className="bg-background border-2 border-primary rounded-xl shadow-2xl p-6 animate-in zoom-in-95 fade-in duration-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-primary/10 rounded-full p-2.5">
                    <UserCheck className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-base">Conversa atribuída a você</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {popup.clienteNome}
                    </p>
                    {popup.descricao && (
                      <p className="text-sm text-foreground/80 mt-2 bg-muted/50 rounded-md p-2 italic">
                        "{popup.descricao}"
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => dismiss(popup.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="flex-1" onClick={() => dismiss(popup.id)}>
                  Fechar
                </Button>
                <Button className="flex-1 gap-1.5" onClick={() => goToChat(popup)}>
                  <MessageCircle className="h-4 w-4" />
                  Ir para conversa
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
