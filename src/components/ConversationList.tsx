import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TagManager } from "./TagManager";

interface Cliente {
  telefone: string;
  nome: string;
  status_conversa: "aberta" | "fechada";
  ultima_interacao: string;
  tags: string[];
  nome_ficha?: string;
}

interface ConversationListProps {
  selectedClienteTelefone: string | null;
  onSelectCliente: (cliente: Cliente) => void;
}

export const ConversationList = ({ selectedClienteTelefone, onSelectCliente }: ConversationListProps) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todas" | "aberta" | "fechada">("todas");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

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

    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.telefone.includes(searchTerm) ||
        (c.nome_ficha && c.nome_ficha.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (statusFilter !== "todas") {
      filtered = filtered.filter(c => c.status_conversa === statusFilter);
    }

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
  }, [clientes, searchTerm, statusFilter, selectedTags]);

  const fetchClientes = async () => {
    const { data: clientesData, error } = await supabase
      .from('clientes')
      .select('*')
      .order('ultima_interacao', { ascending: false });

    if (!error && clientesData) {
      // Buscar nome da última ficha de cada cliente
      const clientesComFicha = await Promise.all(
        clientesData.map(async (cliente) => {
          const { data: fichaData } = await supabase
            .from('fichas_de_servico')
            .select('nome_ficha')
            .eq('telefone_cliente', cliente.telefone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...cliente,
            nome_ficha: fichaData?.nome_ficha || undefined
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

  return (
    <div className="h-full flex flex-col bg-card border-r">
      <div className="p-4 border-b space-y-3">
        <h2 className="font-semibold text-lg">Conversas</h2>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou ficha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={statusFilter === "todas" ? "default" : "outline"}
            onClick={() => setStatusFilter("todas")}
            className="flex-1"
          >
            Todas
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "aberta" ? "default" : "outline"}
            onClick={() => setStatusFilter("aberta")}
            className="flex-1"
          >
            Abertas
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "fechada" ? "default" : "outline"}
            onClick={() => setStatusFilter("fechada")}
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

      <div className="flex-1 overflow-y-auto">
        {filteredClientes.map((cliente) => (
          <div
            key={cliente.telefone}
            onClick={() => onSelectCliente(cliente)}
            className={cn(
              "p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors",
              selectedClienteTelefone === cliente.telefone && "bg-muted"
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h3 className="font-medium truncate">{cliente.nome}</h3>
                <Circle 
                  className={cn(
                    "h-2 w-2 fill-current shrink-0",
                    cliente.status_conversa === "aberta" ? "text-green-500" : "text-gray-400"
                  )} 
                />
                {cliente.nome_ficha && (
                  <span className="text-xs text-muted-foreground truncate">
                    • {cliente.nome_ficha}
                  </span>
                )}
              </div>
              <TagManager 
                clienteTelefone={cliente.telefone} 
                currentTags={cliente.tags || []} 
                onTagsUpdate={fetchClientes}
              />
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">{cliente.telefone}</p>
            
            {cliente.tags && cliente.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {cliente.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              {format(new Date(cliente.ultima_interacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};