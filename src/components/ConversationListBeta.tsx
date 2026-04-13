import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationCard } from "./ConversationCard";
import { TagManager } from "./TagManager";
import { FilterDropdown } from "./FilterDropdown";
import { Search, Archive, PanelLeftClose, PanelLeftOpen, AlertTriangle, User, HardHat, BookOpen, UserPlus, Users, CheckSquare, X, Hash, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { debounce } from "lodash-es";
import { NovaConversaDialog } from "./NovaConversaDialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getEscalatedAlertColor, parseStatusAlertRules, STATUS_ALERT_CONFIG_KEY, type StatusAlertRule } from "@/lib/statusAlertConfig";

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
  atendente_id?: string | null;
  tempoNoStatusMinutos?: number;
  statusAlertColor?: string | null;
  ficha_id_real?: string | null;
}

interface ConversationListProps {
  selectedClienteTelefone: string | null;
  onSelectCliente: (cliente: Cliente) => void;
  unreadMessages: Record<string, number>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  botDisabledAcknowledged?: Set<string>;
  hideFilters?: boolean;
  // External filter overrides
  externalStatusFilter?: string;
  externalConversaStatusFilter?: "ativas" | "inativas" | "todas";
  externalUnreadFilter?: "todas" | "lidas" | "nao_lidas";
  externalSelectedTags?: string[];
  externalTicketView?: "meus" | "todos";
  externalConversaFilter?: "todas" | "aberta" | "fechada";
  externalBotFilter?: "todos" | "ativo" | "desativado";
  externalFichaFilter?: "todas" | "com_ficha" | "sem_ficha";
  externalPagamentoFilter?: "todos" | "pago" | "nao_pago" | "pendente_finalizado";
  externalShowBotDisabledOnly?: boolean;
  externalSelectedOperadorId?: string | null;
  // Callbacks for filters rendered in conversation list (hideFilters mode)
  onConversaStatusFilterChange?: (v: "ativas" | "inativas" | "todas") => void;
  onUnreadFilterChange?: (v: "todas" | "lidas" | "nao_lidas") => void;
  unreadCount?: number;
  // Callback to report counts
  onStatusCounts?: (counts: { byStatus: Record<string, number>; unreadCount: number; totalCount: number; ativasCount: number; inativasCount: number; allTags: string[]; tagsWithColors: Map<string, string>; botDisabledCount: number }) => void;
}

