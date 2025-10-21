import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ConversationList } from "@/components/ConversationList";
import { ChatWindow } from "@/components/ChatWindow";
import { FichaPanel } from "@/components/FichaPanel";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [fichaOpen, setFichaOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-14 border-b bg-card flex items-center justify-between px-4">
        <h1 className="text-lg font-semibold">Central de Atendimento WhatsApp</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80">
          <ConversationList
            selectedClienteTelefone={selectedCliente?.telefone || null}
            onSelectCliente={setSelectedCliente}
          />
        </div>

        {selectedCliente ? (
          <>
            <div className={fichaOpen ? "flex-1" : "flex-1"}>
              <ChatWindow
                clienteTelefone={selectedCliente.telefone}
                clienteNome={selectedCliente.nome}
                statusConversa={selectedCliente.status_conversa}
                onOpenFicha={() => setFichaOpen(true)}
              />
            </div>

            {fichaOpen && (
              <div className="w-96">
                <FichaPanel
                  clienteTelefone={selectedCliente.telefone}
                  clienteNome={selectedCliente.nome}
                  onClose={() => setFichaOpen(false)}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/20">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-muted-foreground mb-2">
                Selecione uma conversa
              </h2>
              <p className="text-muted-foreground">
                Escolha um cliente na lista para começar o atendimento
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
