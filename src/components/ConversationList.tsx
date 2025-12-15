import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationCard } from "./ConversationCard";
import { TagManager } from "./TagManager";
import { FilterDropdown } from "./FilterDropdown";
import { Search, Archive, PanelLeftClose, PanelLeftOpen, AlertTriangle, User, HardHat, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  bot_desligado_manualmente?: boolean;
  marcado_nao_lido?: boolean;
  orcamentos_count?: number;
  pagamento_link?: string | null;
  pagamento_realizado?: boolean;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [conversaFilter, setConversaFilter] = useState<"todas" | "aberta" | "fechada">("todas");
  const [unreadFilter, setUnreadFilter] = useState<"todas" | "lidas" | "nao_lidas">("todas");
  const [botFilter, setBotFilter] = useState<"todos" | "ativo" | "desativado">("todos");
  const [fichaFilter, setFichaFilter] = useState<"todas" | "com_ficha" | "sem_ficha">("todas");
  const [pagamentoFilter, setPagamentoFilter] = useState<"todos" | "pago" | "nao_pago" | "pendente_finalizado">("todos");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [currentTagClient, setCurrentTagClient] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);
  const [showBotDisabledOnly, setShowBotDisabledOnly] = useState(false);
  const [clientesTelefonesPorPrestador, setClientesTelefonesPorPrestador] = useState<string[]>([]);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState("");
  const [tagsWithColors, setTagsWithColors] = useState<Map<string, string>>(new Map());
  const [searchMode, setSearchMode] = useState<'ficha' | 'prestador' | 'descricao'>('ficha');
  const [showServicosParaFinalizarOnly, setShowServicosParaFinalizarOnly] = useState(false);
  const [clientesComServicoParaFinalizar, setClientesComServicoParaFinalizar] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchClientes();
    fetchTagsWithColors();
    fetchServicosParaFinalizar();
    
    const channel = supabase
      .channel('clientes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clientes' },
        () => fetchClientes()
      )
      .subscribe();

    const tagsChannel = supabase
      .channel('tags-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tags' },
        () => fetchTagsWithColors()
      )
      .subscribe();

    const fichasChannel = supabase
      .channel('fichas-para-finalizar-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fichas_de_servico' },
        () => fetchServicosParaFinalizar()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(tagsChannel);
      supabase.removeChannel(fichasChannel);
    };
  }, []);

  // ✅ Memoizar filtros pesados para melhor performance
  const filteredClientes = useMemo(() => {
    let filtered = clientes;

    // Filtro de serviços para finalizar (tem prioridade junto com bot desabilitado)
    if (showServicosParaFinalizarOnly) {
      filtered = filtered.filter(c => 
        clientesComServicoParaFinalizar.has(c.telefone)
      );
    }

    // Filtro de bot desabilitado (tem prioridade) - só mostra se não foi manual
    if (showBotDisabledOnly) {
      filtered = filtered.filter(c => 
        c.bot_habilitado === false && 
        c.bot_desativado_notificacao_vista === false &&
        c.bot_desligado_manualmente === false
      );
    }

    // Filtro por busca de texto
    if (searchTerm) {
      if (searchMode === 'ficha') {
        // Modo ficha: busca por nome do cliente, nome da ficha, tags
        filtered = filtered.filter(c => 
          c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.telefone.includes(searchTerm) ||
          (c.nome_ficha && c.nome_ficha.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (c.tags && c.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
        );
      } else if (searchMode === 'prestador') {
        // Modo prestador: busca apenas por prestadores vinculados
        filtered = filtered.filter(c => 
          clientesTelefonesPorPrestador.includes(c.telefone)
        );
      } else {
        // Modo descrição: busca por descrição do serviço (já filtrado via clientesTelefonesPorPrestador reutilizado)
        filtered = filtered.filter(c => 
          clientesTelefonesPorPrestador.includes(c.telefone)
        );
      }
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

    // Filtro por pagamento
    if (pagamentoFilter !== "todos") {
      filtered = filtered.filter(c => {
        // Só aplica filtro se tem link de pagamento
        if (!c.pagamento_link) {
          return false; // Sem link não aparece em nenhum filtro específico
        }
        
        if (pagamentoFilter === "pago") {
          return c.pagamento_realizado === true;
        } else if (pagamentoFilter === "nao_pago") {
          return c.pagamento_realizado === false;
        } else if (pagamentoFilter === "pendente_finalizado") {
          return c.status_ficha === "Finalizado" && c.pagamento_realizado === false;
        }
        return true;
      });
    }

    return filtered;
  }, [clientes, searchTerm, searchMode, statusFilter, conversaFilter, unreadFilter, botFilter, fichaFilter, pagamentoFilter, selectedTags, showBotDisabledOnly, showServicosParaFinalizarOnly, clientesTelefonesPorPrestador, clientesComServicoParaFinalizar, unreadMessages]);

  // Contagem de conversas não lidas (para os botões)
  const unreadCount = useMemo(() => {
    return clientes.filter(c => {
      const hasUnread = (unreadMessages[c.telefone] || 0) > 0 || c.marcado_nao_lido;
      return hasUnread && !showArchived;
    }).length;
  }, [clientes, unreadMessages, showArchived]);

  // ✅ Extrair tags únicas (memoizado)
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    clientes.forEach(c => {
      if (c.tags) {
        c.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags);
  }, [clientes]);

  // ✅ Filtrar tags por termo de busca
  const filteredTags = useMemo(() => {
    if (!tagSearchTerm) return allTags;
    return allTags.filter(tag => 
      tag.toLowerCase().includes(tagSearchTerm.toLowerCase())
    );
  }, [allTags, tagSearchTerm]);

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

  // Auto-limpar filtro de serviços para finalizar quando não houver mais
  useEffect(() => {
    if (showServicosParaFinalizarOnly && clientesComServicoParaFinalizar.size === 0) {
      setShowServicosParaFinalizarOnly(false);
    }
  }, [showServicosParaFinalizarOnly, clientesComServicoParaFinalizar]);

  // Buscar clientes por nome do prestador ou descrição do serviço
  useEffect(() => {
    const buscarClientesPorPrestadorOuDescricao = async () => {
      if (!searchTerm || searchMode === 'ficha') {
        setClientesTelefonesPorPrestador([]);
        return;
      }

      if (searchMode === 'prestador') {
        // 1. Buscar prestadores cujo nome contenha o termo
        const { data: prestadores } = await supabase
          .from('prestadores')
          .select('cpf')
          .ilike('nome', `%${searchTerm}%`);

        if (!prestadores || prestadores.length === 0) {
          setClientesTelefonesPorPrestador([]);
          return;
        }

        // 2. Pegar os CPFs dos prestadores encontrados
        const cpfs = prestadores.map(p => p.cpf);

        // 3. Buscar fichas que têm esses prestadores
        const { data: fichas } = await supabase
          .from('fichas_de_servico')
          .select('telefone_cliente')
          .in('prestador_id', cpfs);

        if (!fichas || fichas.length === 0) {
          setClientesTelefonesPorPrestador([]);
          return;
        }

        // 4. Extrair telefones únicos dos clientes
        const telefones = [...new Set(fichas.map(f => f.telefone_cliente))];
        setClientesTelefonesPorPrestador(telefones);
      } else {
        // Modo descrição: buscar fichas onde descrição contém o termo
        const { data: fichas } = await supabase
          .from('fichas_de_servico')
          .select('telefone_cliente')
          .ilike('descricao', `%${searchTerm}%`);

        if (!fichas || fichas.length === 0) {
          setClientesTelefonesPorPrestador([]);
          return;
        }

        const telefones = [...new Set(fichas.map(f => f.telefone_cliente))];
        setClientesTelefonesPorPrestador(telefones);
      }
    };

    buscarClientesPorPrestadorOuDescricao();
  }, [searchTerm, searchMode]);

  const fetchTagsWithColors = async () => {
    const { data: tagsData } = await supabase
      .from('tags')
      .select('nome, cor');
    
    if (tagsData) {
      const tagsMap = new Map<string, string>();
      tagsData.forEach(tag => tagsMap.set(tag.nome, tag.cor));
      setTagsWithColors(tagsMap);
    }
  };

  const fetchServicosParaFinalizar = async () => {
    // Buscar fichas com status "Agendado" e horario_agendamento passou 2 horas
    const now = new Date();
    const duasHorasAtras = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    
    console.log("ConversationList - Buscando serviços para finalizar, cutoff:", duasHorasAtras);
    
    const { data, error } = await supabase
      .from('fichas_de_servico')
      .select('telefone_cliente')
      .eq('status', 'Agendado')
      .not('horario_agendamento', 'is', null)
      .lt('horario_agendamento', duasHorasAtras);

    if (!error && data) {
      const telefonesSet = new Set(data.map(f => f.telefone_cliente));
      setClientesComServicoParaFinalizar(telefonesSet);
    }
  };

  const fetchClientes = async () => {
    // Buscar clientes arquivados para o contador
    const { count } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('arquivado', true);
    
    setArchivedCount(count || 0);

    // ✅ Query 1: Buscar clientes baseado no estado atual (com atendente)
    const { data: clientesData, error } = await supabase
      .from('clientes')
      .select(`
        *,
        atendente:profiles!atendente_id (
          full_name
        )
      `)
      .eq('arquivado', showArchived)
      .order('ultima_interacao', { ascending: false });

    if (!error && clientesData) {
      const telefones = clientesData.map(c => c.telefone);

      // ✅ Query 2: Buscar TODAS as últimas mensagens de uma vez
      const { data: ultimasMensagens } = await supabase
        .from('mensagens')
        .select('cliente_id, data_hora')
        .in('cliente_id', telefones)
        .eq('remetente', 'cliente')
        .order('data_hora', { ascending: false });

      // Criar mapa de última mensagem por cliente
      const mensagensMap = new Map();
      ultimasMensagens?.forEach(msg => {
        if (!mensagensMap.has(msg.cliente_id)) {
          mensagensMap.set(msg.cliente_id, msg.data_hora);
        }
      });

      // ✅ Query 3: Buscar TODAS as fichas ativas de uma vez
      const fichasAtivasIds = clientesData
        .filter(c => c.ficha_ativa_id)
        .map(c => c.ficha_ativa_id);
      
      const { data: fichasAtivas } = await supabase
        .from('fichas_de_servico')
        .select('id, nome_ficha, status, pagamento_link, pagamento_realizado')
        .in('id', fichasAtivasIds);

      const fichasAtivasMap = new Map();
      fichasAtivas?.forEach(f => fichasAtivasMap.set(f.id, f));

      // ✅ Query 4: Buscar últimas fichas para quem não tem ativa (em batch)
      const telefonesSeficha = clientesData
        .filter(c => !c.ficha_ativa_id)
        .map(c => c.telefone);
      
      const { data: ultimasFichas } = await supabase
        .from('fichas_de_servico')
        .select('id, telefone_cliente, nome_ficha, status, created_at, pagamento_link, pagamento_realizado')
        .in('telefone_cliente', telefonesSeficha)
        .order('created_at', { ascending: false });

      // Criar mapa de última ficha por telefone
      const ultimasFichasMap = new Map();
      ultimasFichas?.forEach(f => {
        if (!ultimasFichasMap.has(f.telefone_cliente)) {
          ultimasFichasMap.set(f.telefone_cliente, f);
        }
      });

      // ✅ Query 5: Buscar contagem de orçamentos para todas as fichas ativas (em batch)
      const todasFichasIds = [
        ...fichasAtivasIds,
        ...Array.from(ultimasFichasMap.values()).map((f: any) => f.id).filter(Boolean)
      ].filter(Boolean);

      // Buscar orçamentos para todas essas fichas
      const { data: orcamentosData } = await supabase
        .from('orcamentos')
        .select('ficha_nome')
        .in('ficha_nome', todasFichasIds);

      // Criar mapa de contagem de orçamentos por ficha
      const orcamentosCountMap = new Map();
      orcamentosData?.forEach(orc => {
        const count = orcamentosCountMap.get(orc.ficha_nome) || 0;
        orcamentosCountMap.set(orc.ficha_nome, count + 1);
      });

      // ✅ Combinar tudo SEM QUERIES EXTRAS
      const clientesComFicha = clientesData.map(cliente => {
        // Calcular janela 24h
        const ultimaMsgTime = mensagensMap.get(cliente.telefone);
        let dentroJanela = false;
        if (ultimaMsgTime) {
          const diff = (Date.now() - new Date(ultimaMsgTime).getTime()) / (1000 * 60 * 60);
          dentroJanela = diff < 24;
        }

        // Buscar dados da ficha
        let fichaData = null;
        let fichaIdParaOrcamentos = null;
        
        if (cliente.ficha_ativa_id) {
          fichaData = fichasAtivasMap.get(cliente.ficha_ativa_id);
          fichaIdParaOrcamentos = cliente.ficha_ativa_id;
        } else {
          fichaData = ultimasFichasMap.get(cliente.telefone);
          fichaIdParaOrcamentos = (fichaData as any)?.id;
        }

        // Buscar contagem de orçamentos
        const orcamentosCount = fichaIdParaOrcamentos 
          ? orcamentosCountMap.get(fichaIdParaOrcamentos) || 0 
          : 0;

        return {
          ...cliente,
          nome_ficha: fichaData?.nome_ficha || undefined,
          status_ficha: fichaData?.status || undefined,
          unread_count: unreadMessages[cliente.telefone] || 0,
          dentroJanela,
          bot_habilitado: cliente.bot_habilitado,
          bot_desativado_notificacao_vista: cliente.bot_desativado_notificacao_vista,
          bot_desligado_manualmente: cliente.bot_desligado_manualmente,
          marcado_nao_lido: cliente.marcado_nao_lido,
          orcamentos_count: orcamentosCount,
          pagamento_link: (fichaData as any)?.pagamento_link || null,
          pagamento_realizado: (fichaData as any)?.pagamento_realizado || false
        };
      });

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
    console.log(`[ConversationList] Trocando para ${showArchived ? 'arquivados' : 'ativos'}`);
    setClientes([]);
    
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
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={searchMode === 'ficha' ? "Buscar..." : searchMode === 'prestador' ? "Buscar prestador..." : "Buscar descrição..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSearchMode(searchMode === 'ficha' ? 'prestador' : searchMode === 'prestador' ? 'descricao' : 'ficha')}
                className="h-9 w-9 shrink-0"
                title={searchMode === 'ficha' ? "Buscar por prestador" : searchMode === 'prestador' ? "Buscar por descrição" : "Buscar geral"}
              >
                {searchMode === 'ficha' ? (
                  <User className="h-4 w-4" />
                ) : searchMode === 'prestador' ? (
                  <HardHat className="h-4 w-4" />
                ) : (
                  <BookOpen className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Indicador de bots desabilitados (só mostra se não foi manual) */}
            {clientes.filter(c => c.bot_habilitado === false && c.bot_desativado_notificacao_vista === false && c.bot_desligado_manualmente === false).length > 0 && (
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
                  {clientes.filter(c => c.bot_habilitado === false && c.bot_desativado_notificacao_vista === false && c.bot_desligado_manualmente === false).length} {clientes.filter(c => c.bot_habilitado === false && c.bot_desativado_notificacao_vista === false && c.bot_desligado_manualmente === false).length === 1 ? 'conversa precisa' : 'conversas precisam'} de atendimento
                </span>
              </Button>
            )}

            {/* Indicador de serviços para finalizar ou reagendar */}
            {clientesComServicoParaFinalizar.size > 0 && (
              <Button
                variant={showServicosParaFinalizarOnly ? "destructive" : "outline"}
                size="sm"
                onClick={() => setShowServicosParaFinalizarOnly(!showServicosParaFinalizarOnly)}
                className="w-full justify-start gap-2 border-red-300"
              >
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 shrink-0">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                <span className="text-sm">
                  {clientesComServicoParaFinalizar.size} {clientesComServicoParaFinalizar.size === 1 ? 'serviço precisa' : 'serviços precisam'} de atualização
                </span>
              </Button>
            )}

            {/* Linha 1: Filtros + Tags lado a lado */}
            <div className="flex gap-1.5">
              <FilterDropdown
                statusFilter={statusFilter}
                conversaFilter={conversaFilter}
                botFilter={botFilter}
                fichaFilter={fichaFilter}
                pagamentoFilter={pagamentoFilter}
                onStatusFilterChange={setStatusFilter}
                onConversaFilterChange={setConversaFilter}
                onBotFilterChange={setBotFilter}
                onFichaFilterChange={setFichaFilter}
                onPagamentoFilterChange={setPagamentoFilter}
              />
              
              {allTags.length > 0 && (
                <Popover open={tagsExpanded} onOpenChange={setTagsExpanded}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 h-8 justify-start text-xs gap-1.5"
                    >
                      <span>🏷️</span>
                      <span>Tags</span>
                      {selectedTags.length > 0 ? (
                        <Badge variant="default" className="ml-auto h-4 px-1 text-[10px]">
                          {selectedTags.length}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="ml-auto h-4 px-1 text-[10px]">
                          {allTags.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 bg-popover z-50" align="start">
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          placeholder="Buscar tags..."
                          value={tagSearchTerm}
                          onChange={(e) => setTagSearchTerm(e.target.value)}
                          className="pl-7 h-7 text-xs"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                        {filteredTags.map((tag) => {
                          const tagColor = tagsWithColors.get(tag) || '#6B7280';
                          return (
                            <Badge
                              key={tag}
                              variant={selectedTags.includes(tag) ? "default" : "outline"}
                              className="cursor-pointer text-xs h-6 transition-all hover:scale-105"
                              onClick={() => toggleTag(tag)}
                              style={{
                                backgroundColor: selectedTags.includes(tag) ? tagColor : 'transparent',
                                borderColor: tagColor,
                                color: selectedTags.includes(tag) ? '#FFFFFF' : tagColor
                              }}
                            >
                              {tag}
                            </Badge>
                          );
                        })}
                      </div>
                      {selectedTags.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full h-7 text-xs"
                          onClick={() => setSelectedTags([])}
                        >
                          Limpar seleção
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Linha 2: Todas / Não Lidas */}
            <div className="flex gap-1">
              <Button
                variant={unreadFilter === "todas" ? "default" : "outline"}
                size="sm"
                onClick={() => setUnreadFilter("todas")}
                className="flex-1 h-7 text-xs"
              >
                Todas
              </Button>
              <Button
                variant={unreadFilter === "nao_lidas" ? "default" : "outline"}
                size="sm"
                onClick={() => setUnreadFilter("nao_lidas")}
                className="flex-1 h-7 text-xs gap-1"
              >
                Não Lidas
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </div>
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
                  tagsColors={tagsWithColors}
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
                  botDesligadoManualmente={cliente.bot_desligado_manualmente}
                  orcamentosCount={cliente.orcamentos_count}
                  atendenteNome={(cliente as any).atendente?.full_name}
                  temServicoParaFinalizar={clientesComServicoParaFinalizar.has(cliente.telefone)}
                  pagamentoLink={cliente.pagamento_link}
                  pagamentoRealizado={cliente.pagamento_realizado}
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
