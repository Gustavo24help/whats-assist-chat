import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Circle, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  status_conversa: "aberta" | "fechada";
  ultima_interacao: string;
  tags: string[];
}

interface ConversationListProps {
  selectedClienteId: string | null;
  onSelectCliente: (cliente: Cliente) => void;
}

export const ConversationList = ({ selectedClienteId, onSelectCliente }: ConversationListProps) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todas" | "aberta" | "fechada">("todas");

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
        c.telefone.includes(searchTerm)
      );
    }

    if (statusFilter !== "todas") {
      filtered = filtered.filter(c => c.status_conversa === statusFilter);
    }

    setFilteredClientes(filtered);
  }, [clientes, searchTerm, statusFilter]);

  const fetchClientes = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('ultima_interacao', { ascending: false });

    if (!error && data) {
      setClientes(data);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border-r">
      <div className="p-4 border-b space-y-3">
        <h2 className="font-semibold text-lg">Conversas</h2>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
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
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredClientes.map((cliente) => (
          <div
            key={cliente.id}
            onClick={() => onSelectCliente(cliente)}
            className={cn(
              "p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors",
              selectedClienteId === cliente.id && "bg-muted"
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{cliente.nome}</h3>
                <Circle 
                  className={cn(
                    "h-2 w-2 fill-current",
                    cliente.status_conversa === "aberta" ? "text-green-500" : "text-gray-400"
                  )} 
                />
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Edit2 className="h-3 w-3" />
              </Button>
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