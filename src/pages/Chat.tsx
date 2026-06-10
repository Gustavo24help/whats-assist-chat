import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ConversationList } from "@/components/ConversationList";
import { ContactsTab } from "@/components/ContactsTab";
import { ChatWindow } from "@/components/ChatWindow";
import { FichaPanel } from "@/components/FichaPanel";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LogOut, Settings, PanelLeftOpen, Home, MessageCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { NotificationSystem } from "@/components/NotificationSystem";
import { OrcamentoNotification } from "@/components/OrcamentoNotification";
import { PageLayout } from "@/components/PageLayout";
import { OrcamentosSemFichaNotification } from "@/components/OrcamentosSemFichaNotification";
import { BotSemFichaNotification } from "@/components/BotSemFichaNotification";
import { FichaSemNomeNotification } from "@/components/FichaSemNomeNotification";
import { FseLeadNotification } from "@/components/FseLeadNotification";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOpenInNewTab } from "@/hooks/useOpenInNewTab";

const Chat = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openRoute } = useOpenInNewTab();
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [botDisabledAcknowledged, setBotDisabledAcknowledged] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"conversas" | "contatos">("conversas");

  // Auto-select client from URL param
  useEffect(() => {
    const telefone = searchParams.get("telefone");
    if (!telefone || selectedCliente?.telefone === telefone) return;

    const loadCliente = async () => {
      const { data: cliente } = await supabase
        .from("clientes")
        .select("*")
        .eq("telefone", telefone)
        .maybeSingle();

      if (cliente) {
        handleSelectCliente(cliente);
        setSearchParams({}, { replace: true });
      }
    };
    loadCliente();
  }, [searchParams]);

  // Listen for custom event when already on chat page
  useEffect(() => {
    const handler = async (e: Event) => {
      const telefone = (e as CustomEvent).detail?.telefone;
      if (!telefone) return;
      const { data: cliente } = await supabase
        .from("clientes")
        .select("*")
        .eq("telefone", telefone)
        .maybeSingle();
      if (cliente) {
        handleSelectCliente(cliente);
      }
    };
    window.addEventListener("select-chat-cliente", handler);
    return () => window.removeEventListener("select-chat-cliente", handler);
  }, []);

  // Auth is handled by ProtectedRoute — no local session check needed

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  const handleSelectCliente = async (cliente: any) => {
    setSelectedCliente(cliente);
    
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

  const handleBackToEmpty = () => {
    setSelectedCliente(null);
    setFichaOpen(false);
  };

  const handleOrcamentoNotification = async (fichaId: string) => {
    const { data: ficha } = await supabase
      .from('fichas_de_servico')
      .select('telefone_cliente')
      .eq('id', fichaId)
      .maybeSingle();

    if (!ficha?.telefone_cliente) return;

    const { data: cliente } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefone', ficha.telefone_cliente)
      .maybeSingle();

    if (cliente) {
      await handleSelectCliente(cliente);
      setFichaOpen(true);
    }
  };

  return (
    <PageLayout fullHeight>
      <NotificationSystem 
        onNewMessage={() => {}}
        currentClienteId={selectedCliente?.telefone || null}
      />
      
      <header className="h-14 border-b bg-background flex items-center justify-between px-4 md:px-6 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            title="Voltar ao início"
            className="mr-2"
          >
            <Home className="h-5 w-5" />
          </Button>
          <Logo />
          <div className="flex gap-2">
            <Button 
              variant="default"
              size="sm" 
            >
              Conversas
            </Button>
            <Button 
              variant="ghost"
              size="sm" 
              onClick={() => openRoute("/analise-servicos")}
            >
              Análise de Serviços
            </Button>
            <Button 
              variant="ghost"
              size="sm" 
              onClick={() => openRoute("/dashboard")}
            >
              Dashboard
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <FseLeadNotification onSelectCliente={handleSelectCliente} />
          <BotSemFichaNotification onSelectCliente={handleSelectCliente} />
          <FichaSemNomeNotification />
          <OrcamentoNotification onSelectFicha={handleOrcamentoNotification} />
          <OrcamentosSemFichaNotification />
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
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "conversas" | "contatos")} className="h-full flex flex-col">
              <div className="border-b px-2 pt-2">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="conversas" className="gap-1.5">
                    <MessageCircle className="h-4 w-4" />
                    Conversas
                  </TabsTrigger>
                  <TabsTrigger value="contatos" className="gap-1.5">
                    <Users className="h-4 w-4" />
                    Contatos
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="conversas" className="flex-1 m-0 overflow-hidden">
                <ConversationList
                  selectedClienteTelefone={selectedCliente?.telefone || null}
                  onSelectCliente={handleSelectCliente}
                  isCollapsed={sidebarCollapsed}
                  onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                  botDisabledAcknowledged={botDisabledAcknowledged}
                />
              </TabsContent>
              <TabsContent value="contatos" className="flex-1 m-0 overflow-hidden">
                <ContactsTab
                  selectedClienteTelefone={selectedCliente?.telefone || null}
                  onSelectCliente={handleSelectCliente}
                />
              </TabsContent>
            </Tabs>
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
                key={selectedCliente.telefone}
                clienteTelefone={selectedCliente.telefone}
                clienteNome={selectedCliente.nome}
                statusConversa={selectedCliente.status_conversa}
                onOpenFicha={() => setFichaOpen(true)}
                onBack={handleBackToEmpty}
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
                key={selectedCliente.telefone}
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
    </PageLayout>
  );
};

export default Chat;
