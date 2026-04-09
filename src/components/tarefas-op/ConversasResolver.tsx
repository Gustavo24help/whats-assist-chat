import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FichaItem {
  id: string;
  nome_ficha: string | null;
  nome_cliente: string | null;
  telefone_cliente: string;
  status: string | null;
  prestador_id: string | null;
  prestador_nome?: string;
  updated_at: string | null;
}

const STATUS_FINAIS = ["Finalizado", "Perdido", "Não foi adiante"];

const statusColors: Record<string, string> = {
  "Ficha Criada": "bg-gray-100 text-gray-800",
  "Em Orçamento": "bg-yellow-100 text-yellow-800",
  "Orçamento Pronto": "bg-blue-100 text-blue-800",
  "Agendado": "bg-green-100 text-green-800",
  "Visita Técnica": "bg-purple-100 text-purple-800",
  "Retorno": "bg-orange-100 text-orange-800",
};

export const ConversasResolver = () => {
  const navigate = useNavigate();
  const [fichas, setFichas] = useState<FichaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    loadFichas();
  }, []);

  const loadFichas = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("fichas_de_servico")
      .select("id, nome_ficha, nome_cliente, telefone_cliente, status, prestador_id, updated_at")
      .not("status", "in", `(${STATUS_FINAIS.map(s => `"${s}"`).join(",")})`)
      .order("updated_at", { ascending: true });

    if (!error && data) {
      const prestadorIds = [...new Set(data.filter(f => f.prestador_id).map(f => f.prestador_id!))];
      let prestadorMap: Record<string, string> = {};

      if (prestadorIds.length > 0) {
        const { data: prestadores } = await supabase
          .from("prestadores")
          .select("cpf, nome")
          .in("cpf", prestadorIds);
        prestadores?.forEach(p => { prestadorMap[p.cpf] = p.nome; });
      }

      setFichas(data.map(f => ({
        ...f,
        prestador_nome: f.prestador_id ? prestadorMap[f.prestador_id] || "—" : "—",
      })));
    }

    setLoading(false);
  };

  const filtered = statusFilter === "all"
    ? fichas
    : fichas.filter(f => f.status === statusFilter);

  const uniqueStatuses = [...new Set(fichas.map(f => f.status).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {uniqueStatuses.map(s => (
              <SelectItem key={s!} value={s!}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} fichas</span>
      </div>

      <ScrollArea className="h-[calc(100vh-250px)]">
        <div className="space-y-2">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma ficha pendente</p>
          ) : (
            filtered.map(f => (
              <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{f.id}</span>
                    <Badge variant="secondary" className={statusColors[f.status || ""] || "bg-muted"}>
                      {f.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {f.nome_cliente || "—"} • Prestador: {f.prestador_nome}
                  </p>
                  {f.updated_at && (
                    <p className="text-xs text-muted-foreground">
                      Atualizado {formatDistanceToNow(new Date(f.updated_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/chat?telefone=${encodeURIComponent(f.telefone_cliente)}`)}
                  className="shrink-0 gap-1"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Conversa
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
