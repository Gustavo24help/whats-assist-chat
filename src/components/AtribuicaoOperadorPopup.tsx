import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { X, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PopupData {
  id: string;
  clienteNome: string;
  clienteTelefone: string;
}

export const AtribuicaoOperadorPopup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [popups, setPopups] = useState<PopupData[]>([]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("atribuicao-operador-popup")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "clientes",
      }, (payload: any) => {
        const newRow = payload.new;
        const oldRow = payload.old;

        // Only trigger when atendente_id changes TO the current user
        if (newRow.atendente_id === user.id && oldRow.atendente_id !== user.id) {
          const id = `${newRow.telefone}-${Date.now()}`;
          setPopups(prev => [...prev, {
            id,
            clienteNome: newRow.nome || "Cliente",
            clienteTelefone: newRow.telefone,
          }]);

          // Auto-dismiss after 15 seconds
          setTimeout(() => {
            setPopups(prev => prev.filter(p => p.id !== id));
          }, 15000);
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
    navigate("/chat");
  };

  if (popups.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {popups.map(popup => (
        <div
          key={popup.id}
          className="bg-background border border-primary/30 rounded-lg shadow-lg p-4 animate-in slide-in-from-right-5 fade-in duration-300"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm">Conversa atribuída</p>
                <p className="text-xs text-muted-foreground truncate">
                  Você foi atribuído à conversa de {popup.clienteNome}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => dismiss(popup.id)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" className="mt-2 w-full" onClick={() => goToChat(popup)}>
            Ir para conversa
          </Button>
        </div>
      ))}
    </div>
  );
};
