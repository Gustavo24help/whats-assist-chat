import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Download, Search, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const formatMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const parseDateForDisplay = (d: string | null) => {
  if (!d) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12);
  }
  return new Date(d);
};

const formatDate = (d: string | null) => {
  if (!d) return "-";
  try {
    const parsed = parseDateForDisplay(d);
    return parsed && !Number.isNaN(parsed.getTime()) ? format(parsed, "dd/MM/yyyy") : "-";
  } catch { return "-"; }
};

interface RowData {
  row_key: string;
  ficha_id: string;
  cliente: string;
  prestador: string;
  data_conclusao: string | null;
  valor: number;
  valor_mo: number;
  cliente_pagou: boolean;
  data_pgto_prestador: string | null;
  pagamento_feito: boolean;
  link_asaas: string | null;
  valor_pago: number;
}

const PlanilhaControlePagamentos = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<"todos" | "pago" | "pendente">("todos");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: fichas } = await supabase
      .from("fichas_de_servico")
      .select("id, nome_cliente, telefone_cliente, prestador_id, valor_total, valor_mao_obra, pagamento_realizado, pagamento_link, updated_at")
      .in("status", ["Finalizado", "Em andamento"] as any)
      .gt("valor_total", 0)
      .order("updated_at", { ascending: false });

    const safeFichas = fichas || [];
    const prestadorIds = [...new Set(safeFichas.map((f: any) => f.prestador_id).filter(Boolean))];
    const phones = [...new Set(safeFichas.map((f: any) => f.telefone_cliente).filter(Boolean))];
    const fichaIds = safeFichas.map((f: any) => f.id);

    const [prestRes, clienteRes, transRes, manuaisRes] = await Promise.all([
      prestadorIds.length > 0
        ? supabase.from("prestadores").select("cpf, nome").in("cpf", prestadorIds)
        : { data: [] },
      phones.length > 0
        ? supabase.from("clientes").select("telefone, nome").in("telefone", phones)
        : { data: [] },
      fichaIds.length > 0
        ? supabase.from("transacoes_financeiras").select("ficha_id, status_pagamento_prestador, data_pagamento_realizada, valor_cliente_final").in("ficha_id", fichaIds)
        : { data: [] },
      (supabase as any).from("contas_pagar_manual").select("*").neq("status", "cancelado").order("created_at", { ascending: false }).limit(1000),
    ]);

    const prestMap = new Map((prestRes.data || []).map((p: any) => [p.cpf, p.nome]));
    const clienteMap = new Map((clienteRes.data || []).map((c: any) => [c.telefone, c.nome]));
    const transMap = new Map((transRes.data || []).map((t: any) => [t.ficha_id, t]));

    const mapped: RowData[] = safeFichas.map((f: any) => {
      const trans = transMap.get(f.id);
      return {
        row_key: `ficha:${f.id}`,
        ficha_id: f.id,
        cliente: f.nome_cliente || clienteMap.get(f.telefone_cliente) || f.telefone_cliente.replace("whatsapp:+55", ""),
        prestador: prestMap.get(f.prestador_id) || f.prestador_id || "-",
        data_conclusao: f.updated_at,
        valor: f.valor_total || 0,
        valor_mo: f.valor_mao_obra || 0,
        cliente_pagou: f.pagamento_realizado || false,
        data_pgto_prestador: trans?.data_pagamento_realizada || null,
        pagamento_feito: trans?.status_pagamento_prestador === "pago",
        link_asaas: f.pagamento_link || null,
        valor_pago: trans?.status_pagamento_prestador === "pago" ? (trans?.valor_cliente_final || f.valor_total || 0) : 0,
      };
    });

    const manuaisRows: RowData[] = ((manuaisRes as any)?.data || []).map((m: any) => {
      const pago = m.status === "pago";
      return {
        row_key: `manual:${m.id}`,
        ficha_id: m.ficha_id || `MAN-${String(m.id).slice(0, 8)}`,
        cliente: m.descricao || "(lançamento manual)",
        prestador: m.beneficiario_nome || "-",
        data_conclusao: m.data_vencimento || m.created_at,
        valor: Number(m.valor) || 0,
        valor_mo: Number(m.valor) || 0,
        cliente_pagou: true,
        data_pgto_prestador: m.data_pagamento || null,
        pagamento_feito: pago,
        link_asaas: null,
        valor_pago: pago ? Number(m.valor) || 0 : 0,
      };
    });

    const combined = [...mapped, ...manuaisRows].sort((a, b) => {
      const da = parseDateForDisplay(a.data_conclusao)?.getTime() || 0;
      const db = parseDateForDisplay(b.data_conclusao)?.getTime() || 0;
      return db - da;
    });

    setRows(combined);
    setLoading(false);
  };

  // Filters
  const filteredRows = rows.filter(r => {
    if (search) {
      const s = search.toLowerCase();
      if (!r.ficha_id.toLowerCase().includes(s) && !r.cliente.toLowerCase().includes(s) && !r.prestador.toLowerCase().includes(s)) return false;
    }
    if (filterStatus === "pago" && !r.cliente_pagou) return false;
    if (filterStatus === "pendente" && r.cliente_pagou) return false;
    if (filterDate) {
      const start = new Date(filterDate); start.setHours(0,0,0,0);
      const end = new Date(filterDate); end.setHours(23,59,59,999);
      const d = parseDateForDisplay(r.data_conclusao);
      if (!d || d < start || d > end) return false;
    }
    return true;
  });

  const exportCsv = () => {
    const header = "N. Ficha,Cliente,Prestador,Data conclusão,Valor,Valor MO,Cliente pagou?,Data pgto prestador,Pagamento feito?,Link ASAAS,Valor pago";
    const lines = filteredRows.map((r) =>
      [
        r.ficha_id, r.cliente, r.prestador, formatDate(r.data_conclusao),
        r.valor.toFixed(2), r.valor_mo.toFixed(2), r.cliente_pagou ? "Sim" : "Não",
        formatDate(r.data_pgto_prestador), r.pagamento_feito ? "Sim" : "Não",
        r.link_asaas || "", r.valor_pago.toFixed(2),
      ].map((v) => `"${v}"`).join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "controle_pagamentos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate("/planilha")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Planilhas
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">Controle Pagamentos</h1>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredRows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar ficha, cliente ou prestador..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !filterDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filterDate ? format(filterDate, "dd/MM/yyyy", { locale: ptBR }) : "Todas as datas"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={filterDate} onSelect={setFilterDate} initialFocus className="p-3 pointer-events-auto" />
              <div className="border-t p-2">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilterDate(undefined)}>Todas as datas</Button>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex gap-1">
            {(["todos", "pago", "pendente"] as const).map(s => (
              <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)} className="capitalize text-xs">
                {s === "todos" ? "Todos" : s === "pago" ? "Pagos" : "Pendentes"}
              </Button>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pagamentos ({filteredRows.length} registros)</CardTitle>
            <CardDescription>Controle de pagamentos de fichas finalizadas.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum registro de pagamento encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/60">
                      <th className="text-left p-3 font-medium whitespace-nowrap border-r text-xs">N. Ficha</th>
                      <th className="text-left p-3 font-medium whitespace-nowrap border-r text-xs">Cliente</th>
                      <th className="text-left p-3 font-medium whitespace-nowrap border-r text-xs">Prestador</th>
                      <th className="text-left p-3 font-medium whitespace-nowrap border-r text-xs">Data conclusão</th>
                      <th className="text-right p-3 font-medium whitespace-nowrap border-r text-xs">Valor</th>
                      <th className="text-right p-3 font-medium whitespace-nowrap border-r text-xs">Valor MO</th>
                      <th className="text-center p-3 font-medium whitespace-nowrap border-r text-xs">Cliente pagou?</th>
                      <th className="text-left p-3 font-medium whitespace-nowrap border-r text-xs">Data pgto prestador</th>
                      <th className="text-center p-3 font-medium whitespace-nowrap border-r text-xs">Pgto feito?</th>
                      <th className="text-left p-3 font-medium whitespace-nowrap border-r text-xs">Link ASAAS</th>
                      <th className="text-right p-3 font-medium whitespace-nowrap text-xs">Valor pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => (
                      <tr key={r.row_key} className="hover:bg-muted/30">
                        <td className="p-2.5 whitespace-nowrap border-t border-r text-xs font-medium">{r.ficha_id}</td>
                        <td className="p-2.5 whitespace-nowrap border-t border-r text-xs">{r.cliente}</td>
                        <td className="p-2.5 whitespace-nowrap border-t border-r text-xs">{r.prestador}</td>
                        <td className="p-2.5 whitespace-nowrap border-t border-r text-xs">{formatDate(r.data_conclusao)}</td>
                        <td className="p-2.5 whitespace-nowrap border-t border-r text-xs text-right">{formatMoeda(r.valor)}</td>
                        <td className="p-2.5 whitespace-nowrap border-t border-r text-xs text-right">{formatMoeda(r.valor_mo)}</td>
                        <td className="p-2.5 whitespace-nowrap border-t border-r text-xs text-center">
                          <Badge variant={r.cliente_pagou ? "default" : "outline"} className={r.cliente_pagou ? "bg-green-600 text-white" : ""}>
                            {r.cliente_pagou ? "Sim" : "Não"}
                          </Badge>
                        </td>
                        <td className="p-2.5 whitespace-nowrap border-t border-r text-xs">{formatDate(r.data_pgto_prestador)}</td>
                        <td className="p-2.5 whitespace-nowrap border-t border-r text-xs text-center">
                          <Badge variant={r.pagamento_feito ? "default" : "outline"} className={r.pagamento_feito ? "bg-green-600 text-white" : ""}>
                            {r.pagamento_feito ? "Sim" : "Não"}
                          </Badge>
                        </td>
                        <td className="p-2.5 whitespace-nowrap border-t border-r text-xs max-w-[200px] truncate">
                          {r.link_asaas ? (
                            <a href={r.link_asaas} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                              Link
                            </a>
                          ) : "-"}
                        </td>
                        <td className="p-2.5 whitespace-nowrap border-t text-xs text-right">{r.valor_pago > 0 ? formatMoeda(r.valor_pago) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
};

export default PlanilhaControlePagamentos;
