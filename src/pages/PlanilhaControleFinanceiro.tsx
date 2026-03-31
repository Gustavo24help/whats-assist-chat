import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Download, Search, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { isBusinessDay } from "@/lib/businessDays2026";

const formatMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string | Date | null) => {
  if (!d) return "-";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return "-"; }
};

function addBusinessDays(date: Date | string, n: number): Date {
  const d = new Date(date);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) added++;
  }
  return d;
}

interface RowData {
  data_contratacao: string | null;
  data_execucao: string | null;
  data_pgto: string | null;
  id_ficha: string;
  nome_prestador: string;
  cpf_prestador: string | null;
  cnpj: string | null;
  pix_prestador: string | null;
  categoria: string | null;
  nome_cliente: string;
  telefone_cliente: string;
  forma_pgto: string | null;
  conf_pgto_cliente: string;
  adiant_cliente: number;
  adiant_prestador: number;
  taxa_visita: number;
  mao_obra: number;
  pecas: number;
  taxa_24help: number;
  total_os: number;
  liquido_prestador: number;
  desconto: number;
  lucro_bruto: number;
  rentab: number;
  status_prestador: string;
}

const columns = [
  "Data contratação", "Data execução", "Data pgto", "ID", "Prestador", "CPF",
  "CNPJ", "Pix", "Categoria", "Cliente", "Telefone", "Forma pgto",
  "Conf. pgto cliente", "Adiant. cliente", "Adiant. prestador",
  "Tx visita", "MO", "Peças", "Taxa 24help", "Total OS",
  "Líquido prestador", "Desconto", "Lucro bruto", "Rentab", "Status prestador",
];

