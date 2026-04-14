import { useState, useEffect, useCallback } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ConversationListBeta as ConversationList } from "@/components/ConversationListBeta";
import { ContactsTab } from "@/components/ContactsTab";
import { ChatWindowBeta as ChatWindow } from "@/components/ChatWindowBeta";
import { FichaPanelBeta as FichaPanel } from "@/components/FichaPanelBeta";
import { ChatBetaFilterSidebar, type StatusCounts } from "@/components/chat-beta/ChatBetaFilterSidebar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LogOut, Settings, Home, MessageCircle, PanelRightOpen, PanelLeftOpen, Bot } from "lucide-react";
import { VendasAssistant } from "@/components/chat-beta/VendasAssistant";
import { toast } from "sonner";
import { NotificationSystem } from "@/components/NotificationSystem";
import { OrcamentoNotification } from "@/components/OrcamentoNotification";
import { PageLayout } from "@/components/PageLayout";
import { BotSemFichaNotification } from "@/components/BotSemFichaNotification";
import { cn } from "@/lib/utils";
import { useOpenInNewTab } from "@/hooks/useOpenInNewTab";

const ChatBeta = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openRoute } = useOpenInNewTab();
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [selectedFichaId, setSelectedFichaId] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const [botDisabledAcknowledged, setBotDisabledAcknowledged] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"conversas" | "contatos">("conversas");

  // ═══ Collapsible columns ═══
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(true);
  const [conversationListOpen, setConversationListOpen] = useState(true);
  const [col4Tab, setCol4Tab] = useState<"ficha" | "coach">("ficha");

  // ═══ Filter state (lifted from ConversationListBeta for sidebar) ═══
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [conversaStatusFilter, setConversaStatusFilter] = useState<"ativas" | "inativas" | "todas">("ativas");
  const [unreadFilter, setUnreadFilter] = useState<"todas" | "lidas" | "nao_lidas">("todas");
  const [ticketView, setTicketView] = useState<"meus" | "todos">("todos");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [conversaFilter, setConversaFilter] = useState<"todas" | "aberta" | "fechada">("todas");
  const [botFilter, setBotFilter] = useState<"todos" | "ativo" | "desativado">("todos");
  const [fichaFilter, setFichaFilter] = useState<"todas" | "com_ficha" | "sem_ficha">("todas");
  const [pagamentoFilter, setPagamentoFilter] = useState<"todos" | "pago" | "nao_pago" | "pendente_finalizado">("todos");
  const [showBotDisabledOnly, setShowBotDisabledOnly] = useState(false);

  // ═══ Operator filter ═══
  const [selectedOperadorId, setSelectedOperadorId] = useState<string | null>(null);
  const [operadores, setOperadores] = useState<Array<{ id: string; nome: string }>>([]);

  // ═══ Status counts from ConversationListBeta ═══
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    byStatus: {},
    unreadCount: 0,
    totalCount: 0,
    ativasCount: 0,
    inativasCount: 0,
  });
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagsWithColors, setTagsWithColors] = useState<Map<string, string>>(new Map());
  const [botDisabledCount, setBotDisabledCount] = useState(0);

  // Fetch operators list
  useEffect(() => {
    const fetchOperadores = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      if (data) {
        setOperadores(data.map(p => ({ id: p.id, nome: p.full_name || 'Sem nome' })));
      }
    };
    fetchOperadores();
  }, []);

  const handleStatusCounts = useCallback((counts: any) => {
    setStatusCounts({
      byStatus: counts.byStatus,
      unreadCount: counts.unreadCount,
      totalCount: counts.totalCount,
      ativasCount: counts.ativasCount,
      inativasCount: counts.inativasCount,
    });
    setAllTags(counts.allTags || []);
    setTagsWithColors(counts.tagsWithColors || new Map());
    setBotDisabledCount(counts.botDisabledCount || 0);
  }, []);

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
    setSelectedFichaId(null); // Reset ficha selection when changing client
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

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleContactCreated = (cliente: any) => {
    // Refresh is handled by realtime subscription in ConversationListBeta
  };

  return (
    <PageLayout fullHeight>
      <NotificationSystem
        onNewMessage={handleNewMessage}
        currentClienteId={selectedCliente?.telefone || null}
      />

      {/* ═══ HEADER ═══ */}
      <header className="h-11 border-b border-border/60 bg-card flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-7 w-7">
            <Home className="h-3.5 w-3.5" />
          </Button>
          <Logo />
          <span className="text-[10px] font-bold tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded hidden md:inline-block">
            BETA
          </span>
        </div>

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
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("/settings")}>
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleLogout}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* ═══ MAIN 4-COLUMN LAYOUT ═══ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── COL 1: Filter Sidebar (collapsible) ─── */}
        <ChatBetaFilterSidebar
          isCollapsed={!filterSidebarOpen}
          onToggleCollapse={() => setFilterSidebarOpen(!filterSidebarOpen)}
          counts={statusCounts}
          conversaStatusFilter={conversaStatusFilter}
          onConversaStatusFilterChange={setConversaStatusFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          conversaFilter={conversaFilter}
          onConversaFilterChange={setConversaFilter}
          botFilter={botFilter}
          onBotFilterChange={setBotFilter}
          fichaFilter={fichaFilter}
          onFichaFilterChange={setFichaFilter}
          pagamentoFilter={pagamentoFilter}
          onPagamentoFilterChange={setPagamentoFilter}
          allTags={allTags}
          selectedTags={selectedTags}
          onToggleTag={toggleTag}
          onClearTags={() => setSelectedTags([])}
          tagsWithColors={tagsWithColors}
          botDisabledCount={botDisabledCount}
          showBotDisabledOnly={showBotDisabledOnly}
          onToggleBotDisabled={() => setShowBotDisabledOnly(!showBotDisabledOnly)}
          operadores={operadores}
          selectedOperadorId={selectedOperadorId}
          onSelectedOperadorChange={setSelectedOperadorId}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          onContactCreated={handleContactCreated}
        />

        {/* ─── COL 2: Conversation List (collapsible) ─── */}
        {conversationListOpen ? (
          <div className={cn(
            "border-r border-border/60 bg-card shrink-0 flex flex-col w-full md:w-[280px] lg:w-[300px]",
            selectedCliente && "max-md:hidden"
          )}>
            {activeTab === "conversas" ? (
              <ConversationList
                selectedClienteTelefone={selectedCliente?.telefone || null}
                onSelectCliente={handleSelectCliente}
                unreadMessages={unreadMessages}
                isCollapsed={false}
                onToggleCollapse={() => setConversationListOpen(false)}
                botDisabledAcknowledged={botDisabledAcknowledged}
                hideFilters
                externalStatusFilter={statusFilter}
                externalConversaStatusFilter={conversaStatusFilter}
                onConversaStatusFilterChange={setConversaStatusFilter}
                externalUnreadFilter={unreadFilter}
                onUnreadFilterChange={setUnreadFilter}
                unreadCount={statusCounts.unreadCount}
                externalSelectedTags={selectedTags}
                externalTicketView={ticketView}
                externalConversaFilter={conversaFilter}
                externalBotFilter={botFilter}
                externalFichaFilter={fichaFilter}
                externalPagamentoFilter={pagamentoFilter}
                externalShowBotDisabledOnly={showBotDisabledOnly}
                externalSelectedOperadorId={selectedOperadorId}
                onStatusCounts={handleStatusCounts}
              />
            ) : (
              <ContactsTab
                selectedClienteTelefone={selectedCliente?.telefone || null}
                onSelectCliente={handleSelectCliente}
              />
            )}
          </div>
        ) : (
          <div className="border-r border-border/60 bg-card shrink-0 flex flex-col items-center py-2 w-10">
            <Button variant="ghost" size="icon" onClick={() => setConversationListOpen(true)} className="h-7 w-7">
              <PanelLeftOpen className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] text-muted-foreground mt-2 [writing-mode:vertical-lr]">Conversas</span>
          </div>
        )}

        {/* ─── COL 3: Chat Area ─── */}
        {selectedCliente ? (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
            <ChatWindow
              key={selectedCliente.telefone}
              clienteTelefone={selectedCliente.telefone}
              clienteNome={selectedCliente.nome}
              statusConversa={selectedCliente.status_conversa}
              onOpenFicha={() => setInfoPanelOpen(true)}
              onBack={handleBackToEmpty}
              fichaOpen={true}
              fichaFilterId={selectedFichaId}
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

        {/* ─── COL 4: Info Panel ─── */}
        {selectedCliente && (
          <div className="hidden lg:flex w-[380px] xl:w-[420px] border-l border-border/60 bg-card shrink-0 flex-col overflow-hidden">
            <FichaPanel
              key={selectedCliente.telefone}
              clienteTelefone={selectedCliente.telefone}
              clienteNome={selectedCliente.nome}
              onFichaChange={setSelectedFichaId}
            />
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default ChatBeta;
