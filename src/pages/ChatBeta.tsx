import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ConversationListBeta } from "@/components/chat-beta/ConversationListBeta";
import { ChatWindowBeta } from "@/components/chat-beta/ChatWindowBeta";
import { FichaPanel } from "@/components/FichaPanel";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Home, Settings, LogOut, PanelRightOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ChatBeta = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedTelefone, setSelectedTelefone] = useState<string | null>(null);
  const [selectedNome, setSelectedNome] = useState<string>("");
  const [fichaOpen, setFichaOpen] = useState(false);

  const handleSelectConversa = async (clienteTelefone: string) => {
    // Buscar nome do cliente
    const { data: cliente } = await supabase
      .from("clientes")
      .select("nome")
      .eq("telefone", clienteTelefone)
      .maybeSingle();

    setSelectedTelefone(clienteTelefone);
    setSelectedNome(cliente?.nome || clienteTelefone.replace("whatsapp:", ""));
    setFichaOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Faça login primeiro</p>
      </div>
    );
  }

  return (
    <PageLayout fullHeight>
      {/* Header */}
      <header className="h-14 border-b bg-background flex items-center justify-between px-4 md:px-6 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} title="Voltar ao início">
            <Home className="h-5 w-5" />
          </Button>
          <Logo />
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm">Chat BETA</Button>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              BETA
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/chat")}>
            Chat Atual
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden bg-muted/30">
        {/* Left: Lista de conversas */}
        <div
          className={cn(
            "border-r bg-background shadow-sm shrink-0 transition-all duration-300 w-full md:w-80 lg:w-96",
            selectedTelefone && "max-md:hidden"
          )}
        >
          <ConversationListBeta
            onSelectConversa={handleSelectConversa}
            conversaSelecionada={selectedTelefone || undefined}
          />
        </div>

        {/* Center: Chat */}
        {selectedTelefone ? (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            {/* Botão abrir ficha */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFichaOpen(!fichaOpen)}
              className="absolute top-3 right-3 z-10"
            >
              <PanelRightOpen className="h-4 w-4 mr-1" />
              Ficha
            </Button>

            <ChatWindowBeta
              key={selectedTelefone}
              clienteTelefone={selectedTelefone}
              clienteNome={selectedNome}
              onBack={() => {
                setSelectedTelefone(null);
                setFichaOpen(false);
              }}
            />

            {/* Ficha Panel overlay */}
            {fichaOpen && (
              <div className="fixed inset-0 top-14 bg-black/5 z-30 pointer-events-none" />
            )}
            <div
              className={cn(
                "fixed right-0 top-14 bottom-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-l shadow-2xl transition-all duration-300 ease-in-out z-40 rounded-l-2xl",
                "w-full lg:w-[420px] xl:w-[480px]",
                fichaOpen ? "translate-x-0" : "translate-x-full"
              )}
            >
              <FichaPanel
                key={selectedTelefone}
                clienteTelefone={selectedTelefone}
                clienteNome={selectedNome}
                onClose={() => setFichaOpen(false)}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/20">
            <div className="text-center p-8">
              <p className="text-muted-foreground text-lg mb-2">Selecione uma conversa</p>
              <p className="text-muted-foreground text-sm">
                Clique em uma conversa à esquerda para começar
              </p>
              <p className="text-xs text-blue-500 mt-4">
                💡 Chat BETA — Skill de Vendas + Não lidos por operador
              </p>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default ChatBeta;
