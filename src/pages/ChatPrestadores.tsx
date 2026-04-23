import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ConversationListPrestadores } from "@/components/prestador-chat/ConversationListPrestadores";
import { ChatWindowPrestadores } from "@/components/prestador-chat/ChatWindowPrestadores";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LogOut, Settings, Home, Wrench } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOpenInNewTab } from "@/hooks/useOpenInNewTab";
import { PageLayout } from "@/components/PageLayout";

const ChatPrestadores = () => {
  const navigate = useNavigate();
  const { getLinkHandlers } = useOpenInNewTab();
  const [selectedPrestador, setSelectedPrestador] = useState<any>(null);

  // Auth is handled by ProtectedRoute — no local session check needed

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  return (
    <PageLayout fullHeight>
      <header className="h-14 border-b bg-background flex items-center justify-between px-4 md:px-6 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} title="Voltar ao início" className="mr-2">
            <Home className="h-5 w-5" />
          </Button>
          <Logo />
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Chat Prestadores</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => openRoute("/chat")}>
              Chat Clientes
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openRoute("/dashboard")}>
              Dashboard
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
            <Settings className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Configurações</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Sair</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden bg-muted/30">
        <div className={cn(
          "border-r bg-background shadow-sm shrink-0 transition-all duration-300 w-full md:w-80 lg:w-96",
          selectedPrestador && "max-md:hidden"
        )}>
          <ConversationListPrestadores
            selectedTelefone={selectedPrestador?.telefone || null}
            onSelectPrestador={setSelectedPrestador}
          />
        </div>

        {selectedPrestador ? (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <ChatWindowPrestadores
              key={selectedPrestador.telefone}
              prestadorTelefone={selectedPrestador.telefone}
              prestadorNome={selectedPrestador.nome}
              prestadorCpf={selectedPrestador.cpf}
              onBack={() => setSelectedPrestador(null)}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/20">
            <div className="text-center p-8">
              <Wrench className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg mb-2">Chat com Prestadores</p>
              <p className="text-muted-foreground text-sm">Selecione um prestador da lista para conversar</p>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default ChatPrestadores;
