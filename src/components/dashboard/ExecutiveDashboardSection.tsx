import { useState, useCallback } from "react";
import {
  DollarSign,
  PiggyBank,
  Percent,
  Hammer,
  Package,
  HandCoins,
} from "lucide-react";
import { ExecutiveFunnel, type ExecutiveFunnelStep } from "./ExecutiveFunnel";
import {
  FinancialKPIsBlock,
  VolumeKPIsBlock,
  type ExecKPIItem,
} from "./ExecutiveKPIBlocks";
import { KPIFilters } from "./KPIFilters";
import { KPIDrillDownDialog } from "./KPIDrillDownDialog";
import {
  useOperationalKPIs,
  FALLBACK_OPERATIONAL_KPIS,
  type PeriodOption,
  type ComparisonMode,
} from "@/hooks/useOperationalKPIs";
import type { DrillDownKPI } from "@/hooks/useKPIDrillDown";
import { Skeleton } from "@/components/ui/skeleton";

interface ExecutiveDashboardSectionProps {
  period: PeriodOption;
  customDateRange?: { from: Date; to: Date };
  comparisonMode?: ComparisonMode;
  comparisonRange?: { from: Date; to: Date };
}

const COMPARISON_LABEL: Record<ComparisonMode, string> = {
  "previous-month": "vs mesmo período do mês anterior",
  "avg-3-months": "vs média dos 3 meses anteriores",
  custom: "vs período personalizado",
};

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

