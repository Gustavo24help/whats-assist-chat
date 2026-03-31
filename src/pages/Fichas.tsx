import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/Logo";
import { ArrowLeft, Search, ChevronLeft, ChevronRight, FileText, Loader2, CalendarCog } from "lucide-react";
import { AjustarDataFinalizacaoDialog } from "@/components/AjustarDataFinalizacaoDialog";
import { PageLayout } from "@/components/PageLayout";

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  "Todos",
  "Ficha Criada", "Contato Inicial", "Dúvida Prestador", "Orçamento Enviado",
  "Negociação", "Visita Técnica", "Orçamento Aprovado / Agendamento",
  "Agendado", "Em andamento", "Finalizado", "Garantia", "Perdido", "Não foi adiante",
];

const statusColor = (s: string) => {
  if (s === "Finalizado") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (s === "Agendado") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  if (s === "Em andamento") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  if (s === "Perdido") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  return "bg-muted text-muted-foreground";
};

interface FichaRow {
  id: string;
  nome_ficha: string | null;
  nome_cliente: string | null;
  telefone_cliente: string;
  status: string;
  valor_total: number;
  prestador_id: string | null;
  created_at: string;
  updated_at: string;
  cliente_nome_resolved?: string;
  prestador_nome_resolved?: string;
}

const Fichas = () => {
  const navigate = useNavigate();
  const [fichas, setFichas] = useState<FichaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [ajustarFicha, setAjustarFicha] = useState<FichaRow | null>(null);

  const fetchFichas = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("fichas_de_servico")
        .select("id, nome_ficha, nome_cliente, telefone_cliente, status, valor_total, prestador_id, created_at, updated_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "Todos") {
        query = query.eq("status", statusFilter as any);
      }

      if (search.trim()) {
        // Search across multiple fields using OR
        query = query.or(`id.ilike.%${search}%,nome_ficha.ilike.%${search}%,nome_cliente.ilike.%${search}%,telefone_cliente.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const items = data || [];
      setTotal(count || 0);

      // Resolve names
      const phones = [...new Set(items.map((f: any) => f.telefone_cliente))];
      const prestadorIds = [...new Set(items.map((f: any) => f.prestador_id).filter(Boolean))];

      const [clientesRes, prestadoresRes] = await Promise.all([
        phones.length > 0 ? supabase.from("clientes").select("telefone, nome").in("telefone", phones) : { data: [] },
        prestadorIds.length > 0 ? supabase.from("prestadores").select("cpf, nome").in("cpf", prestadorIds as string[]) : { data: [] },
      ]);

      const clienteMap = new Map((clientesRes.data || []).map((c: any) => [c.telefone, c.nome]));
      const prestadorMap = new Map((prestadoresRes.data || []).map((p: any) => [p.cpf, p.nome]));

      setFichas(items.map((f: any) => ({
        ...f,
        cliente_nome_resolved: f.nome_cliente || clienteMap.get(f.telefone_cliente) || f.telefone_cliente.replace("whatsapp:+55", ""),
        prestador_nome_resolved: f.prestador_id ? (prestadorMap.get(f.prestador_id) || f.prestador_id) : null,
      })));
    } catch (e) {
      console.error("Erro ao carregar fichas:", e);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchFichas();
  }, [fetchFichas]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const formatMoeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-foreground">Fichas de Serviço</h1>
              <p className="text-xs text-muted-foreground">{total} fichas encontradas</p>
            </div>
          </div>
          <Logo />
        </div>
      </header>

      {/* Filters */}
      <div className="px-4 py-3 md:px-6 flex flex-wrap gap-3 items-center border-b bg-muted/30">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID, nome, telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <main className="flex-1 px-4 py-4 md:px-6 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : fichas.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma ficha encontrada</p>
          </div>
        ) : (
          fichas.map((f) => (
            <Card
              key={f.id}
              className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/ficha/${f.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-semibold text-primary">{f.id}</span>
                    <Badge className={`text-[10px] ${statusColor(f.status)}`}>{f.status}</Badge>
                  </div>
                  <p className="text-sm font-medium truncate">{f.cliente_nome_resolved}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.prestador_nome_resolved ? `Prestador: ${f.prestador_nome_resolved}` : "Sem prestador"}
                    {" • "}
                    {new Date(f.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4 flex items-center gap-2">
                  {f.status === "Finalizado" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-orange-600 hover:bg-orange-50"
                      title="Ajustar data de finalização"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAjustarFicha(f);
                      }}
                    >
                      <CalendarCog className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="font-bold text-sm">{formatMoeda(f.valor_total || 0)}</div>
                </div>
              </div>
            </Card>
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages} ({total} fichas)
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>

      <AjustarDataFinalizacaoDialog
        open={!!ajustarFicha}
        onOpenChange={(open) => { if (!open) setAjustarFicha(null); }}
        fichaId={ajustarFicha?.id || ""}
        prestadorNome={ajustarFicha?.prestador_nome_resolved}
        prestadorId={ajustarFicha?.prestador_id}
        onAjustado={() => fetchFichas()}
      />
    </div>
  );
};

export default Fichas;
