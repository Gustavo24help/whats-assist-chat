import { useMemo } from "react";
import { ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ExecutiveFunnelStep {
  id: string;
  label: string;
  value: number;
  variation: number | null;
  previousValue?: number | null;
  onClick?: () => void;
  tooltip?: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

interface ExecutiveFunnelProps {
  steps: ExecutiveFunnelStep[];
  isLoading?: boolean;
  comparisonLabel?: string;
}

const formatNumber = (num: number): string => {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (num >= 10_000) return (num / 1000).toFixed(1).replace(".0", "") + "k";
  return num.toLocaleString("pt-BR");
};

const VariationBadge = ({ variation }: { variation: number | null }) => {
  if (variation === null || variation === undefined) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />—
      </span>
    );
  }
  const positive = variation >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
        positive
          ? "bg-brand-green/10 text-brand-green"
          : "bg-brand-red/10 text-brand-red",
      )}
    >
      {positive ? (
        <TrendingUp className="h-2.5 w-2.5" />
      ) : (
        <TrendingDown className="h-2.5 w-2.5" />
      )}
      {positive ? "+" : ""}
      {variation.toFixed(1)}%
    </span>
  );
};

export const ExecutiveFunnel = ({ steps, isLoading, comparisonLabel }: ExecutiveFunnelProps) => {
  const baseValue = steps[0]?.value ?? 0;

  const { biggestDrop, globalCloseRate } = useMemo(() => {
    let drop = { from: "", to: "", lostPct: 0, lost: 0 };
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      const curr = steps[i];
      if (prev.value <= 0) continue;
      const lost = prev.value - curr.value;
      const lostPct = (lost / prev.value) * 100;
      if (lostPct > drop.lostPct) {
        drop = { from: prev.label, to: curr.label, lostPct, lost };
      }
    }
    const last = steps[steps.length - 1]?.value ?? 0;
    const close = baseValue > 0 ? (last / baseValue) * 100 : 0;
    return { biggestDrop: drop, globalCloseRate: close };
  }, [steps, baseValue]);

  if (isLoading) {
    return (
      <div className="saas-card p-6">
        <Skeleton className="h-5 w-40 mb-6" />
        <div className="grid grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="saas-card p-6 bg-gradient-to-br from-brand-green/[0.04] to-brand-yellow/[0.03]">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <h2 className="text-xl font-semibold text-foreground font-jakarta">
            Funil de conversão
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Da primeira conversa ao pagamento do cliente
          </p>
        </div>
      </div>

      {/* Etapas */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-1 items-stretch">
        {steps.map((step, index) => {
          const pctVsBase =
            baseValue > 0 ? (step.value / baseValue) * 100 : 0;
          const prev = index > 0 ? steps[index - 1] : null;
          const pctVsPrev =
            prev && prev.value > 0 ? (step.value / prev.value) * 100 : 0;
          const isLast = index === steps.length - 1;
          const next = !isLast ? steps[index + 1] : null;
          const pctNext =
            next && step.value > 0 ? (next.value / step.value) * 100 : 0;

          const stepInner = (
            <div
              className={cn(
                "relative h-full rounded-xl border bg-card p-4 transition-all flex flex-col justify-between",
                step.onClick &&
                  "cursor-pointer hover:shadow-md hover:border-brand-green/40 hover:-translate-y-0.5",
              )}
              onClick={step.onClick}
              role={step.onClick ? "button" : undefined}
              tabIndex={step.onClick ? 0 : undefined}
              onKeyDown={(e) => {
                if (step.onClick && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  step.onClick();
                }
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-tight">
                  {step.label}
                </span>
                <VariationBadge variation={step.variation} />
              </div>

              <div>
                <div className="text-3xl font-bold text-foreground font-jakarta leading-none">
                  {formatNumber(step.value)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {index === 0 ? (
                    <span className="font-medium text-brand-green">base 100%</span>
                  ) : (
                    <span>
                      <span className="font-semibold text-foreground">
                        {pctVsPrev.toFixed(1)}%
                      </span>{" "}
                      vs etapa anterior
                      <span className="ml-1 text-muted-foreground/70">
                        · {pctVsBase.toFixed(1)}% vs base
                      </span>
                    </span>
                  )}
                </div>

                {/* Barra proporcional à etapa 1 */}
                <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      index === 0 && "bg-brand-green",
                      index === 1 && "bg-brand-yellow",
                      index === 2 && "bg-brand-coral",
                      index === 3 && "bg-brand-coral/80",
                      index === 4 && "bg-brand-green/90",
                    )}
                    style={{ width: `${Math.min(pctVsBase, 100)}%` }}
                  />
                </div>

                {step.secondaryAction && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      step.secondaryAction!.onClick();
                    }}
                    className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-red/10 text-brand-red hover:bg-brand-red/20 transition-colors"
                  >
                    <TrendingDown className="h-2.5 w-2.5" />
                    {step.secondaryAction.label}
                  </button>
                )}
              </div>
            </div>
          );

          return (
            <div key={step.id} className="relative flex items-stretch">
              <div className="flex-1">
                {step.tooltip ? (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="h-full">{stepInner}</div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        {step.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  stepInner
                )}
              </div>
              {!isLast && (
                <div className="hidden sm:flex flex-col items-center justify-center w-8 -mx-2 z-10 pointer-events-none">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm border bg-card",
                      pctNext >= 70
                        ? "text-brand-green border-brand-green/30"
                        : pctNext >= 40
                          ? "text-brand-yellow border-brand-yellow/40"
                          : "text-brand-red border-brand-red/30",
                    )}
                  >
                    {pctNext.toFixed(0)}%
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-0.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rodapé: maior queda + taxa global */}
      <div className="mt-5 pt-4 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="font-medium text-foreground">Perdas principais:</span>
          {biggestDrop.lostPct > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-brand-red/10 text-brand-red text-xs font-medium">
              <TrendingDown className="h-3 w-3" />
              {biggestDrop.from} → {biggestDrop.to}: -{biggestDrop.lostPct.toFixed(1)}%
              <span className="text-brand-red/70 font-normal">
                ({biggestDrop.lost.toLocaleString("pt-BR")} perdidos)
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground italic">Nenhuma queda significativa</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Taxa de fechamento global
          </span>
          <span className="text-base font-bold text-brand-green font-jakarta">
            {globalCloseRate.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
};
