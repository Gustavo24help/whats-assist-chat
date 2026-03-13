import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Phone,
  User,
  MessageCircle,
  Clock,
  Bot,
  BotOff,
  FileText,
  SortAsc,
  SortDesc,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AbrirConversaDialog } from "./AbrirConversaDialog";

interface Cliente {
  telefone: string;
  nome: string;
  tags: string[];
  ultima_interacao: string | null;
  status_conversa: string;
  bot_habilitado: boolean;
  ficha_ativa_id: string | null;
  created_at: string;
  arquivado: boolean;
}

interface ContactsTabProps {
  onSelectCliente: (cliente: Cliente) => void;
  selectedClienteTelefone: string | null;
}

type SortField = 'nome' | 'ultima_interacao' | 'created_at';
type SortOrder = 'asc' | 'desc';

const CONTACTS_PAGE_SIZE = 1000;

const normalizeForSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const ContactsTab = ({ onSelectCliente, selectedClienteTelefone }: ContactsTabProps) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    fetchClientes();

    // Realtime subscription
    const channel = supabase
      .channel("contacts-tab-clientes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clientes" },
        () => {
          fetchClientes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchClientes = async () => {
    try {
      let from = 0;
      const allClientes: Cliente[] = [];

      while (true) {
        const { data, error } = await supabase
          .from("clientes")
          .select("telefone, nome, tags, ultima_interacao, status_conversa, bot_habilitado, ficha_ativa_id, created_at, arquivado")
          .eq("arquivado", false)
          .order("nome", { ascending: true })
          .range(from, from + CONTACTS_PAGE_SIZE - 1);

        if (error) throw error;

        const batch = (data || []) as Cliente[];
        if (batch.length === 0) break;

        allClientes.push(...batch);

        if (batch.length < CONTACTS_PAGE_SIZE) break;
        from += CONTACTS_PAGE_SIZE;
      }

      setClientes(allClientes);
    } catch (error) {
      console.error("Erro ao buscar contatos:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedClientes = useMemo(() => {
    let filtered = clientes;

    // Apply search filter
    if (searchTerm.trim()) {
      const term = normalizeForSearch(searchTerm.trim());
      const phoneTerm = searchTerm.replace(/\D/g, '');

      filtered = clientes.filter((c) => {
        const nome = normalizeForSearch(c.nome || '');
        const phone = c.telefone.replace(/\D/g, '');

        return nome.includes(term) || (phoneTerm.length > 0 && phone.includes(phoneTerm));
      });
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortField === 'nome') {
        comparison = a.nome.localeCompare(b.nome, 'pt-BR');
      } else if (sortField === 'ultima_interacao') {
        const dateA = a.ultima_interacao ? new Date(a.ultima_interacao).getTime() : 0;
        const dateB = b.ultima_interacao ? new Date(b.ultima_interacao).getTime() : 0;
        comparison = dateA - dateB;
      } else if (sortField === 'created_at') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        comparison = dateA - dateB;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [clientes, searchTerm, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace('whatsapp:+', '+');
    return cleaned;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <SortAsc className="h-3.5 w-3.5 ml-1" />
    ) : (
      <SortDesc className="h-3.5 w-3.5 ml-1" />
    );
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Contatos</h2>
          <Badge variant="secondary" className="font-mono">
            {clientes.length}
          </Badge>
        </div>
        
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('nome')}
              >
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Nome
                  <SortIcon field="nome" />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-2" />
                  Telefone
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('ultima_interacao')}
              >
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Última Interação
                  <SortIcon field="ultima_interacao" />
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedClientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "Nenhum contato encontrado" : "Nenhum contato cadastrado"}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedClientes.map((cliente) => (
                <TableRow
                  key={cliente.telefone}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 transition-colors",
                    selectedClienteTelefone === cliente.telefone && "bg-muted"
                  )}
                  onClick={() => onSelectCliente(cliente)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-primary">
                          {cliente.nome.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{cliente.nome}</p>
                        {cliente.tags && cliente.tags.length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {cliente.tags.slice(0, 2).map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] px-1 py-0">
                                {tag}
                              </Badge>
                            ))}
                            {cliente.tags.length > 2 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{cliente.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">
                      {formatPhone(cliente.telefone)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {cliente.ultima_interacao ? (
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(cliente.ultima_interacao), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span title={cliente.bot_habilitado ? "Bot ativo" : "Bot desativado"}>
                        {cliente.bot_habilitado ? (
                          <Bot className="h-4 w-4 text-green-600" />
                        ) : (
                          <BotOff className="h-4 w-4 text-orange-500" />
                        )}
                      </span>
                      {cliente.ficha_ativa_id && (
                        <span title="Tem ficha ativa">
                          <FileText className="h-4 w-4 text-primary" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <AbrirConversaDialog
                        clienteTelefone={cliente.telefone}
                        clienteNome={cliente.nome}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCliente(cliente);
                        }}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
};
