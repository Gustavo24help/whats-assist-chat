import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const formatMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const FINANCEIRO_CUTOFF = "2026-03-13T23:00:00.000Z";

const formatDate = (d: string | null) => {
  if (!d) return "-";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return "-"; }
};

interface RowData {
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

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);

    // Get fichas finalizadas with valor > 0
    const { data: fichas } = await supabase
      .from("fichas_de_servico")
      .select("id, nome_cliente, telefone_cliente, prestador_id, valor_total, valor_mao_obra, pagamento_realizado, pagamento_link, updated_at")
      .in("status", ["Finalizado", "Em andamento"] as any)
      .gt("valor_total", 0)
      .order("updated_at", { ascending: false });

    if (!fichas || fichas.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const prestadorIds = [...new Set(fichas.map((f: any) => f.prestador_id).filter(Boolean))];
    const phones = [...new Set(fichas.map((f: any) => f.telefone_cliente))];
    const fichaIds = fichas.map((f: any) => f.id);

    const [prestRes, clienteRes, transRes] = await Promise.all([
      prestadorIds.length > 0
        ? supabase.from("prestadores").select("cpf, nome").in("cpf", prestadorIds)
        : { data: [] },
      supabase.from("clientes").select("telefone, nome").in("telefone", phones),
      supabase.from("transacoes_financeiras").select("ficha_id, status_pagamento_prestador, data_pagamento_realizada, valor_cliente_final").in("ficha_id", fichaIds),
    ]);

    const prestMap = new Map((prestRes.data || []).map((p: any) => [p.cpf, p.nome]));
    const clienteMap = new Map((clienteRes.data || []).map((c: any) => [c.telefone, c.nome]));
    const transMap = new Map((transRes.data || []).map((t: any) => [t.ficha_id, t]));

    const mapped: RowData[] = fichas.map((f: any) => {
      const trans = transMap.get(f.id);
      return {
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

    setRows(mapped);
    setLoading(false);
  };

  const exportCsv = () => {
    const header = "N. Ficha,Cliente,Prestador,Data conclusão,Valor,Valor MO,Cliente pagou?,Data pgto prestador,Pagamento feito?,Link ASAAS,Valor pago";
    const lines = rows.map((r) =>
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate("/planilha")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Planilhas
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">Controle Pagamentos</h1>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pagamentos ({rows.length} registros)</CardTitle>
            <CardDescription>Controle de pagamentos de fichas finalizadas.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
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
                    {rows.map((r) => (
                      <tr key={r.ficha_id} className="hover:bg-muted/30">
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
    </div>
  );
};

export default PlanilhaControlePagamentos;
