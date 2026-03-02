import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { NovoAdiantamentoDialog } from "./NovoAdiantamentoDialog";

const formatMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

export const AdiantamentosTab = () => {
  const [adiantamentos, setAdiantamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("todos");
  const [prestadorBusca, setPrestadorBusca] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("adiantamentos")
        .select("*")
        .order("data_adiantamento", { ascending: false })
        .limit(200);

      if (statusFilter !== "todos") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = data || [];

      // Client-side filter for prestador name (need to join)
      if (prestadorBusca) {
        const { data: prestadores } = await supabase
          .from("prestadores")
          .select("cpf, nome")
          .ilike("nome", `%${prestadorBusca}%`);
        const cpfs = new Set((prestadores || []).map((p: any) => p.cpf));
        results = results.filter((a: any) => cpfs.has(a.prestador_id));
      }

      // Enrich with prestador names
      const uniqueCpfs = [...new Set(results.map((a: any) => a.prestador_id))];
      if (uniqueCpfs.length > 0) {
        const { data: prestadores } = await supabase
          .from("prestadores")
          .select("cpf, nome")
          .in("cpf", uniqueCpfs);
        const nameMap: Record<string, string> = {};
        (prestadores || []).forEach((p: any) => { nameMap[p.cpf] = p.nome; });
        results = results.map((a: any) => ({ ...a, prestador_nome: nameMap[a.prestador_id] || a.prestador_id }));
      }

      setAdiantamentos(results);
    } catch (e) {
      console.error("Erro ao carregar adiantamentos:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFilter = () => fetchData();

  const totalPendente = adiantamentos
    .filter((a) => a.status === "pendente")
    .reduce((s, a) => s + (a.valor || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary + Actions */}
      <div className="flex items-center justify-between">
        <Card className="p-3 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <div className="text-xs text-amber-600 dark:text-amber-400">Total Pendente</div>
          <div className="text-xl font-bold text-amber-900 dark:text-amber-300">{formatMoeda(totalPendente)}</div>
        </Card>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Adiantamento
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="compensado">Compensado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Prestador</label>
            <Input placeholder="Buscar..." value={prestadorBusca} onChange={(e) => setPrestadorBusca(e.target.value)} />
          </div>
          <Button onClick={handleFilter}>
            <Search className="h-4 w-4 mr-1" /> Filtrar
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Prestador</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Ficha</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Compensado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adiantamentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum adiantamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                adiantamentos.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(parseISO(a.data_adiantamento), "dd/MM/yy")}
                    </TableCell>
                    <TableCell className="text-sm">{a.prestador_nome || a.prestador_id}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoeda(a.valor)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{a.motivo || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{a.ficha_id || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        className={a.status === "pendente"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }
                      >
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {a.compensado_em ? format(parseISO(a.compensado_em), "dd/MM/yy") : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <NovoAdiantamentoDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchData} />
    </div>
  );
};
