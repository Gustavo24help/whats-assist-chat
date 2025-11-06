import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationCard } from "./ConversationCard";
import { TagManager } from "./TagManager";
import { FilterDropdown } from "./FilterDropdown";
import { Search, Archive, PanelLeftClose, PanelLeftOpen, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Cliente {
  telefone: string;
  nome: string;
  status_conversa: "aberta" | "fechada";
  ultima_interacao: string;
  tags: string[];
  nome_ficha?: string;
  status_ficha?: string;
  unread_count?: number;
  dentroJanela?: boolean;
  bot_habilitado?: boolean;
  bot_desativado_notificacao_vista?: boolean;
  marcado_nao_lido?: boolean;
}

interface ConversationListProps {
  selectedClienteTelefone: string | null;
  onSelectCliente: (cliente: Cliente) => void;
  unreadMessages: Record<string, number>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  botDisabledAcknowledged?: Set<string>;
}

export const ConversationList = ({ 
  selectedClienteTelefone, 
  onSelectCliente, 
  unreadMessages,
  isCollapsed = false,
  onToggleCollapse,
  botDisabledAcknowledged = new Set()
}: ConversationListProps) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [conversaFilter, setConversaFilter] = useState<"todas" | "aberta" | "fechada">("todas");
  const [unreadFilter, setUnreadFilter] = useState<"todas" | "lidas" | "nao_lidas">("todas");
  const [botFilter, setBotFilter] = useState<"todos" | "ativo" | "desativado">("todos");
  const [fichaFilter, setFichaFilter] = useState<"todas" | "com_ficha" | "sem_ficha">("todas");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [currentTagClient, setCurrentTagClient] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);
  const [showBotDisabledOnly, setShowBotDisabledOnly] = useState(false);

  useEffect(() => {
    fetchClientes();
    
    const channel = supabase
      .channel('clientes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clientes' },
        () => fetchClientes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let filtered = clientes;

    // Filtro de bot desabilitado (tem prioridade)
    if (showBotDisabledOnly) {
      filtered = filtered.filter(c => 
        c.bot_habilitado === false && 
        c.bot_desativado_notificacao_vista === false
      );
    }

    // Filtro por busca de texto
    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.telefone.includes(searchTerm) ||
        (c.nome_ficha && c.nome_ficha.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.tags && c.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
      );
    }

    // Filtro por status da ficha
    if (statusFilter !== "all") {
      filtered = filtered.filter(c => c.status_ficha === statusFilter);
    }

    // Filtro por status da conversa (baseado na janela de 24h)
    if (conversaFilter !== "todas") {
      filtered = filtered.filter(c => {
        if (conversaFilter === "aberta") {
          return c.dentroJanela === true;
        } else {
          return c.dentroJanela === false;
        }
      });
    }

    // Filtro por mensagens não lidas
    if (unreadFilter !== "todas") {
      filtered = filtered.filter(c => {
        const hasUnread = (unreadMessages[c.telefone] || 0) > 0 || c.marcado_nao_lido;
        if (unreadFilter === "nao_lidas") {
          return hasUnread;
        } else {
          return !hasUnread;
        }
      });
    }

    // Filtro por tags selecionadas
    if (selectedTags.length > 0) {
      filtered = filtered.filter(c => 
        c.tags && selectedTags.some(tag => c.tags.includes(tag))
      );
    }

    // Filtro por status do bot
    if (botFilter !== "todos") {
      filtered = filtered.filter(c => {
        if (botFilter === "ativo") {
          return c.bot_habilitado !== false;
        } else {
          return c.bot_habilitado === false;
        }
      });
    }

    // Filtro por ficha vinculada
    if (fichaFilter !== "todas") {
      filtered = filtered.filter(c => {
        if (fichaFilter === "com_ficha") {
          return !!c.nome_ficha;
        } else {
          return !c.nome_ficha;
        }
      });
    }

    setFilteredClientes(filtered);

    // Extrair todas as tags únicas
    const tags = new Set<string>();
    clientes.forEach(c => {
      if (c.tags) {
        c.tags.forEach(tag => tags.add(tag));
      }
    });
    setAllTags(Array.from(tags));
  }, [clientes, searchTerm, statusFilter, conversaFilter, unreadFilter, botFilter, fichaFilter, selectedTags, showBotDisabledOnly]);

  // Auto-limpar filtro de bot desativado quando não houver mais conversas com aviso
  useEffect(() => {
    if (showBotDisabledOnly) {
      const botDisabledCount = clientes.filter(c => 
        c.bot_habilitado === false && 
        c.bot_desativado_notificacao_vista === false
      ).length;
      
      if (botDisabledCount === 0) {
        setShowBotDisabledOnly(false);
      }
    }
  }, [clientes, showBotDisabledOnly]);

  const fetchClientes = async () => {
    // Buscar clientes arquivados para o contador
    const { count } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('arquivado', true);
    
    setArchivedCount(count || 0);

    // Buscar clientes baseado no estado atual (normal ou arquivado)
    const { data: clientesData, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('arquivado', showArchived)
      .order('ultima_interacao', { ascending: false });

    if (!error && clientesData) {
      // Buscar nome e status da ficha ativa de cada cliente
      const clientesComFicha = await Promise.all(
        clientesData.map(async (cliente) => {
          // Buscar última mensagem recebida do cliente para calcular janela
          const { data: ultimaMensagem } = await supabase
            .from('mensagens')
            .select('data_hora')
            .eq('cliente_id', cliente.telefone)
            .eq('remetente', 'cliente')
            .order('data_hora', { ascending: false })
            .limit(1)
            .maybeSingle();

          let dentroJanela = false;
          if (ultimaMensagem?.data_hora) {
            const ultimaMsgTime = new Date(ultimaMensagem.data_hora).getTime();
            const agora = Date.now();
            const diferencaHoras = (agora - ultimaMsgTime) / (1000 * 60 * 60);
            dentroJanela = diferencaHoras < 24;
          }

          // Se há ficha ativa definida, buscar essa ficha
          if (cliente.ficha_ativa_id) {
            const { data: fichaData } = await supabase
              .from('fichas_de_servico')
              .select('nome_ficha, status')
              .eq('id', cliente.ficha_ativa_id)
              .maybeSingle();

          return {
            ...cliente,
            nome_ficha: fichaData?.nome_ficha || undefined,
            status_ficha: fichaData?.status || undefined,
            unread_count: unreadMessages[cliente.telefone] || 0,
            dentroJanela,
            bot_habilitado: cliente.bot_habilitado,
            bot_desativado_notificacao_vista: cliente.bot_desativado_notificacao_vista,
            marcado_nao_lido: cliente.marcado_nao_lido
          };
          }

          // Se não há ficha ativa, buscar a última ficha criada
          const { data: fichaData } = await supabase
            .from('fichas_de_servico')
            .select('nome_ficha, status')
            .eq('telefone_cliente', cliente.telefone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...cliente,
            nome_ficha: fichaData?.nome_ficha || undefined,
            status_ficha: fichaData?.status || undefined,
            unread_count: unreadMessages[cliente.telefone] || 0,
            dentroJanela,
            bot_habilitado: cliente.bot_habilitado,
            bot_desativado_notificacao_vista: cliente.bot_desativado_notificacao_vista,
            marcado_nao_lido: cliente.marcado_nao_lido
          };
        })
      );
      setClientes(clientesComFicha);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const openTagManager = (telefone: string) => {
    setCurrentTagClient(telefone);
    setTagManagerOpen(true);
  };

  const archiveContact = async (telefone: string) => {
    const { error } = await supabase
      .from('clientes')
      .update({ arquivado: true })
      .eq('telefone', telefone);

    if (error) {
      toast.error("Erro ao arquivar contato");
    } else {
      toast.success("Contato arquivado com sucesso");
      fetchClientes();
    }
  };

  const unarchiveContact = async (telefone: string) => {
    const { error } = await supabase
      .from('clientes')
      .update({ arquivado: false })
      .eq('telefone', telefone);

    if (error) {
      toast.error("Erro ao desarquivar contato");
    } else {
      toast.success("Contato restaurado com sucesso");
      fetchClientes();
    }
  };

  const deleteContact = async (telefone: string) => {
    // Deletar mensagens associadas
    const { error: msgError } = await supabase
      .from('mensagens')
      .delete()
      .eq('cliente_id', telefone);

    if (msgError) {
      toast.error("Erro ao deletar mensagens do contato");
      return;
    }

    // Deletar fichas de serviço associadas
    const { error: fichaError } = await supabase
      .from('fichas_de_servico')
      .delete()
      .eq('telefone_cliente', telefone);

    if (fichaError) {
      toast.error("Erro ao deletar fichas do contato");
      return;
    }

    // Deletar o cliente
    const { error: clienteError } = await supabase
      .from('clientes')
      .delete()
      .eq('telefone', telefone);

    if (clienteError) {
      toast.error("Erro ao deletar contato");
    } else {
      toast.success("Contato deletado permanentemente");
      fetchClientes();
    }
  };

  const toggleUnreadMark = async (telefone: string, currentState: boolean) => {
    const { error } = await supabase
      .from('clientes')
      .update({ marcado_nao_lido: !currentState })
      .eq('telefone', telefone);

    if (error) {
      toast.error("Erro ao marcar conversa");
    } else {
      toast.success(currentState ? "Conversa marcada como lida" : "Conversa marcada como não lida");
      // Atualizar localmente sem refetch completo
      setClientes(prev => prev.map(c => 
        c.telefone === telefone 
          ? { ...c, marcado_nao_lido: !currentState }
          : c
      ));
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return "hsl(var(--muted-foreground))";
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes("andamento") || statusLower.includes("agendado")) {
      return "hsl(var(--status-pending))";
    }
    if (statusLower.includes("finalizado") || statusLower.includes("aprovado")) {
      return "hsl(var(--status-approved))";
    }
    if (statusLower.includes("cancelado") || statusLower.includes("perdido") || statusLower.includes("não")) {
      return "hsl(var(--status-rejected))";
    }
    return "hsl(var(--status-closed))";
  };

  const getStatusText = (status?: string) => {
    return status || "";
  };

  useEffect(() => {
    fetchClientes();
  }, [showArchived]);

  return (
    <div className="h-full flex flex-col bg-card border-r relative">
      <div className="p-2.5 md:p-3 lg:p-4 border-b space-y-1.5 shrink-0">
        <div className="flex items-center justify-between mb-1">
          {!isCollapsed && (
            <h2 className="font-semibold text-base md:text-lg">
              {showArchived ? "Conversas Arquivadas" : "Conversas"}
            </h2>
          )}
          {onToggleCollapse && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onToggleCollapse}
              className="h-8 w-8 shrink-0"
              title={isCollapsed ? "Expandir menu" : "Recolher menu"}
            >
              {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {!isCollapsed && (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>

            {/* Indicador de bots desabilitados */}
            {clientes.filter(c => c.bot_habilitado === false && c.bot_desativado_notificacao_vista === false).length > 0 && (
              <Button
                variant={showBotDisabledOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowBotDisabledOnly(!showBotDisabledOnly)}
                className="w-full justify-start gap-2"
              >
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 shrink-0">
                  <AlertTriangle className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm">
                  {clientes.filter(c => c.bot_habilitado === false && c.bot_desativado_notificacao_vista === false).length} {clientes.filter(c => c.bot_habilitado === false && c.bot_desativado_notificacao_vista === false).length === 1 ? 'conversa precisa' : 'conversas precisam'} de atendimento
                </span>
              </Button>
            )}

            <FilterDropdown
              statusFilter={statusFilter}
              conversaFilter={conversaFilter}
              unreadFilter={unreadFilter}
              botFilter={botFilter}
              fichaFilter={fichaFilter}
              onStatusFilterChange={setStatusFilter}
              onConversaFilterChange={setConversaFilter}
              onUnreadFilterChange={setUnreadFilter}
              onBotFilterChange={setBotFilter}
              onFichaFilterChange={setFichaFilter}
            />

            {allTags.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Filtrar por tags:</p>
                <div className="flex flex-wrap gap-1">
                  {allTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer text-xs h-6"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ScrollArea className="flex-1">
        {!isCollapsed && (
          // Vista expandida - mostra cards completos
          <>
            {filteredClientes.length === 0 ? (
              <div className="flex items-center justify-center p-8 text-center">
                <p className="text-muted-foreground text-sm">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              filteredClientes.map((cliente) => (
                <ConversationCard
                  key={cliente.telefone}
                  telefone={cliente.telefone}
                  nome={cliente.nome}
                  tags={cliente.tags || []}
                  fichaId={cliente.nome_ficha}
                  fichaStatus={cliente.status_ficha}
                  statusConversa={cliente.status_conversa}
                  ultimaInteracao={cliente.ultima_interacao}
                  isSelected={selectedClienteTelefone === cliente.telefone}
                  unreadCount={unreadMessages[cliente.telefone] || 0}
                  onClick={() => onSelectCliente(cliente)}
                  onOpenTagManager={() => openTagManager(cliente.telefone)}
                  onArchive={() => archiveContact(cliente.telefone)}
                  onUnarchive={() => unarchiveContact(cliente.telefone)}
                  onDelete={() => deleteContact(cliente.telefone)}
                  isArchived={showArchived}
                  marcadoNaoLido={cliente.marcado_nao_lido}
                  onToggleUnread={() => toggleUnreadMark(cliente.telefone, cliente.marcado_nao_lido || false)}
            botHabilitado={cliente.bot_habilitado}
            botDesativadoNotificacaoVista={cliente.bot_desativado_notificacao_vista}
                />
              ))
            )}
          </>
        )}
      </ScrollArea>

      {/* Botão flutuante de arquivados */}
      {!isCollapsed && (
        <div className="absolute bottom-4 right-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full shadow-md hover:shadow-lg transition-all",
              showArchived ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted hover:bg-muted/80"
            )}
            onClick={() => setShowArchived(!showArchived)}
            title={showArchived ? "Ver conversas ativas" : "Ver conversas arquivadas"}
          >
            <Archive className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Tag Manager Dialog */}
      {currentTagClient && (
        <TagManager
          clienteTelefone={currentTagClient}
          currentTags={filteredClientes.find(c => c.telefone === currentTagClient)?.tags || []}
          onTagsUpdate={() => {
            fetchClientes();
            setTagManagerOpen(false);
          }}
          open={tagManagerOpen}
          onOpenChange={setTagManagerOpen}
        />
      )}
    </div>
  );
};
