import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationCard } from "./ConversationCard";
import { TagManager } from "./TagManager";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Cliente {
  telefone: string;
  nome: string;
  status_conversa: "aberta" | "fechada";
  ultima_interacao: string;
  tags: string[];
  nome_ficha?: string;
  status_ficha?: string;
  unread_count?: number;
}

interface ConversationListProps {
  selectedClienteTelefone: string | null;
  onSelectCliente: (cliente: Cliente) => void;
  unreadMessages: Record<string, number>;
}

export const ConversationList = ({ selectedClienteTelefone, onSelectCliente, unreadMessages }: ConversationListProps) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [conversaFilter, setConversaFilter] = useState<"todas" | "aberta" | "fechada">("todas");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [currentTagClient, setCurrentTagClient] = useState<string | null>(null);

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

    // Filtro por status da conversa
    if (conversaFilter !== "todas") {
      filtered = filtered.filter(c => c.status_conversa === conversaFilter);
    }

    // Filtro por tags selecionadas
    if (selectedTags.length > 0) {
      filtered = filtered.filter(c => 
        c.tags && selectedTags.some(tag => c.tags.includes(tag))
      );
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
  }, [clientes, searchTerm, statusFilter, conversaFilter, selectedTags]);

  const fetchClientes = async () => {
    const { data: clientesData, error } = await supabase
      .from('clientes')
      .select('*')
      .order('ultima_interacao', { ascending: false });

    if (!error && clientesData) {
      // Buscar nome e status da última ficha de cada cliente
      const clientesComFicha = await Promise.all(
        clientesData.map(async (cliente) => {
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
            unread_count: unreadMessages[cliente.telefone] || 0
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
    toast.info("Funcionalidade de arquivar em desenvolvimento");
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

  return (
    <div className="h-full flex flex-col bg-card border-r">
      <div className="p-3 md:p-4 border-b space-y-2 md:space-y-3">
        <h2 className="font-semibold text-base md:text-lg">Conversas</h2>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, ficha ou tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="Ficha Criada">Ficha Criada</SelectItem>
            <SelectItem value="Contato Inicial">Contato Inicial</SelectItem>
            <SelectItem value="Orçamento Enviado">Orçamento Enviado</SelectItem>
            <SelectItem value="Agendado">Agendado</SelectItem>
            <SelectItem value="Em andamento">Em Andamento</SelectItem>
            <SelectItem value="Finalizado">Finalizado</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={conversaFilter === "todas" ? "default" : "outline"}
            onClick={() => setConversaFilter("todas")}
            className="flex-1"
          >
            Todas
          </Button>
          <Button
            size="sm"
            variant={conversaFilter === "aberta" ? "default" : "outline"}
            onClick={() => setConversaFilter("aberta")}
            className="flex-1"
          >
            Abertas
          </Button>
          <Button
            size="sm"
            variant={conversaFilter === "fechada" ? "default" : "outline"}
            onClick={() => setConversaFilter("fechada")}
            className="flex-1"
          >
            Fechadas
          </Button>
        </div>

        {allTags.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Filtrar por tags:</p>
            <div className="flex flex-wrap gap-1">
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        {filteredClientes.map((cliente) => (
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
          />
        ))}
      </ScrollArea>

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