const PlanilhaControleFinanceiro = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<"todos" | "pago" | "pendente">("todos");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch fichas finalizadas with valor > 0 and prestador
    const { data: fichas } = await supabase
      .from("fichas_de_servico")
      .select("id, nome_ficha, nome_cliente, telefone_cliente, status, valor_total, valor_mao_obra, valor_pecas, prestador_id, pagamento_realizado, pagamento_link, created_at, updated_at, categoria_id")
      .eq("status", "Finalizado" as any)
      .gt("valor_total", 0)
      .not("prestador_id", "is", null)
      .order("created_at", { ascending: false });

    if (!fichas || fichas.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const prestadorIds = [...new Set(fichas.map((f: any) => f.prestador_id))];
    const phones = [...new Set(fichas.map((f: any) => f.telefone_cliente))];
    const fichaIds = fichas.map((f: any) => f.id);
    const catIds = [...new Set(fichas.map((f: any) => f.categoria_id).filter(Boolean))];

    const [prestRes, clienteRes, transRes, catRes] = await Promise.all([
      supabase.from("prestadores").select("cpf, nome, chave_pix, cnpj, banco").in("cpf", prestadorIds),
      supabase.from("clientes").select("telefone, nome").in("telefone", phones),
      supabase.from("transacoes_financeiras").select("ficha_id, status_pagamento_prestador, data_pagamento_realizada, adiantamento_cliente, adiantamento_prestador, taxa_visita, forma_pagamento_cliente").in("ficha_id", fichaIds),
      catIds.length > 0 ? supabase.from("categorias").select("id, nome").in("id", catIds) : Promise.resolve({ data: [] }),
    ]);

    const prestMap = new Map((prestRes.data || []).map((p: any) => [p.cpf, p]));
    const clienteMap = new Map((clienteRes.data || []).map((c: any) => [c.telefone, c.nome]));
    const transMap = new Map((transRes.data || []).map((t: any) => [t.ficha_id, t]));
    const catMap = new Map((catRes.data || []).map((c: any) => [c.id, c.nome]));

    const mapped: RowData[] = fichas.map((f: any) => {
      const prest = prestMap.get(f.prestador_id);
      const trans = transMap.get(f.id);
      const maoObra = f.valor_mao_obra || 0;
      const pecas = f.valor_pecas || 0;
      const taxaVisita = trans?.taxa_visita || 0;
      const adiantCliente = trans?.adiantamento_cliente || 0;
      const adiantPrestador = trans?.adiantamento_prestador || 0;
      const totalOS = f.valor_total || 0;
      const liquidoPrestador = maoObra + taxaVisita;
      const taxa24help = totalOS > 0 ? totalOS - (maoObra + pecas + taxaVisita) : 0;
      const lucroBruto = totalOS - liquidoPrestador - pecas;
      const rentab = totalOS > 0 ? (lucroBruto / totalOS) * 100 : 0;
      const isPago = trans?.status_pagamento_prestador === "pago";

      const dataPgto = isPago ? (trans?.data_pagamento_realizada || null) : null;

      return {
        data_contratacao: f.created_at,
        data_execucao: f.updated_at,
        data_pgto: dataPgto,
        id_ficha: f.id,
        nome_prestador: prest?.nome || f.prestador_id,
        cpf_prestador: f.prestador_id,
        cnpj: prest?.cnpj || null,
        pix_prestador: prest?.chave_pix || null,
        categoria: catMap.get(f.categoria_id) || null,
        nome_cliente: f.nome_cliente || clienteMap.get(f.telefone_cliente) || f.telefone_cliente.replace("whatsapp:+55", ""),
        telefone_cliente: f.telefone_cliente.replace("whatsapp:+55", ""),
        forma_pgto: trans?.forma_pagamento_cliente || null,
        conf_pgto_cliente: f.pagamento_realizado ? "Sim" : "Não",
        adiant_cliente: adiantCliente,
        adiant_prestador: adiantPrestador,
        taxa_visita: taxaVisita,
        mao_obra: maoObra,
        pecas: pecas,
        taxa_24help: Math.max(taxa24help, 0),
        total_os: totalOS,
        liquido_prestador: liquidoPrestador,
        desconto: 0,
        lucro_bruto: Math.max(lucroBruto, 0),
        rentab: Math.max(rentab, 0),
        status_prestador: isPago ? "Pago" : "Pendente",
      };
    });

    setRows(mapped);
    setLoading(false);
  };

  const filteredRows = rows.filter(r => {
    if (search) {
      const s = search.toLowerCase();
      if (!r.id_ficha.toLowerCase().includes(s) && !r.nome_prestador.toLowerCase().includes(s) && !r.nome_cliente.toLowerCase().includes(s)) return false;
    }
    if (filterStatus === "pago" && r.status_prestador !== "Pago") return false;
    if (filterStatus === "pendente" && r.status_prestador !== "Pendente") return false;
    if (filterDate) {
      const start = new Date(filterDate); start.setHours(0, 0, 0, 0);
      const end = new Date(filterDate); end.setHours(23, 59, 59, 999);
      const d = r.data_contratacao ? new Date(r.data_contratacao) : null;
      if (!d || d < start || d > end) return false;
    }
    return true;
  });

  const exportCsv = () => {
    const header = columns.join(",");
    const lines = filteredRows.map((r) =>
      [
        formatDate(r.data_contratacao), formatDate(r.data_execucao), formatDate(r.data_pgto),
        r.id_ficha, r.nome_prestador, r.cpf_prestador || "", r.cnpj || "",
        r.pix_prestador || "", r.categoria || "", r.nome_cliente,
        r.telefone_cliente,
        r.forma_pgto || "", r.conf_pgto_cliente,
        r.adiant_cliente.toFixed(2), r.adiant_prestador.toFixed(2),
        r.taxa_visita.toFixed(2), r.mao_obra.toFixed(2), r.pecas.toFixed(2),
        r.taxa_24help.toFixed(2), r.total_os.toFixed(2),
        r.liquido_prestador.toFixed(2), r.desconto.toFixed(2),
        r.lucro_bruto.toFixed(2), r.rentab.toFixed(1) + "%", r.status_prestador,
      ].map((v) => `"${v}"`).join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "controle_financeiro.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderCellValue = (r: RowData, colIndex: number) => {
    switch (colIndex) {
      case 0: return formatDate(r.data_contratacao);
      case 1: return formatDate(r.data_execucao);
      case 2: return formatDate(r.data_pgto);
      case 3: return r.id_ficha;
      case 4: return r.nome_prestador;
      case 5: return r.cpf_prestador || "-";
      case 6: return r.cnpj || "-";
      case 7: return r.pix_prestador || "-";
      case 8: return r.categoria || "-";
      case 9: return r.nome_cliente;
      case 10: return r.telefone_cliente || "-";
      case 11: return r.forma_pgto || "-";
      case 12: return r.conf_pgto_cliente;
      case 13: return formatMoeda(r.adiant_cliente);
      case 14: return formatMoeda(r.adiant_prestador);
      case 15: return formatMoeda(r.taxa_visita);
      case 16: return formatMoeda(r.mao_obra);
      case 17: return formatMoeda(r.pecas);
      case 18: return formatMoeda(r.taxa_24help);
      case 19: return formatMoeda(r.total_os);
      case 20: return formatMoeda(r.liquido_prestador);
      case 21: return formatMoeda(r.desconto);
      case 22: return formatMoeda(r.lucro_bruto);
      case 23: return r.rentab.toFixed(1) + "%";
      case 24: return r.status_prestador;
      default: return "-";
    }
  };

  const getCellClassName = (r: RowData, colIndex: number) => {
    if (colIndex === 24) {
      return r.status_prestador === "Pago"
        ? "text-green-700 dark:text-green-400 font-medium"
        : "text-orange-600 dark:text-orange-400 font-medium";
    }
    return "";
  };

  const totalLucro = filteredRows.reduce((s, r) => s + r.lucro_bruto, 0);
  const totalOS = filteredRows.reduce((s, r) => s + r.total_os, 0);
  const pendentesCount = filteredRows.filter(r => r.status_prestador === "Pendente").length;
  const pagosCount = filteredRows.filter(r => r.status_prestador === "Pago").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-6 md:p-8">
      <div className="max-w-[100rem] mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate("/planilha")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Planilhas
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">Controle Financeiro</h1>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredRows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>

        {/* KPI summary */}
        <div className="flex gap-3 overflow-x-auto">
          <div className="min-w-[120px] rounded-lg border bg-card p-3 shrink-0">
            <div className="text-xs text-muted-foreground">Total registros</div>
            <div className="text-xl font-bold">{filteredRows.length}</div>
          </div>
          <div className="min-w-[120px] rounded-lg border bg-card p-3 shrink-0">
            <div className="text-xs text-muted-foreground">Pendentes</div>
            <div className="text-xl font-bold text-orange-600">{pendentesCount}</div>
          </div>
          <div className="min-w-[120px] rounded-lg border bg-card p-3 shrink-0">
            <div className="text-xs text-muted-foreground">Pagos</div>
            <div className="text-xl font-bold text-green-600">{pagosCount}</div>
          </div>
          <div className="min-w-[160px] rounded-lg border bg-card p-3 shrink-0">
            <div className="text-xs text-muted-foreground">Total OS</div>
            <div className="text-lg font-bold">{formatMoeda(totalOS)}</div>
          </div>
          <div className="min-w-[160px] rounded-lg border bg-card p-3 shrink-0">
            <div className="text-xs text-muted-foreground">Lucro Bruto</div>
            <div className="text-lg font-bold">{formatMoeda(totalLucro)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar ficha, prestador ou cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
            {(["todos", "pendente", "pago"] as const).map(s => (
              <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)} className="capitalize text-xs">
                {s === "todos" ? "Todos" : s === "pago" ? "Pagos" : "Pendentes"}
              </Button>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Controle Financeiro ({filteredRows.length} registros)</CardTitle>
            <CardDescription>Detalhes financeiros de serviços finalizados — pagamento ao prestador.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma ficha finalizada encontrada.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/60">
                      {columns.map((col) => (
                        <th key={col} className="text-left p-3 font-medium whitespace-nowrap border-r last:border-r-0 text-xs">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r, ri) => (
                      <tr key={ri} className="hover:bg-muted/30">
                        {columns.map((_, ci) => (
                          <td key={ci} className={cn("p-2.5 whitespace-nowrap border-t border-r last:border-r-0 text-xs", getCellClassName(r, ci))}>
                            {renderCellValue(r, ci)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlanilhaControleFinanceiro;
