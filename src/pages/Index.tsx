import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ConversationList } from "@/components/ConversationList";
import { ChatWindow } from "@/components/ChatWindow";
import { FichaPanel } from "@/components/FichaPanel";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LogOut, Settings, PanelLeftOpen } from "lucide-react";
import { toast } from "sonner";
import { NotificationSystem } from "@/components/NotificationSystem";
import { cn } from "@/lib/utils";

const Index = () => {
  const navigate = useNavigate();
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [botDisabledAcknowledged, setBotDisabledAcknowledged] = useState<Set<string>>(new Set());

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

  const handleNewMessage = (clienteId: string) => {
    setUnreadMessages(prev => ({
      ...prev,
      [clienteId]: (prev[clienteId] || 0) + 1
    }));
  };

  const handleSelectCliente = async (cliente: any) => {
    setSelectedCliente(cliente);
    // Clear unread count when opening conversation
    setUnreadMessages(prev => ({
      ...prev,
      [cliente.telefone]: 0
    }));
    
    // Mark bot disabled notification as seen in database when opening conversation
    if (cliente.bot_habilitado === false) {
      setBotDisabledAcknowledged(prev => new Set(prev).add(cliente.telefone));
      
      // Update database to mark notification as seen
      const { error } = await supabase
        .from('clientes')
        .update({ bot_desativado_notificacao_vista: true })
        .eq('telefone', cliente.telefone);
      
      if (error) {
        console.error('Erro ao marcar notificação como vista:', error);
      }
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <NotificationSystem 
        onNewMessage={handleNewMessage}
        currentClienteId={selectedCliente?.telefone || null}
      />
      
      <header className="h-14 border-b bg-background flex items-center justify-between px-4 md:px-6 shadow-sm shrink-0">
        <Logo />
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

      <div className="flex-1 flex overflow-hidden bg-muted/30 relative">
        {!sidebarCollapsed && (
          <div className={cn(
            "border-r bg-background shadow-sm shrink-0 transition-all duration-300 w-full md:w-80 lg:w-96",
            selectedCliente && "max-md:hidden"
          )}>
            <ConversationList
              selectedClienteTelefone={selectedCliente?.telefone || null}
              onSelectCliente={handleSelectCliente}
              unreadMessages={unreadMessages}
              isCollapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              botDisabledAcknowledged={botDisabledAcknowledged}
            />
          </div>
        )}

        {sidebarCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(false)}
            className="absolute top-4 left-4 z-50 bg-background border shadow-md hover:bg-accent"
            title="Expandir menu"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </Button>
        )}

        {selectedCliente ? (
          <div className="flex-1 flex overflow-hidden min-w-0 relative">
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <ChatWindow
                clienteTelefone={selectedCliente.telefone}
                clienteNome={selectedCliente.nome}
                statusConversa={selectedCliente.status_conversa}
                onOpenFicha={() => setFichaOpen(true)}
                onBack={() => setSelectedCliente(null)}
                fichaOpen={fichaOpen}
                onToggleFicha={() => setFichaOpen(!fichaOpen)}
              />
            </div>

      {fichaOpen && (
        <div 
          className="fixed inset-0 top-14 bg-black/5 z-30 transition-opacity duration-300 pointer-events-none"
        />
      )}

      <div className={cn(
        "fixed right-0 top-14 bottom-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-l shadow-2xl transition-all duration-300 ease-in-out z-40 rounded-l-2xl",
        "w-full lg:w-[420px] xl:w-[480px]",
        fichaOpen ? "translate-x-0" : "translate-x-full"
      )}>
              <FichaPanel
                clienteTelefone={selectedCliente.telefone}
                clienteNome={selectedCliente.nome}
                onClose={() => setFichaOpen(false)}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/20">
            <div className="text-center p-8">
              <p className="text-muted-foreground text-lg mb-2">Selecione uma conversa</p>
              <p className="text-muted-foreground text-sm">Escolha um contato da lista para começar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