export const ConversationListBeta = ({ 
  selectedClienteTelefone, 
  onSelectCliente, 
  unreadMessages,
  isCollapsed = false,
  onToggleCollapse,
  botDisabledAcknowledged = new Set(),
  hideFilters = false,
  externalStatusFilter,
  externalConversaStatusFilter,
  externalUnreadFilter,
  externalSelectedTags,
  externalTicketView,
  externalConversaFilter,
  externalBotFilter,
  externalFichaFilter,
  externalPagamentoFilter,
  externalShowBotDisabledOnly,
  externalSelectedOperadorId,
  onConversaStatusFilterChange: onExternalConversaStatusFilterChange,
  onUnreadFilterChange: onExternalUnreadFilterChange,
  unreadCount: externalUnreadCount,
  onStatusCounts,
}: ConversationListProps) => {
  const { user, isSupervisor } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);

  // Old conversa_operador_leitura system removed — unread now fully tracked via mensagem_leitura_operador
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
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
  const [clientesTelefonesPorFicha, setClientesTelefonesPorFicha] = useState<string[]>([]);
  const [clientesTelefonesPorIdFicha, setClientesTelefonesPorIdFicha] = useState<string[]>([]);
  const [clientesTelefonesPorMensagem, setClientesTelefonesPorMensagem] = useState<string[]>([]);
  const [isSearchingById, setIsSearchingById] = useState(false);
  const [isSearchingByMessage, setIsSearchingByMessage] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState("");
  const [tagsWithColors, setTagsWithColors] = useState<Map<string, string>>(new Map());
  const [searchMode, setSearchMode] = useState<'ficha' | 'prestador' | 'descricao' | 'id_ficha' | 'mensagem'>('ficha');
  const [showServicosParaFinalizarOnly, setShowServicosParaFinalizarOnly] = useState(false);
  const [clientesComServicoParaFinalizar, setClientesComServicoParaFinalizar] = useState<Set<string>>(new Set());
  const [clientesSemOrcamento, setClientesSemOrcamento] = useState<Set<string>>(new Set());
  const [showAguardandoRespostaOnly, setShowAguardandoRespostaOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statusAlertRules, setStatusAlertRules] = useState<StatusAlertRule[]>([]);
  const statusAlertRulesRef = useRef<StatusAlertRule[]>([]);
  const isFirstLoadRef = useRef(true);
  
  // 🆕 Rastrear orçamentos recém-chegados (ficha_id → Set)
  const [recentOrcamentoFichas, setRecentOrcamentoFichas] = useState<Set<string>>(new Set());
  
  // Toggle "Meus Tickets" / "Todos" - padrão em "todos" para evitar perda de sincronização visual
  const [ticketView, setTicketView] = useState<"meus" | "todos">("todos");
  
  // 🆕 Filtro de conversas ativas/inativas
  const [conversaStatusFilter, setConversaStatusFilter] = useState<"ativas" | "inativas" | "todas">("ativas");
  
  // 🆕 Modo de seleção em massa
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedClientes, setSelectedClientes] = useState<Set<string>>(new Set());
  const [todosAtendentes, setTodosAtendentes] = useState<Array<{ id: string; nome: string }>>([]);
  
  // Status que indicam conversa inativa
  const STATUS_INATIVOS = ["Finalizado", "Perdido", "Não foi adiante"];

  // ═══ Computed filter values: use external overrides when provided ═══
  const effectiveStatusFilter = externalStatusFilter ?? statusFilter;
  const effectiveConversaStatusFilter = externalConversaStatusFilter ?? conversaStatusFilter;
  const effectiveUnreadFilter = externalUnreadFilter ?? unreadFilter;
  const effectiveSelectedTags = externalSelectedTags ?? selectedTags;
  const effectiveTicketView = externalTicketView ?? ticketView;
  const effectiveConversaFilter = externalConversaFilter ?? conversaFilter;
  const effectiveBotFilter = externalBotFilter ?? botFilter;
  const effectiveFichaFilter = externalFichaFilter ?? fichaFilter;
  const effectivePagamentoFilter = externalPagamentoFilter ?? pagamentoFilter;
  const effectiveShowBotDisabledOnly = externalShowBotDisabledOnly ?? showBotDisabledOnly;

  // ✅ Debounce do termo de busca (300ms)
  const debouncedSetSearch = useMemo(
    () => debounce((term: string) => {
      setDebouncedSearchTerm(term);
    }, 300),
    []
  );

  // Atualizar debounced search quando searchTerm mudar
  useEffect(() => {
    debouncedSetSearch(searchTerm);
    return () => debouncedSetSearch.cancel();
  }, [searchTerm, debouncedSetSearch]);

  useEffect(() => {
    // ✅ Carregar dados iniciais em paralelo
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const rules = await fetchStatusAlertRules();
        await Promise.all([
          fetchClientes(rules),
          fetchTagsWithColors(),
          fetchServicosParaFinalizar(),
          fetchAtendentes(),
          fetchSemOrcamento()
        ]);
      } catch (err) {
        console.error('Erro ao carregar dados iniciais:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialData();
    
    const channel = supabase
      .channel('clientes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clientes' },
        () => fetchClientes()
      )
      .subscribe();

    const mensagensChannel = supabase
      .channel('mensagens-beta-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mensagens' },
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

    // 🆕 Canal realtime para novos orçamentos
    const orcamentosChannel = supabase
      .channel('orcamentos-new-beta')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orcamentos' },
        async (payload) => {
          const fichaId = (payload.new as any)?.ficha_nome;
          if (fichaId) {
            setRecentOrcamentoFichas(prev => new Set(prev).add(fichaId));
          }
        }
      )
      .subscribe();

    const leituraChannel = user?.id
      ? supabase
          .channel(`mensagem-leitura-beta-${user.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'mensagem_leitura_operador', filter: `user_id=eq.${user.id}` },
            () => fetchClientes()
          )
          .subscribe()
      : null;

    const pollingInterval = window.setInterval(() => {
      fetchClientes();
      fetchServicosParaFinalizar();
      fetchSemOrcamento();
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(mensagensChannel);
      supabase.removeChannel(tagsChannel);
      supabase.removeChannel(fichasChannel);
      supabase.removeChannel(orcamentosChannel);
      if (leituraChannel) supabase.removeChannel(leituraChannel);
      window.clearInterval(pollingInterval);
    };
  }, [user?.id]);

  // ✅ Memoizar filtros pesados para melhor performance
  const filteredClientes = useMemo(() => {
    let filtered = clientes;

    const ignorarFiltrosBuscaId = (searchMode === 'id_ficha' || searchMode === 'mensagem') && debouncedSearchTerm;

    if (user && !ignorarFiltrosBuscaId) {
      if (effectiveTicketView === "meus") {
        filtered = filtered.filter(c => 
          c.atendente_id === user.id || c.atendente_id === null
        );
      }
    }

    // Filtro por operador específico
    if (externalSelectedOperadorId && !ignorarFiltrosBuscaId) {
      filtered = filtered.filter(c => c.atendente_id === externalSelectedOperadorId);
    }

    if (effectiveConversaStatusFilter === "ativas" && !ignorarFiltrosBuscaId) {
      // Usa status_conversa (aberta/fechada) como fonte principal — reflete nova mensagem recebida
      filtered = filtered.filter(c => c.status_conversa === "aberta");
    } else if (effectiveConversaStatusFilter === "inativas" && !ignorarFiltrosBuscaId) {
      filtered = filtered.filter(c => c.status_conversa === "fechada" || !c.status_conversa);
    }

    if (showServicosParaFinalizarOnly) {
      filtered = filtered.filter(c => 
        clientesComServicoParaFinalizar.has(c.telefone)
      );
    }

    if (effectiveShowBotDisabledOnly) {
      filtered = filtered.filter(c => 
        c.bot_habilitado === false && 
        c.bot_desativado_notificacao_vista === false &&
        c.bot_desligado_manualmente === false
      );
    }

    if (debouncedSearchTerm) {
      if (searchMode === 'ficha') {
        filtered = filtered.filter(c => 
          c.nome.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          c.telefone.includes(debouncedSearchTerm) ||
          (c.nome_ficha && c.nome_ficha.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
          (c.tags && c.tags.some(tag => tag.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))) ||
          clientesTelefonesPorFicha.includes(c.telefone)
        );
      } else if (searchMode === 'prestador') {
        filtered = filtered.filter(c => 
          clientesTelefonesPorPrestador.includes(c.telefone)
        );
      } else if (searchMode === 'descricao') {
        filtered = filtered.filter(c => 
          clientesTelefonesPorPrestador.includes(c.telefone)
        );
      } else if (searchMode === 'id_ficha') {
        filtered = filtered.filter(c => 
          clientesTelefonesPorIdFicha.includes(c.telefone)
        );
      } else if (searchMode === 'mensagem') {
        filtered = filtered.filter(c => 
          clientesTelefonesPorMensagem.includes(c.telefone)
        );
      }
    }

    if (effectiveStatusFilter !== "all") {
      filtered = filtered.filter(c => c.status_ficha === effectiveStatusFilter);
    }

    if (effectiveConversaFilter !== "todas") {
      filtered = filtered.filter(c => {
        if (effectiveConversaFilter === "aberta") {
          return c.dentroJanela === true;
        } else {
          return c.dentroJanela === false;
        }
      });
    }

    if (effectiveUnreadFilter !== "todas") {
      filtered = filtered.filter(c => {
        const hasUnread = (unreadMessages[c.telefone] || 0) > 0 || c.marcado_nao_lido;
        if (effectiveUnreadFilter === "nao_lidas") {
          return hasUnread;
        } else {
          return !hasUnread;
        }
      });
    }

    if (effectiveSelectedTags.length > 0) {
      filtered = filtered.filter(c => 
        c.tags && effectiveSelectedTags.some(tag => c.tags.includes(tag))
      );
    }

    if (effectiveBotFilter !== "todos") {
      filtered = filtered.filter(c => {
        if (effectiveBotFilter === "ativo") {
          return c.bot_habilitado !== false;
        } else {
          return c.bot_habilitado === false;
        }
      });
    }

    if (effectiveFichaFilter !== "todas") {
      filtered = filtered.filter(c => {
        if (effectiveFichaFilter === "com_ficha") {
          return !!c.nome_ficha;
        } else {
          return !c.nome_ficha;
        }
      });
    }

    if (effectivePagamentoFilter !== "todos") {
      filtered = filtered.filter(c => {
        if (!c.pagamento_link) {
          return false;
        }
        
        if (effectivePagamentoFilter === "pago") {
          return c.pagamento_realizado === true;
        } else if (effectivePagamentoFilter === "nao_pago") {
          return c.pagamento_realizado === false;
        } else if (effectivePagamentoFilter === "pendente_finalizado") {
          return c.status_ficha === "Finalizado" && c.pagamento_realizado === false;
        }
        return true;
      });
    }

    // Filtro de aguardando resposta
    if (showAguardandoRespostaOnly) {
      filtered = filtered.filter(c => 
        c.bot_habilitado === false && c.marcado_nao_lido === true
      );
    }

    // Manter ordem original do banco (ultima_interacao DESC)

    return filtered;
  }, [clientes, debouncedSearchTerm, searchMode, effectiveStatusFilter, effectiveConversaFilter, effectiveUnreadFilter, effectiveBotFilter, effectiveFichaFilter, effectivePagamentoFilter, effectiveSelectedTags, effectiveShowBotDisabledOnly, showServicosParaFinalizarOnly, showAguardandoRespostaOnly, clientesTelefonesPorPrestador, clientesTelefonesPorFicha, clientesTelefonesPorIdFicha, clientesTelefonesPorMensagem, clientesComServicoParaFinalizar, clientesSemOrcamento, unreadMessages, user, isSupervisor, effectiveTicketView, effectiveConversaStatusFilter, STATUS_INATIVOS, externalSelectedOperadorId]);

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

  // ═══ Report status counts to parent ═══
  useEffect(() => {
    if (!onStatusCounts) return;
    // Filtrar por operador se selecionado, para que os contadores reflitam o filtro
    let baseClientes = clientes;
    if (externalSelectedOperadorId) {
      baseClientes = clientes.filter(c => c.atendente_id === externalSelectedOperadorId);
    }
    const byStatus: Record<string, number> = {};
    baseClientes.forEach(c => {
      const status = c.status_ficha || 'Sem ficha';
      byStatus[status] = (byStatus[status] || 0) + 1;
    });
    const ativasCount = baseClientes.filter(c => c.status_conversa === "aberta").length;
    const inativasCount = baseClientes.filter(c => c.status_conversa === "fechada" || !c.status_conversa).length;
    const botDisabledCount = baseClientes.filter(c => c.bot_habilitado === false && c.bot_desativado_notificacao_vista === false && c.bot_desligado_manualmente === false).length;
    const filteredUnreadCount = baseClientes.filter(c => {
      const hasUnread = (unreadMessages[c.telefone] || 0) > 0 || c.marcado_nao_lido;
      return hasUnread;
    }).length;
    onStatusCounts({ byStatus, unreadCount: filteredUnreadCount, totalCount: baseClientes.length, ativasCount, inativasCount, allTags, tagsWithColors, botDisabledCount });
  }, [clientes, unreadCount, allTags, tagsWithColors, externalSelectedOperadorId]);

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

  // Buscar clientes por nome da ficha (TODAS as fichas, não só a ativa) - usando debounced term
  useEffect(() => {
    const buscarClientesPorNomeFicha = async () => {
      if (!debouncedSearchTerm || searchMode !== 'ficha') {
        setClientesTelefonesPorFicha([]);
        return;
      }

      // Buscar TODAS as fichas que têm o nome buscado (não só as ativas)
      const { data: fichas } = await supabase
        .from('fichas_de_servico')
        .select('telefone_cliente')
        .ilike('nome_ficha', `%${debouncedSearchTerm}%`);

      if (!fichas || fichas.length === 0) {
        setClientesTelefonesPorFicha([]);
        return;
      }

      const telefones = [...new Set(fichas.map(f => f.telefone_cliente))];
      setClientesTelefonesPorFicha(telefones);
    };

    buscarClientesPorNomeFicha();
  }, [debouncedSearchTerm, searchMode]);

  // Buscar clientes por nome do prestador ou descrição do serviço - usando debounced term
  useEffect(() => {
    const buscarClientesPorPrestadorOuDescricao = async () => {
      if (!debouncedSearchTerm || searchMode === 'ficha' || searchMode === 'id_ficha') {
        setClientesTelefonesPorPrestador([]);
        return;
      }

      if (searchMode === 'prestador') {
        // 1. Buscar prestadores cujo nome contenha o termo
        const { data: prestadores } = await supabase
          .from('prestadores')
          .select('cpf')
          .ilike('nome', `%${debouncedSearchTerm}%`);

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
          .ilike('descricao', `%${debouncedSearchTerm}%`);

        if (!fichas || fichas.length === 0) {
          setClientesTelefonesPorPrestador([]);
          return;
        }

        const telefones = [...new Set(fichas.map(f => f.telefone_cliente))];
        setClientesTelefonesPorPrestador(telefones);
      }
    };

    buscarClientesPorPrestadorOuDescricao();
  }, [debouncedSearchTerm, searchMode]);

  // Buscar clientes por ID da ficha de serviço - USANDO EDGE FUNCTION (bypassa RLS)
  useEffect(() => {
    const buscarClientesPorIdFicha = async () => {
      if (!debouncedSearchTerm || searchMode !== 'id_ficha') {
        setClientesTelefonesPorIdFicha([]);
        setIsSearchingById(false);
        return;
      }

      // Require minimum 3 characters
      if (debouncedSearchTerm.trim().length < 3) {
        setClientesTelefonesPorIdFicha([]);
        setIsSearchingById(false);
        return;
      }

      setIsSearchingById(true);
      
      // Debug log (dev only)
      if (import.meta.env.DEV) {
        console.log('[ConversationList] Buscando ficha por ID via edge function:', {
          searchMode,
          term: debouncedSearchTerm
        });
      }

      try {
        const { data, error } = await supabase.functions.invoke('search-ficha-id', {
          body: { term: debouncedSearchTerm }
        });

        if (error) {
          console.error('[ConversationList] Erro ao buscar ficha por ID:', error);
          setClientesTelefonesPorIdFicha([]);
          toast.error('Não foi possível buscar ficha');
          return;
        }

        const phones = data?.phones || [];
        
        // Debug log (dev only)
        if (import.meta.env.DEV) {
          console.log('[ConversationList] Resultado da busca por ID:', {
            term: debouncedSearchTerm,
            phonesCount: phones.length,
            matchedIds: data?.matchedIds || []
          });
        }

        setClientesTelefonesPorIdFicha(phones);
      } catch (err) {
        console.error('[ConversationList] Erro inesperado ao buscar ficha por ID:', err);
        setClientesTelefonesPorIdFicha([]);
      } finally {
        setIsSearchingById(false);
      }
    };

    buscarClientesPorIdFicha();
  }, [debouncedSearchTerm, searchMode]);

  // Buscar clientes por texto das mensagens - USANDO EDGE FUNCTION
  useEffect(() => {
    const buscarClientesPorMensagem = async () => {
      if (!debouncedSearchTerm || searchMode !== 'mensagem') {
        setClientesTelefonesPorMensagem([]);
        setIsSearchingByMessage(false);
        return;
      }

      if (debouncedSearchTerm.trim().length < 3) {
        setClientesTelefonesPorMensagem([]);
        setIsSearchingByMessage(false);
        return;
      }

      setIsSearchingByMessage(true);

      try {
        const { data, error } = await supabase.functions.invoke('search-messages', {
          body: { term: debouncedSearchTerm }
        });

        if (error) {
          console.error('[ConversationList] Erro ao buscar mensagens:', error);
          setClientesTelefonesPorMensagem([]);
          toast.error('Não foi possível buscar mensagens');
          return;
        }

        setClientesTelefonesPorMensagem(data?.phones || []);
      } catch (err) {
        console.error('[ConversationList] Erro inesperado ao buscar mensagens:', err);
        setClientesTelefonesPorMensagem([]);
      } finally {
        setIsSearchingByMessage(false);
      }
    };

    buscarClientesPorMensagem();
  }, [debouncedSearchTerm, searchMode]);

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

  // 🆕 Buscar lista de atendentes para atribuição em massa
  const fetchAtendentes = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name');
    
    if (data) {
      setTodosAtendentes(data.map(p => ({
        id: p.id,
        nome: p.full_name || 'Sem nome'
      })));
    }
  };

  // 🆕 Atribuir múltiplas conversas em massa
  const atribuirEmMassa = async (operadorId: string) => {
    const telefones = Array.from(selectedClientes);
    
    if (telefones.length === 0) {
      toast.error('Selecione pelo menos uma conversa');
      return;
    }
    
    const { error } = await supabase
      .from('clientes')
      .update({ atendente_id: operadorId })
      .in('telefone', telefones);

    if (error) {
      toast.error('Erro ao atribuir conversas');
    } else {
      const operador = todosAtendentes.find(a => a.id === operadorId);
      toast.success(`${telefones.length} conversa(s) atribuída(s) para ${operador?.nome || 'operador'}`);
      setSelectedClientes(new Set());
      setSelectionMode(false);
      fetchClientes();
    }
  };

  // 🆕 Toggle de seleção de cliente
  const toggleClienteSelection = (telefone: string) => {
    setSelectedClientes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(telefone)) {
        newSet.delete(telefone);
      } else {
        newSet.add(telefone);
      }
      return newSet;
    });
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

  // Buscar fichas sem orçamento há mais de 15 minutos no status "Ficha Criada"
  const fetchSemOrcamento = async () => {
    const quinzeMinAtras = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // Status onde orçamento deveria existir
    const statusOrcamento: Array<"Ficha Criada"> = ['Ficha Criada'];

    // Buscar fichas nesses status atualizadas há mais de 15 min
    const { data: fichas, error: fichasError } = await supabase
      .from('fichas_de_servico')
      .select('id, telefone_cliente')
      .in('status', statusOrcamento as any)
      .lt('updated_at', quinzeMinAtras);

    if (fichasError || !fichas || fichas.length === 0) {
      setClientesSemOrcamento(new Set());
      return;
    }

    const fichaIds = fichas.map(f => f.id);

    // Buscar quais dessas fichas já têm orçamento
    const { data: orcamentos } = await supabase
      .from('orcamentos')
      .select('ficha_nome')
      .in('ficha_nome', fichaIds);

    const fichasComOrcamento = new Set(orcamentos?.map(o => o.ficha_nome) || []);

    // Filtrar fichas sem orçamento
    const telefonesSemOrcamento = fichas
      .filter(f => !fichasComOrcamento.has(f.id))
      .map(f => f.telefone_cliente);

    setClientesSemOrcamento(new Set(telefonesSemOrcamento));
  };

  const fetchClientes = async (rulesOverride?: StatusAlertRule[]) => {
    const activeRules = rulesOverride ?? statusAlertRulesRef.current;
    try {
    // Buscar clientes arquivados para o contador
    const { count } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('arquivado', true);
    
    setArchivedCount(count || 0);

    // ✅ Query 1: Buscar TODOS os clientes com paginação para ultrapassar o limite de 1000
    let allClientesData: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data: page, error } = await supabase
        .from('clientes')
        .select(`
          *,
          atendente:profiles!atendente_id (
            full_name
          )
        `)
        .eq('arquivado', showArchived)
        .order('ultima_interacao', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      
      if (error || !page) break;
      allClientesData = allClientesData.concat(page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const clientesData = allClientesData;

    if (clientesData.length > 0) {
      const telefones = clientesData.map(c => c.telefone);

      // Helper to chunk .in() queries that might exceed URL length limits
      const chunkedIn = async (
        table: string,
        selectCols: string,
        filterCol: string,
        filterValues: string[],
        extraFilters?: (q: any) => any,
        orderCol?: string
      ): Promise<any[]> => {
        if (filterValues.length === 0) return [];
        const CHUNK = 500;
        const results: any[] = [];
        for (let i = 0; i < filterValues.length; i += CHUNK) {
          const chunk = filterValues.slice(i, i + CHUNK);
          let q = (supabase as any).from(table).select(selectCols).in(filterCol, chunk);
          if (extraFilters) q = extraFilters(q);
          if (orderCol) q = q.order(orderCol, { ascending: false });
          const { data } = await q;
          if (data) results.push(...data);
        }
        return results;
      };

      // ✅ Query 2: Buscar últimas mensagens
      const ultimasMensagens = await chunkedIn(
        'mensagens', 'cliente_id, data_hora', 'cliente_id', telefones,
        (q) => q.neq('remetente', 'whatsapp:+554138911555'),
        'data_hora'
      );

      const mensagensMap = new Map();
      ultimasMensagens.forEach(msg => {
        if (!mensagensMap.has(msg.cliente_id)) {
          mensagensMap.set(msg.cliente_id, msg.data_hora);
        }
      });

      // ✅ Query 3: Buscar TODAS as fichas ativas de uma vez
      const fichasAtivasIds = clientesData
        .filter(c => c.ficha_ativa_id)
        .map(c => c.ficha_ativa_id);
      
      const fichasAtivas = await chunkedIn(
        'fichas_de_servico', 'id, nome_ficha, status, pagamento_link, pagamento_realizado, created_at, updated_at',
        'id', fichasAtivasIds
      );

      const fichasAtivasMap = new Map();
      fichasAtivas.forEach(f => fichasAtivasMap.set(f.id, f));

      // ✅ Query 4: Buscar últimas fichas para quem não tem ativa (em batch)
      const telefonesSeficha = clientesData
        .filter(c => !c.ficha_ativa_id)
        .map(c => c.telefone);
      
      const ultimasFichas = await chunkedIn(
        'fichas_de_servico', 'id, telefone_cliente, nome_ficha, status, created_at, updated_at, pagamento_link, pagamento_realizado',
        'telefone_cliente', telefonesSeficha,
        undefined,
        'created_at'
      );

      const ultimasFichasMap = new Map();
      ultimasFichas.forEach(f => {
        if (!ultimasFichasMap.has(f.telefone_cliente)) {
          ultimasFichasMap.set(f.telefone_cliente, f);
        }
      });

      // Persistir ficha_ativa_id apenas na primeira carga (não no polling)
      if (isFirstLoadRef.current && ultimasFichasMap.size > 0) {
        isFirstLoadRef.current = false;
        const updatePromises = Array.from(ultimasFichasMap.entries()).map(([telefone, ficha]: [string, any]) =>
          supabase
            .from('clientes')
            .update({ ficha_ativa_id: ficha.id })
            .eq('telefone', telefone)
        );
        await Promise.all(updatePromises);
      }

      // ✅ Query 5: Buscar contagem de orçamentos para todas as fichas ativas (em batch)
      const todasFichasIds = [
        ...fichasAtivasIds,
        ...Array.from(ultimasFichasMap.values()).map((f: any) => f.id).filter(Boolean)
      ].filter(Boolean);

      const orcamentosData = await chunkedIn(
        'orcamentos', 'ficha_nome', 'ficha_nome', todasFichasIds
      );

      const orcamentosCountMap = new Map();
      orcamentosData.forEach(orc => {
        const count = orcamentosCountMap.get(orc.ficha_nome) || 0;
        orcamentosCountMap.set(orc.ficha_nome, count + 1);
      });

      const statusHistoricoAtivoMap = new Map();
      const statusHistoricoFallbackMap = new Map();
      if (todasFichasIds.length > 0) {
        const statusHistoricoData = await chunkedIn(
          'ficha_status_historico', 'ficha_id, data_inicio, status_novo, data_fim',
          'ficha_id', todasFichasIds,
          undefined,
          'data_inicio'
        );

        statusHistoricoData.forEach((item) => {
          if (!statusHistoricoFallbackMap.has(item.ficha_id)) {
            statusHistoricoFallbackMap.set(item.ficha_id, item);
          }
          if (item.data_fim === null && !statusHistoricoAtivoMap.has(item.ficha_id)) {
            statusHistoricoAtivoMap.set(item.ficha_id, item);
          }
        });
      }

      // ✅ Query extra: Buscar leitura per-operator para determinar não lido
      let operatorReadMap = new Map<string, { last_read_at: string; manual_unread_at: string | null }>(); 
      if (user?.id) {
        const { data: readData } = await (supabase as any)
          .from('mensagem_leitura_operador')
          .select('cliente_telefone, last_read_at, manual_unread_at')
          .eq('user_id', user.id);
        readData?.forEach((r: any) => {
          operatorReadMap.set(r.cliente_telefone, { last_read_at: r.last_read_at, manual_unread_at: r.manual_unread_at });
        });
      }

      // ✅ Buscar última mensagem de CLIENTE por telefone para comparar com leitura
      // Mensagens do cliente podem ter remetente='cliente' (legado) OU tipo_remetente='cliente' (webhook/Twilio)
      // Buscamos ambos os casos para compatibilidade
      const ultimasMensagensClienteLegado = await chunkedIn(
        'mensagens', 'cliente_id, data_hora', 'cliente_id', telefones,
        (q) => q.eq('remetente', 'cliente'),
        'data_hora'
      );
      const ultimasMensagensClienteTipo = await chunkedIn(
        'mensagens', 'cliente_id, data_hora', 'cliente_id', telefones,
        (q) => q.eq('tipo_remetente', 'cliente'),
        'data_hora'
      );

      const ultimaMsgClienteMap = new Map<string, string>();
      // Merge both result sets, keeping the most recent date per client
      [...(ultimasMensagensClienteLegado || []), ...(ultimasMensagensClienteTipo || [])].forEach(msg => {
        const existing = ultimaMsgClienteMap.get(msg.cliente_id);
        if (!existing || new Date(msg.data_hora) > new Date(existing)) {
          ultimaMsgClienteMap.set(msg.cliente_id, msg.data_hora);
        }
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

        const historicoAtual = fichaIdParaOrcamentos ? statusHistoricoAtivoMap.get(fichaIdParaOrcamentos) : null;
        const historicoFallback = fichaIdParaOrcamentos ? statusHistoricoFallbackMap.get(fichaIdParaOrcamentos) : null;
        const inicioStatus =
          historicoAtual?.data_inicio ||
          (historicoFallback?.status_novo === fichaData?.status ? historicoFallback?.data_inicio : null) ||
          (fichaData as any)?.updated_at ||
          (fichaData as any)?.created_at ||
          null;

        const minutosNoStatus = inicioStatus
          ? (Date.now() - new Date(inicioStatus).getTime()) / (1000 * 60)
          : undefined;

        const regraAlerta = activeRules.find((rule) => rule.status === fichaData?.status);
        const escalatedAlertColor = regraAlerta && minutosNoStatus !== undefined
          ? getEscalatedAlertColor(minutosNoStatus, regraAlerta)
          : null;

        // Per-operator unread: compare last_read_at with latest client message
        const readRecord = operatorReadMap.get(cliente.telefone);
        const lastClientMsg = ultimaMsgClienteMap.get(cliente.telefone);
        let perOperatorUnread = false;
        
        // Manual unread takes priority
        if (readRecord?.manual_unread_at) {
          perOperatorUnread = true;
        } else if (lastClientMsg) {
          if (!readRecord) {
            perOperatorUnread = !!lastClientMsg;
          } else if (new Date(lastClientMsg) > new Date(readRecord.last_read_at)) {
            perOperatorUnread = true;
          }
        }

        return {
          ...cliente,
          nome_ficha: fichaData?.nome_ficha || undefined,
          status_ficha: fichaData?.status || undefined,
          unread_count: unreadMessages[cliente.telefone] || 0,
          dentroJanela,
          bot_habilitado: cliente.bot_habilitado,
          bot_desativado_notificacao_vista: cliente.bot_desativado_notificacao_vista,
          bot_desligado_manualmente: cliente.bot_desligado_manualmente,
          marcado_nao_lido: perOperatorUnread,
          orcamentos_count: orcamentosCount,
          pagamento_link: (fichaData as any)?.pagamento_link || null,
          pagamento_realizado: (fichaData as any)?.pagamento_realizado || false,
          atendente_id: cliente.atendente_id || null,
          tempoNoStatusMinutos: minutosNoStatus,
          statusAlertColor: escalatedAlertColor,
          ficha_id_real: fichaIdParaOrcamentos || null
        };
      });

      setClientes(clientesComFicha);

      // Seed read records for conversations that don't have one yet (avoid legacy showing as unread)
      if (user?.id) {
        const telefonesSemLeitura = clientesData
          .filter(c => !operatorReadMap.has(c.telefone))
          .map(c => c.telefone);
        
        if (telefonesSemLeitura.length > 0) {
          // Batch insert in chunks of 100
          for (let i = 0; i < telefonesSemLeitura.length; i += 100) {
            const chunk = telefonesSemLeitura.slice(i, i + 100);
            const rows = chunk.map(tel => ({
              user_id: user.id,
              cliente_telefone: tel,
              last_read_at: new Date().toISOString()
            }));
            await supabase
              .from('mensagem_leitura_operador')
              .upsert(rows, { onConflict: 'cliente_telefone,user_id', ignoreDuplicates: true });
          }
        }
      }
    }
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
    }
  };


  const fetchStatusAlertRules = async (): Promise<StatusAlertRule[]> => {
    const { data } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", STATUS_ALERT_CONFIG_KEY)
      .maybeSingle();

    const rules = parseStatusAlertRules(data?.valor);
    setStatusAlertRules(rules);
    statusAlertRulesRef.current = rules;
    return rules;
  };

  // Manter ref sincronizado com state para que closures antigas usem regras atuais
  useEffect(() => {
    statusAlertRulesRef.current = statusAlertRules;
  }, [statusAlertRules]);

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
    if (!user?.id) return;

    if (currentState) {
      // Mark as read: clear manual_unread_at and set last_read_at to now
      const { error } = await (supabase as any)
        .from('mensagem_leitura_operador')
        .upsert(
          { cliente_telefone: telefone, user_id: user.id, last_read_at: new Date().toISOString(), manual_unread_at: null },
          { onConflict: 'cliente_telefone,user_id' }
        );
      if (error) {
        toast.error("Erro ao marcar conversa");
        return;
      }
    } else {
      // Mark as unread: set manual_unread_at to now
      const { error } = await (supabase as any)
        .from('mensagem_leitura_operador')
        .upsert(
          { cliente_telefone: telefone, user_id: user.id, manual_unread_at: new Date().toISOString() },
          { onConflict: 'cliente_telefone,user_id' }
        );
      if (error) {
        toast.error("Erro ao marcar conversa");
        return;
      }
    }

    toast.success(currentState ? "Conversa marcada como lida" : "Conversa marcada como não lida");
    setClientes(prev => prev.map(c => 
      c.telefone === telefone 
        ? { ...c, marcado_nao_lido: !currentState }
        : c
    ));
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
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-base md:text-lg">
                {showArchived ? "Arquivadas" : "Conversas"}
              </h2>
              {/* Toggle Meus/Todos - only show when filters are NOT externalized */}
              {!hideFilters && !showArchived && (
                <ToggleGroup 
                  type="single" 
                  value={effectiveTicketView} 
                  onValueChange={(value) => value && setTicketView(value as "meus" | "todos")}
                  className="h-7"
                >
                  <ToggleGroupItem value="meus" aria-label="Meus tickets" className="h-7 px-2 text-xs">
                    <User className="h-3 w-3 mr-1" />
                    Meus
                  </ToggleGroupItem>
                  <ToggleGroupItem value="todos" aria-label="Todos os tickets" className="h-7 px-2 text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    Todos
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            </div>
          )}
          <div className="flex items-center gap-1">
            {!isCollapsed && (
              <NovaConversaDialog onContactCreated={(cliente) => {
                fetchClientes();
              }} />
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
        </div>

        {!isCollapsed && (
          <>
            {/* Search bar - always visible */}
            <div className="space-y-1.5">
              <Select
                value={searchMode}
                onValueChange={(v) => setSearchMode(v as any)}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder="Buscar por..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ficha" className="text-xs">Nome / Telefone / Ficha</SelectItem>
                  <SelectItem value="prestador" className="text-xs">Prestador</SelectItem>
                  <SelectItem value="descricao" className="text-xs">Descrição</SelectItem>
                  <SelectItem value="id_ficha" className="text-xs">Nº da Ficha</SelectItem>
                  <SelectItem value="mensagem" className="text-xs">Mensagens</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={
                    searchMode === 'ficha' ? "Buscar..." : 
                    searchMode === 'prestador' ? "Buscar prestador..." : 
                    searchMode === 'descricao' ? "Buscar descrição..." :
                    searchMode === 'id_ficha' ? "Buscar nº ficha..." :
                    "Buscar nas mensagens..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>

            {/* Filter controls - only when NOT externalized */}
            {!hideFilters && (
              <>
                {/* Indicador de bots desabilitados */}
                {clientes.filter(c => c.bot_habilitado === false && c.bot_desativado_notificacao_vista === false && c.bot_desligado_manualmente === false).length > 0 && (
                  <Button
                    variant={effectiveShowBotDisabledOnly ? "default" : "outline"}
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

                {/* Filtros + Tags */}
                <div className="flex gap-1.5">
                  <FilterDropdown
                    statusFilter={effectiveStatusFilter}
                    conversaFilter={effectiveConversaFilter}
                    botFilter={effectiveBotFilter}
                    fichaFilter={effectiveFichaFilter}
                    pagamentoFilter={effectivePagamentoFilter}
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
                          {effectiveSelectedTags.length > 0 ? (
                            <Badge variant="default" className="ml-auto h-4 px-1 text-[10px]">
                              {effectiveSelectedTags.length}
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
                                  variant={effectiveSelectedTags.includes(tag) ? "default" : "outline"}
                                  className="cursor-pointer text-xs h-6 transition-all hover:scale-105"
                                  onClick={() => toggleTag(tag)}
                                  style={{
                                    backgroundColor: effectiveSelectedTags.includes(tag) ? tagColor : 'transparent',
                                    borderColor: tagColor,
                                    color: effectiveSelectedTags.includes(tag) ? '#FFFFFF' : tagColor
                                  }}
                                >
                                  {tag}
                                </Badge>
                              );
                            })}
                          </div>
                          {effectiveSelectedTags.length > 0 && (
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

                {/* Ativas / Inativas / Todas + Botão Selecionar */}
                <div className="flex gap-1">
                  <ToggleGroup 
                    type="single" 
                    value={effectiveConversaStatusFilter} 
                    onValueChange={(value) => value && setConversaStatusFilter(value as "ativas" | "inativas" | "todas")}
                    className="flex-1"
                  >
                    <ToggleGroupItem value="ativas" aria-label="Ativas" className="flex-1 h-7 text-xs">
                      Ativas
                    </ToggleGroupItem>
                    <ToggleGroupItem value="inativas" aria-label="Inativas" className="flex-1 h-7 text-xs">
                      Inativas
                    </ToggleGroupItem>
                    <ToggleGroupItem value="todas" aria-label="Todas" className="flex-1 h-7 text-xs">
                      Todas
                    </ToggleGroupItem>
                  </ToggleGroup>
                  
                  <Button
                    variant={selectionMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (selectionMode) {
                        setSelectionMode(false);
                        setSelectedClientes(new Set());
                      } else {
                        setSelectionMode(true);
                      }
                    }}
                    className="h-7 px-2"
                    title={selectionMode ? "Cancelar seleção" : "Selecionar múltiplos"}
                  >
                    {selectionMode ? (
                      <X className="h-3.5 w-3.5" />
                    ) : (
                      <CheckSquare className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                {/* Todas / Não Lidas */}
                <div className="flex gap-1">
                  <Button
                    variant={effectiveUnreadFilter === "todas" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUnreadFilter("todas")}
                    className="flex-1 h-7 text-xs"
                  >
                    Todas
                  </Button>
                  <Button
                    variant={effectiveUnreadFilter === "nao_lidas" ? "default" : "outline"}
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

            {/* Filters + Selection when hideFilters (Chat BETA mode) */}
            {hideFilters && (
              <>
                {/* Ativas / Inativas / Todas + Todas / Não Lidas */}
                <div className="flex gap-1.5">
                  <Select
                    value={effectiveConversaStatusFilter}
                    onValueChange={(v) => onExternalConversaStatusFilterChange?.(v as "ativas" | "inativas" | "todas")}
                  >
                    <SelectTrigger className="h-7 text-[11px] flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativas" className="text-xs">Ativas</SelectItem>
                      <SelectItem value="inativas" className="text-xs">Inativas</SelectItem>
                      <SelectItem value="todas" className="text-xs">Todas</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={effectiveUnreadFilter}
                    onValueChange={(v) => onExternalUnreadFilterChange?.(v as "todas" | "lidas" | "nao_lidas")}
                  >
                    <SelectTrigger className="h-7 text-[11px] flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas" className="text-xs">Todas</SelectItem>
                      <SelectItem value="nao_lidas" className="text-xs">
                        Não Lidas {(externalUnreadCount ?? unreadCount) > 0 ? `(${externalUnreadCount ?? unreadCount})` : ''}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-1">
                  <Button
                    variant={selectionMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (selectionMode) {
                        setSelectionMode(false);
                        setSelectedClientes(new Set());
                      } else {
                        setSelectionMode(true);
                      }
                    }}
                    className="h-7 px-2"
                    title={selectionMode ? "Cancelar seleção" : "Selecionar múltiplos"}
                  >
                    {selectionMode ? (
                      <X className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <CheckSquare className="h-3.5 w-3.5 mr-1" />
                    )}
                    <span className="text-xs">{selectionMode ? "Cancelar" : "Selecionar"}</span>
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <ScrollArea className="flex-1">
        {!isCollapsed && (
          // Vista expandida - mostra cards completos
          <>
            {isLoading ? (
              // ✅ Skeleton loading para melhor UX
              <div className="space-y-1">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="p-2.5 md:p-3 border-b">
                    <div className="flex gap-1 mb-1.5">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <div className="flex justify-between mb-1">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-4 w-40 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            ) : (isSearchingById || isSearchingByMessage) ? (
              <div className="flex items-center justify-center p-8 text-center">
                <p className="text-muted-foreground text-sm">Buscando...</p>
              </div>
            ) : filteredClientes.length === 0 ? (
              <div className="flex items-center justify-center p-8 text-center">
                <p className="text-muted-foreground text-sm">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              filteredClientes.map((cliente) => (
                <div key={cliente.telefone} className="relative">
                  {/* Checkbox de seleção em massa */}
                  {selectionMode && (
                    <div 
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleClienteSelection(cliente.telefone);
                      }}
                    >
                      <Checkbox
                        checked={selectedClientes.has(cliente.telefone)}
                        onCheckedChange={() => toggleClienteSelection(cliente.telefone)}
                        className="h-5 w-5"
                      />
                    </div>
                  )}
                  <div className={cn(selectionMode && "pl-8")}>
                    <ConversationCard
                      telefone={cliente.telefone}
                      nome={cliente.nome}
                      tags={cliente.tags || []}
                      tagsColors={tagsWithColors}
                      fichaId={cliente.nome_ficha}
                      fichaStatus={cliente.status_ficha}
                      statusConversa={cliente.status_conversa}
                      ultimaInteracao={cliente.ultima_interacao}
                      isSelected={selectedClienteTelefone === cliente.telefone}
                      unreadCount={cliente.marcado_nao_lido ? 1 : 0}
                      onClick={() => {
                        if (selectionMode) {
                          toggleClienteSelection(cliente.telefone);
                        } else {
                          // Limpar destaque de orçamento ao abrir conversa
                          if (cliente.ficha_id_real && recentOrcamentoFichas.has(cliente.ficha_id_real)) {
                            setRecentOrcamentoFichas(prev => {
                              const next = new Set(prev);
                              next.delete(cliente.ficha_id_real!);
                              return next;
                            });
                          }
                          // ✅ Limpar marcado_nao_lido localmente de imediato
                          setClientes(prev => prev.map(c => 
                            c.telefone === cliente.telefone 
                              ? { ...c, marcado_nao_lido: false }
                              : c
                          ));
                          onSelectCliente(cliente);
                        }
                      }}
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
                      semOrcamento={clientesSemOrcamento.has(cliente.telefone)}
                      pagamentoLink={cliente.pagamento_link}
                      pagamentoRealizado={cliente.pagamento_realizado}
                      statusAlertColor={cliente.statusAlertColor}
                      tempoNoStatusMinutos={cliente.tempoNoStatusMinutos}
                      hasNewOrcamento={!!cliente.ficha_id_real && recentOrcamentoFichas.has(cliente.ficha_id_real)}
                    />
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </ScrollArea>

      {/* 🆕 Barra de ações de seleção em massa */}
      {selectionMode && selectedClientes.size > 0 && !isCollapsed && (
        <div className="p-3 border-t bg-background space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedClientes.size} conversa(s) selecionada(s)
            </span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setSelectedClientes(new Set());
                setSelectionMode(false);
              }}
            >
              Cancelar
            </Button>
          </div>
          <div className="flex gap-2">
            <Select onValueChange={(value) => atribuirEmMassa(value)}>
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder="Atribuir para..." />
              </SelectTrigger>
              <SelectContent>
                {todosAtendentes.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Botão flutuante de arquivados */}
      {!isCollapsed && !selectionMode && (
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
