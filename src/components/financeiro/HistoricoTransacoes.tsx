import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Download, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, subMonths } from "date-fns";

const formatMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const PAGE_SIZE = 50;

export const HistoricoTransacoes = () => {
  const [transacoes, setTransacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Filters
  const [dataInicio, setDataInicio] = useState(() => format(subMonths(new Date(), 1), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [prestadorBusca, setPrestadorBusca] = useState("");
  const [statusCliente, setStatusCliente] = useState("todos");
  const [statusPrestador, setStatusPrestador] = useState("todos");

  const fetchData = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("transacoes_financeiras")
        .select("*", { count: "exact" })
        .gte("data_execucao", `${dataInicio}T00:00:00`)
        .lte("data_execucao", `${dataFim}T23:59:59`)
        .order("data_execucao", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (prestadorBusca) {
        query = query.ilike("prestador_nome", `%${prestadorBusca}%`);
      }
      if (statusCliente !== "todos") {
        query = query.eq("status_pagamento_cliente", statusCliente);
      }
      if (statusPrestador !== "todos") {
        query = query.eq("status_pagamento_prestador", statusPrestador);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      setTransacoes(data || []);
      setTotal(count || 0);
    } catch (e: any) {
      console.error("Erro ao carregar histórico:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page]);

  const handleFilter = () => {
    setPage(0);
    fetchData();
  };

  const totais = useMemo(() => {
    const valorCliente = transacoes.reduce((s, t) => s + (t.valor_cliente_final || 0), 0);
    const valorPrestador = transacoes.reduce((s, t) => s + (t.valor_a_pagar_prestador || 0), 0);
    const lucro = transacoes.reduce((s, t) => s + (t.valor_lucro_bruto || 0), 0);
    const margem = transacoes.length > 0
      ? transacoes.reduce((s, t) => s + (t.margem_operacional_real || 0), 0) / transacoes.length
      : 0;
    return { valorCliente, valorPrestador, lucro, margem };
  }, [transacoes]);

  const exportCSV = async () => {
    // Exporta até 5.000 linhas respeitando os filtros atuais (paginando 1.000 por requisição)
    const MAX_EXPORT = 5000;
    const PAGE = 1000;
    const buildQuery = () => {
      let q = supabase
        .from("transacoes_financeiras")
        .select("*")
        .gte("data_execucao", `${dataInicio}T00:00:00`)
        .lte("data_execucao", `${dataFim}T23:59:59`)
        .order("data_execucao", { ascending: false });
      if (prestadorBusca) q = q.ilike("prestador_nome", `%${prestadorBusca}%`);
      if (statusCliente !== "todos") q = q.eq("status_pagamento_cliente", statusCliente);
      if (statusPrestador !== "todos") q = q.eq("status_pagamento_prestador", statusPrestador);
      return q;
    };

    const all: any[] = [];
    let truncated = false;
    try {
      for (let from = 0; from < MAX_EXPORT; from += PAGE) {
        const to = Math.min(from + PAGE - 1, MAX_EXPORT - 1);
        const { data, error } = await buildQuery().range(from, to);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < (to - from + 1)) break;
        if (all.length >= MAX_EXPORT) { truncated = true; break; }
      }
    } catch (e) {
      console.error("Erro ao exportar CSV:", e);
      return;
    }

    const BOM = "\uFEFF";
    const headers = ["Data Execução", "Ficha", "Prestador", "Categoria", "Valor Cliente", "Valor Prestador", "Lucro", "Margem %", "Status Cliente", "Status Prestador"];
    const rows = all.map((t) => [
      format(parseISO(t.data_execucao), "dd/MM/yyyy HH:mm"),
      t.ficha_id,
      t.prestador_nome,
      t.categoria || "",
      (t.valor_cliente_final || 0).toFixed(2).replace(".", ","),
      (t.valor_a_pagar_prestador || 0).toFixed(2).replace(".", ","),
      (t.valor_lucro_bruto || 0).toFixed(2).replace(".", ","),
      (t.margem_operacional_real || 0).toFixed(1).replace(".", ","),
      t.status_pagamento_cliente,
      t.status_pagamento_prestador,
    ]);
    const csv = BOM + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico_financeiro_${dataInicio}_${dataFim}${truncated ? "_5000linhas" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data Início</label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data Fim</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Prestador</label>
            <Input placeholder="Buscar..." value={prestadorBusca} onChange={(e) => setPrestadorBusca(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status Cliente</label>
            <Select value={statusCliente} onValueChange={setStatusCliente}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status Prestador</label>
            <Select value={statusPrestador} onValueChange={setStatusPrestador}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleFilter} className="flex-1">
              <Search className="h-4 w-4 mr-1" /> Filtrar
            </Button>
            <Button variant="outline" onClick={exportCSV} title="Exportar CSV">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Carregando...</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ficha</TableHead>
                    <TableHead>Prestador</TableHead>
                    <TableHead className="text-right">Valor Cliente</TableHead>
                    <TableHead className="text-right">Valor Prestador</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead>Status Cli.</TableHead>
                    <TableHead>Status Prest.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transacoes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Nenhuma transação encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    transacoes.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(parseISO(t.data_execucao), "dd/MM/yy")}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{t.ficha_id}</TableCell>
                        <TableCell className="text-sm max-w-[150px] truncate">{t.prestador_nome}</TableCell>
                        <TableCell className="text-right text-sm">{formatMoeda(t.valor_cliente_final)}</TableCell>
                        <TableCell className="text-right text-sm">{formatMoeda(t.valor_a_pagar_prestador)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatMoeda(t.valor_lucro_bruto)}</TableCell>
                        <TableCell className="text-right text-sm">{(t.margem_operacional_real || 0).toFixed(1)}%</TableCell>
                        <TableCell>
                          <Badge variant={t.status_pagamento_cliente === "pago" ? "default" : "destructive"} className="text-[10px]">
                            {t.status_pagamento_cliente}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.status_pagamento_prestador === "pago" ? "default" : "secondary"} className="text-[10px]">
                            {t.status_pagamento_prestador}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {transacoes.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="font-semibold">Totais da página</TableCell>
                      <TableCell className="text-right font-bold">{formatMoeda(totais.valorCliente)}</TableCell>
                      <TableCell className="text-right font-bold">{formatMoeda(totais.valorPrestador)}</TableCell>
                      <TableCell className="text-right font-bold">{formatMoeda(totais.lucro)}</TableCell>
                      <TableCell className="text-right font-bold">{totais.margem.toFixed(1)}%</TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <span className="text-xs text-muted-foreground">{total} transações</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{page + 1} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};
