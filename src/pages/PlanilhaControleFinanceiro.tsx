import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Download, Search, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const formatMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string | null) => {
  if (!d) return "-";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return "-"; }
};

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
  pagamento_sim_nao: string;
  fone_cliente: string;
  forma_pgto: string | null;
  conf_pgto: string;
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
  status_envio: string;
}

const columns = [
  "Data contratação", "Data execução", "Data pgto", "ID", "Prestador", "CPF", "CNPJ",
  "Pix", "Categoria", "Cliente", "Pagamento?", "Fone cliente",
  "Forma pgto", "Conf. pgto", "Adiant. cliente", "Adiant. prestador",
  "Tx visita", "MO", "Peças", "Taxa 24help", "Total OS",
  "Líquido prestador", "Desconto", "Lucro bruto", "Rentab", "Status",
];

const PlanilhaControleFinanceiro = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [filterPago, setFilterPago] = useState<"todos" | "pago" | "pendente">("todos");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: transacoes } = await supabase
      .from("transacoes_financeiras")
      .select("*")
      .order("data_execucao", { ascending: false });

    if (!transacoes || transacoes.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const mapped: RowData[] = transacoes.map((t: any) => {
      const maoObra = t.valor_mao_obra || 0;
      const pecas = t.valor_material || 0;
      const taxaVisita = t.taxa_visita || 0;
      const adiantCliente = t.adiantamento_cliente || 0;
      const adiantPrestador = t.adiantamento_prestador || 0;
      const totalOS = t.valor_cliente_final || 0;
      const liquidoPrestador = t.valor_a_pagar_prestador || 0;
      const lucroBruto = t.valor_lucro_bruto || 0;
      const taxa24help = totalOS - (maoObra + pecas + taxaVisita);
      const rentab = totalOS > 0 ? (lucroBruto / totalOS) * 100 : 0;

      return {
        data_contratacao: t.data_contratacao,
        data_execucao: t.data_execucao,
        data_pgto: t.data_pagamento_realizada,
        id_ficha: t.ficha_id,
        nome_prestador: t.prestador_nome,
        cpf_prestador: t.prestador_cpf,
        cnpj: t.prestador_cnpj,
        pix_prestador: t.pix_prestador,
        categoria: t.categoria,
        nome_cliente: t.cliente_nome,
        pagamento_sim_nao: t.status_pagamento_cliente === "pago" ? "Sim" : "Não",
        fone_cliente: t.cliente_id?.replace("whatsapp:+55", "") || "",
        forma_pgto: t.forma_pagamento_cliente,
        conf_pgto: t.status_pagamento_prestador === "pago" ? "Sim" : "Não",
        adiant_cliente: adiantCliente,
        adiant_prestador: adiantPrestador,
        taxa_visita: taxaVisita,
        mao_obra: maoObra,
        pecas: pecas,
        taxa_24help: Math.max(taxa24help, 0),
        total_os: totalOS,
        liquido_prestador: liquidoPrestador,
        desconto: 0,
        lucro_bruto: lucroBruto,
        rentab: Math.max(rentab, 0),
        status_envio: t.status_pagamento_prestador === "pago" ? "Enviado" : "Pendente",
      };
    });

    setRows(mapped);
    setLoading(false);
  };

  // Filters
  const filteredRows = rows.filter(r => {
    if (search) {
      const s = search.toLowerCase();
      if (!r.id_ficha.toLowerCase().includes(s) && !r.nome_prestador.toLowerCase().includes(s) && !r.nome_cliente.toLowerCase().includes(s)) return false;
    }
    if (filterPago === "pago" && r.pagamento_sim_nao !== "Sim") return false;
    if (filterPago === "pendente" && r.pagamento_sim_nao !== "Não") return false;
    if (filterDate) {
      const start = new Date(filterDate); start.setHours(0,0,0,0);
      const end = new Date(filterDate); end.setHours(23,59,59,999);
      const d = r.data_execucao ? new Date(r.data_execucao) : null;
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
        r.pagamento_sim_nao, r.fone_cliente,
        r.forma_pgto || "", r.conf_pgto,
        r.adiant_cliente.toFixed(2), r.adiant_prestador.toFixed(2),
        r.taxa_visita.toFixed(2), r.mao_obra.toFixed(2), r.pecas.toFixed(2),
        r.taxa_24help.toFixed(2), r.total_os.toFixed(2),
        r.liquido_prestador.toFixed(2), r.desconto.toFixed(2),
        r.lucro_bruto.toFixed(2), r.rentab.toFixed(1) + "%", r.status_envio,
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
      case 10: return r.pagamento_sim_nao;
      case 11: return r.fone_cliente || "-";
      case 12: return r.forma_pgto || "-";
      case 13: return r.conf_pgto;
      case 14: return formatMoeda(r.adiant_cliente);
      case 15: return formatMoeda(r.adiant_prestador);
      case 16: return formatMoeda(r.taxa_visita);
      case 17: return formatMoeda(r.mao_obra);
      case 18: return formatMoeda(r.pecas);
      case 19: return formatMoeda(r.taxa_24help);
      case 20: return formatMoeda(r.total_os);
      case 21: return formatMoeda(r.liquido_prestador);
      case 22: return formatMoeda(r.desconto);
      case 23: return formatMoeda(r.lucro_bruto);
      case 24: return r.rentab.toFixed(1) + "%";
      case 25: return r.status_envio;
      default: return "-";
    }
  };

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
            {(["todos", "pago", "pendente"] as const).map(s => (
              <Button key={s} variant={filterPago === s ? "default" : "outline"} size="sm" onClick={() => setFilterPago(s)} className="capitalize text-xs">
                {s === "todos" ? "Todos" : s === "pago" ? "Pagos" : "Pendentes"}
              </Button>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Controle Financeiro ({filteredRows.length} registros)</CardTitle>
            <CardDescription>Dados financeiros de transações confirmadas no sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma transação financeira registrada ainda.
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
                          <td key={ci} className="p-2.5 whitespace-nowrap border-t border-r last:border-r-0 text-xs">
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
