import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, Clock, Wallet, AlertTriangle } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";

const FINANCEIRO_CUTOFF = "2026-03-13T23:00:00.000Z";

const formatMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

interface KPIData {
  totalRecebido: number;
  pendentesClientes: number;
  pendentesPrestadores: number;
  fichasFinalizadas: number;
  adiantamentosPendentes: number;
}

export const FinanceiroKPIs = () => {
  const [data, setData] = useState<KPIData>({
    totalRecebido: 0,
    pendentesClientes: 0,
    pendentesPrestadores: 0,
    fichasFinalizadas: 0,
    adiantamentosPendentes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const now = new Date();
        const inicioMes = startOfMonth(now).toISOString();
        const fimMes = endOfMonth(now).toISOString();

        const [pagosRes, pendClientesRes, finalizadosRes, adiantRes] = await Promise.all([
          // Fichas com pagamento realizado neste mês
          supabase
            .from("fichas_de_servico")
            .select("valor_total")
            .eq("pagamento_realizado", true)
            .gt("valor_total", 0)
            .gte("updated_at", inicioMes)
            .lte("updated_at", fimMes),
          // Fichas pendentes de pagamento do cliente
          supabase
            .from("fichas_de_servico")
            .select("valor_total")
            .eq("pagamento_realizado", false)
            .in("status", ["Orçamento Aprovado / Agendamento" as any, "Agendado" as any, "Em andamento" as any, "Finalizado" as any])
            .gt("valor_total", 0),
          // Fichas finalizadas neste mês
          supabase
            .from("fichas_de_servico")
            .select("id")
            .eq("status", "Finalizado" as any)
            .gte("updated_at", inicioMes)
            .lte("updated_at", fimMes),
          // Adiantamentos pendentes
          supabase
            .from("adiantamentos")
            .select("valor, status")
            .eq("status", "pendente"),
        ]);

        const pagos = pagosRes.data || [];
        const pendClientes = pendClientesRes.data || [];
        const finalizados = finalizadosRes.data || [];
        const adiant = adiantRes.data || [];

        setData({
          totalRecebido: pagos.reduce((s: number, f: any) => s + (f.valor_total || 0), 0),
          pendentesClientes: pendClientes.reduce((s: number, f: any) => s + (f.valor_total || 0), 0),
          pendentesPrestadores: 0, // Will be shown in the tab
          fichasFinalizadas: finalizados.length,
          adiantamentosPendentes: adiant.reduce((s: number, a: any) => s + (a.valor || 0), 0),
        });
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
    { label: "Pendente Clientes", value: formatMoeda(data.pendentesClientes), icon: Clock, color: "text-amber-600 dark:text-amber-400" },
    { label: "Finalizados (Mês)", value: String(data.fichasFinalizadas), icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Adiant. Pendentes", value: formatMoeda(data.adiantamentosPendentes), icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