export const ExecutiveDashboardSection = ({
  period,
  customDateRange,
  comparisonMode = "previous-month",
  comparisonRange,
}: ExecutiveDashboardSectionProps) => {
  const [filters, setFilters] = useState<{
    categoriaId?: number;
    prestadorCpf?: string;
    clienteTelefone?: string;
  }>({});

  const [drillDown, setDrillDown] = useState<{
    kpi: DrillDownKPI;
    label: string;
  } | null>(null);

  const { data, isLoading } = useOperationalKPIs({
    period,
    customRange: customDateRange,
    comparisonMode,
    comparisonRange,
    ...filters,
  });

  const kpis = data || FALLBACK_OPERATIONAL_KPIS;
  const compLabel = COMPARISON_LABEL[comparisonMode];

  const handleFiltersChange = useCallback(
    (newFilters: {
      categoriaId?: number;
      prestadorCpf?: string;
      clienteTelefone?: string;
    }) => {
      setFilters(newFilters);
    },
    [],
  );

  const openDrill = (kpi: DrillDownKPI, label: string) => () =>
    setDrillDown({ kpi, label });

  // ===== Funil (5 etapas) — usa exatamente os mesmos campos já calculados =====
  const funnelSteps: ExecutiveFunnelStep[] = [
    {
      id: "fs-criadas",
      label: "FS Criadas",
      value: kpis.fsCriadas,
      variation: kpis.variations.fsCriadas,
      onClick: openDrill("fsCriadas", "FS Criadas"),
      tooltip: "Fichas de serviço criadas no período (data de criação).",
    },
    {
      id: "fs-com-orcamento",
      label: "Com Orçamento",
      value: kpis.fsComOrcamento,
      variation: kpis.variations.fsComOrcamento,
      onClick: openDrill("totalOrcamentos", "FS com Orçamento"),
      tooltip:
        "Fichas que receberam pelo menos 1 orçamento de prestador no período.",
    },
    {
      id: "agendados",
      label: "Agendados",
      value: kpis.servicoAgendado,
      variation: kpis.variations.servicoAgendado,
      onClick: openDrill("servicoAgendado", "Serviços Agendados"),
      tooltip:
        "Fichas cujo status virou 'Agendado' no período (exclui fichas que hoje estão como 'Perdido').",
    },
    {
      id: "finalizados",
      label: "Finalizados",
      value: kpis.servicoFinalizado,
      variation: kpis.variations.servicoFinalizado,
      onClick: openDrill("servicoFinalizado", "Serviços Finalizados"),
      tooltip:
        "Fichas cujo status mudou para 'Finalizado' no período. Independe de pagamento.",
    },
    {
      id: "pago-cliente",
      label: "Pago (cliente)",
      value: kpis.finalizadoPago,
      variation: kpis.variations.finalizadoPago,
      onClick: openDrill("finalizadoPago", "Finalizado e Pago (Cliente)"),
      tooltip:
        "Fichas finalizadas no período E com pagamento_realizado = true.",
    },
  ];

  // ===== Bloco Financeiro =====
  const financialItems: ExecKPIItem[] = [
    {
      id: "valor-total-os",
      label: "Valor Total OS",
      value: formatCurrency(kpis.valorTotalOS),
      variation: kpis.variations.valorTotalOS,
      icon: <DollarSign className="h-3.5 w-3.5" />,
      onClick: openDrill("valorTotalOS", "Valor Total OS"),
      tooltip:
        "Soma do valor_total das fichas finalizadas e pagas no período.",
    },
    {
      id: "liquido-24help",
      label: "Líquido 24help",
      value: formatCurrency(kpis.valorLiquido24help),
      variation: kpis.variations.valorLiquido24help,
      icon: <PiggyBank className="h-3.5 w-3.5" />,
      onClick: openDrill("valorLiquido24help", "Líquido 24help"),
      tooltip:
        "Líquido 24help = Valor da FS − Valor pago ao prestador − Material (quando pago pela 24help).",
    },
    {
      id: "take-rate",
      label: "% Take Rate 24help",
      value: `${kpis.margemBruta24help.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`,
      variation: kpis.variations.margemBruta24help,
      icon: <Percent className="h-3.5 w-3.5" />,
      highlight: true,
      onClick: openDrill("margemBruta24help", "% Take Rate 24help"),
      tooltip:
        "% Take Rate 24help = Líquido 24help ÷ Valor total das FS × 100.",
    },
    {
      id: "mao-de-obra",
      label: "Mão de Obra",
      value: formatCurrency(kpis.valorMaoObra),
      variation: kpis.variations.valorMaoObra,
      icon: <Hammer className="h-3.5 w-3.5" />,
      onClick: openDrill("valorMaoObra", "Valor Mão de Obra"),
      tooltip:
        "Soma de valor_final_mao_obra (ou valor_mao_obra como fallback) das fichas finalizadas e pagas.",
    },
    {
      id: "pecas",
      label: "Peças",
      value: formatCurrency(kpis.valorPecas),
      variation: kpis.variations.valorPecas,
      icon: <Package className="h-3.5 w-3.5" />,
      onClick: openDrill("valorPecas", "Valor Peças"),
      tooltip: "Soma de valor_final_pecas das fichas finalizadas e pagas.",
    },
    {
      id: "pago-prestadores",
      label: "Pago a Prestadores",
      value: formatCurrency(kpis.valorPagoPrestadores),
      variation: kpis.variations.valorPagoPrestadores,
      icon: <HandCoins className="h-3.5 w-3.5" />,
      onClick: openDrill("valorPagoPrestadores", "Pago a Prestadores"),
      tooltip:
        "Soma do valor_a_pagar_prestador das transações vinculadas às fichas do período.",
    },
  ];

  // ===== Bloco Volume de Atendimento =====
  const volumeItems: ExecKPIItem[] = [
    {
      id: "conversas-iniciadas",
      label: "Conversas Iniciadas",
      value: String(kpis.conversasIniciadas),
      variation: kpis.variations.conversasIniciadas,
      onClick: openDrill("conversasIniciadas", "Conversas Iniciadas"),
    },
    {
      id: "fs-criadas-vol",
      label: "FS Criadas",
      value: String(kpis.fsCriadas),
      variation: kpis.variations.fsCriadas,
      onClick: openDrill("fsCriadas", "FS Criadas"),
    },
    {
      id: "servicos-orcados",
      label: "Serviços Orçados",
      value: String(kpis.fsComOrcamento),
      subValue: `${kpis.totalOrcamentos} orç. · ${kpis.mediaOrcamentosPorFS.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} por FS`,
      variation: kpis.variations.fsComOrcamento,
      onClick: openDrill("totalOrcamentos", "FS com Orçamento"),
    },
    {
      id: "servicos-agendados",
      label: "Serviços Agendados",
      value: String(kpis.servicoAgendado),
      variation: kpis.variations.servicoAgendado,
      onClick: openDrill("servicoAgendado", "Serviço Agendado"),
    },
    {
      id: "servicos-finalizados",
      label: "Serviços Finalizados",
      value: String(kpis.servicoFinalizado),
      variation: kpis.variations.servicoFinalizado,
      onClick: openDrill("servicoFinalizado", "Serviço Finalizado"),
    },
    {
      id: "pago-prestador",
      label: "Pago ao Prestador",
      value: String(kpis.pagoAoPrestador),
      variation: kpis.variations.pagoAoPrestador,
      onClick: openDrill("pagoAoPrestador", "Pago ao Prestador"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filtros (topo, alinhados à direita) */}
      <div className="flex justify-end">
        <KPIFilters onFiltersChange={handleFiltersChange} />
      </div>

      {/* Bloco 1 — Funil (destaque máximo) */}
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <ExecutiveFunnel steps={funnelSteps} isLoading={false} />
      )}

      {/* Bloco 2 — Financeiro */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <FinancialKPIsBlock items={financialItems} comparisonLabel={compLabel} />
      )}

      {/* Bloco 3 — Volume de atendimento */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <VolumeKPIsBlock items={volumeItems} comparisonLabel={compLabel} />
      )}

      <KPIDrillDownDialog
        open={!!drillDown}
        onOpenChange={(o) => !o && setDrillDown(null)}
        kpi={drillDown?.kpi || null}
        kpiLabel={drillDown?.label || ""}
        period={period}
        customRange={customDateRange}
        categoriaId={filters.categoriaId}
        prestadorCpf={filters.prestadorCpf}
        clienteTelefone={filters.clienteTelefone}
      />
    </div>
  );
};
