import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, ArrowDownUp, Wallet, AlertTriangle } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";

const formatMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

interface KPIData {
  totalRecebido: number;
  totalPago: number;
  lucroBruto: number;
  margemMedia: number;
  adiantamentosPendentes: number;
}

export const FinanceiroKPIs = () => {
  const [data, setData] = useState<KPIData>({
    totalRecebido: 0,
    totalPago: 0,
    lucroBruto: 0,
    margemMedia: 0,
    adiantamentosPendentes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const now = new Date();
        const inicioMes = startOfMonth(now).toISOString();
        const fimMes = endOfMonth(now).toISOString();

        const [transRes, adiantRes] = await Promise.all([
          supabase
            .from("transacoes_financeiras")
            .select("valor_cliente_final, valor_a_pagar_prestador, valor_lucro_bruto, margem_operacional_real, status_pagamento_cliente, status_pagamento_prestador, data_execucao")
            .gte("data_execucao", inicioMes)
            .lte("data_execucao", fimMes),
          supabase
            .from("adiantamentos")
            .select("valor, status")
            .eq("status", "pendente"),
        ]);

        const trans = transRes.data || [];
        const adiant = adiantRes.data || [];

        const clientesPagos = trans.filter((t: any) => t.status_pagamento_cliente === "pago");
        const prestadoresPagos = trans.filter((t: any) => t.status_pagamento_prestador === "pago");

        const totalRecebido = clientesPagos.reduce((s: number, t: any) => s + (t.valor_cliente_final || 0), 0);
        const totalPago = prestadoresPagos.reduce((s: number, t: any) => s + (t.valor_a_pagar_prestador || 0), 0);
        const lucroBruto = trans.reduce((s: number, t: any) => s + (t.valor_lucro_bruto || 0), 0);
        const margemMedia = trans.length > 0
          ? trans.reduce((s: number, t: any) => s + (t.margem_operacional_real || 0), 0) / trans.length
          : 0;
        const adiantamentosPendentes = adiant.reduce((s: number, a: any) => s + (a.valor || 0), 0);

        setData({ totalRecebido, totalPago, lucroBruto, margemMedia, adiantamentosPendentes });
      } catch (e) {
        console.error("Erro ao carregar KPIs financeiros:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchKPIs();
  }, []);

  const kpis = [
    { label: "Recebido (Mês)", value: formatMoeda(data.totalRecebido), icon: DollarSign, color: "text-green-600 dark:text-green-400" },
    { label: "Pago Prestadores", value: formatMoeda(data.totalPago), icon: Wallet, color: "text-blue-600 dark:text-blue-400" },
    { label: "Lucro Bruto", value: formatMoeda(data.lucroBruto), icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Margem Média", value: `${data.margemMedia.toFixed(1)}%`, icon: ArrowDownUp, color: "text-purple-600 dark:text-purple-400" },
    { label: "Adiant. Pendentes", value: formatMoeda(data.adiantamentosPendentes), icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            <span className="text-xs text-muted-foreground">{kpi.label}</span>
          </div>
          <div className={`text-lg font-bold ${loading ? "animate-pulse bg-muted rounded w-20 h-6" : ""}`}>
            {loading ? "" : kpi.value}
          </div>
        </Card>
      ))}
    </div>
  );
};
