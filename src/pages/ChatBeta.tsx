import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ConversationListBeta as ConversationList } from "@/components/ConversationListBeta";
import { ContactsTab } from "@/components/ContactsTab";
import { ChatWindowBeta as ChatWindow } from "@/components/ChatWindowBeta";
import { FichaPanelBeta as FichaPanel } from "@/components/FichaPanelBeta";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LogOut, Settings, Home, MessageCircle, Users, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { NotificationSystem } from "@/components/NotificationSystem";
import { OrcamentoNotification } from "@/components/OrcamentoNotification";
import { PageLayout } from "@/components/PageLayout";
import { OrcamentosSemFichaNotification } from "@/components/OrcamentosSemFichaNotification";
import { BotSemFichaNotification } from "@/components/BotSemFichaNotification";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOpenInNewTab } from "@/hooks/useOpenInNewTab";

const ChatBeta = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openRoute } = useOpenInNewTab();
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const [botDisabledAcknowledged, setBotDisabledAcknowledged] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"conversas" | "contatos">("conversas");

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

  useEffect(() => {
    const handler = async (e: Event) => {
      const telefone = (e as CustomEvent).detail?.telefone;
      if (!telefone) return;
      const { data: cliente } = await supabase
        .from("clientes")
        .select("*")
        .eq("telefone", telefone)
        .maybeSingle();
      if (cliente) handleSelectCliente(cliente);
    };
    window.addEventListener("select-chat-cliente", handler);
    return () => window.removeEventListener("select-chat-cliente", handler);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  const handleNewMessage = (clienteId: string) => {
    setUnreadMessages(prev => ({ ...prev, [clienteId]: (prev[clienteId] || 0) + 1 }));
  };

  const handleSelectCliente = async (cliente: any) => {
    setSelectedCliente(cliente);
    setUnreadMessages(prev => ({ ...prev, [cliente.telefone]: 0 }));
    if (cliente.bot_habilitado === false) {
      setBotDisabledAcknowledged(prev => new Set(prev).add(cliente.telefone));
      await supabase
        .from('clientes')
        .update({ bot_desativado_notificacao_vista: true })
        .eq('telefone', cliente.telefone);
    }
  };

  const handleBackToEmpty = () => setSelectedCliente(null);

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
      setInfoPanelOpen(true);
    }
  };

  return (
    <PageLayout fullHeight>
      <NotificationSystem
        onNewMessage={handleNewMessage}
        currentClienteId={selectedCliente?.telefone || null}
      />

      {/* ═══ HEADER — estilo Intercom ═══ */}
      <header className="h-11 border-b border-border/60 bg-card flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-7 w-7">
            <Home className="h-3.5 w-3.5" />
          </Button>
          <Logo />
          <span className="text-[10px] font-bold tracking-wider bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded hidden md:inline-block">
            BETA
          </span>
        </div>

        {/* Centro: info do cliente selecionado */}
        <div className="hidden md:block text-center">
          {selectedCliente ? (
            <span className="text-xs font-medium text-foreground">
              {selectedCliente.nome}
              <span className="text-muted-foreground ml-1.5">• {selectedCliente.telefone}</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Selecione uma conversa</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <BotSemFichaNotification onSelectCliente={handleSelectCliente} />
          <OrcamentoNotification onSelectFicha={handleOrcamentoNotification} />
          <OrcamentosSemFichaNotification />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("/settings")}>
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleLogout}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* ═══ MAIN 3-COLUMN LAYOUT — Intercom style ═══ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── LEFT: Conversation List ─── */}
        <div className={cn(
          "border-r border-border/60 bg-card shrink-0 flex flex-col w-full md:w-[280px] lg:w-[300px]",
          selectedCliente && "max-md:hidden"
        )}>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "conversas" | "contatos")} className="h-full flex flex-col">
            <div className="border-b border-border/40 px-2 pt-1 pb-0.5">
              <TabsList className="w-full grid grid-cols-2 h-7 bg-muted/50">
                <TabsTrigger value="conversas" className="gap-1 text-[11px] h-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <MessageCircle className="h-3 w-3" />
                  Conversas
                </TabsTrigger>
                <TabsTrigger value="contatos" className="gap-1 text-[11px] h-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Users className="h-3 w-3" />
                  Contatos
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="conversas" className="flex-1 m-0 overflow-hidden">
              <ConversationList
                selectedClienteTelefone={selectedCliente?.telefone || null}
                onSelectCliente={handleSelectCliente}
                unreadMessages={unreadMessages}
                isCollapsed={false}
                onToggleCollapse={() => {}}
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

        {/* ─── CENTER: Chat Area ─── */}
        {selectedCliente ? (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
            <ChatWindow
              key={selectedCliente.telefone}
              clienteTelefone={selectedCliente.telefone}
              clienteNome={selectedCliente.nome}
              statusConversa={selectedCliente.status_conversa}
              onOpenFicha={() => setInfoPanelOpen(true)}
              onBack={handleBackToEmpty}
              fichaOpen={infoPanelOpen}
              onToggleFicha={() => setInfoPanelOpen(!infoPanelOpen)}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/10">
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-primary/60" />
              </div>
              <p className="text-foreground font-medium mb-1">Nenhuma conversa selecionada</p>
              <p className="text-muted-foreground text-sm">Escolha um contato da lista para começar</p>
            </div>
          </div>
        )}

        {/* ─── RIGHT: Info Panel (Intercom-style inline) ─── */}
        {selectedCliente && infoPanelOpen && (
          <div className="hidden lg:flex w-[380px] xl:w-[420px] border-l border-border/60 bg-card shrink-0 flex-col overflow-hidden">
            <FichaPanel
              key={selectedCliente.telefone}
              clienteTelefone={selectedCliente.telefone}
              clienteNome={selectedCliente.nome}
              onClose={() => setInfoPanelOpen(false)}
            />
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default ChatBeta;
