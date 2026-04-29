import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ExecKPIItem {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  variation: number | null;
  icon?: ReactNode;
  highlight?: boolean;
  tooltip?: string;
  onClick?: () => void;
}

const VariationPill = ({ variation }: { variation: number | null }) => {
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

interface FinancialKPIsBlockProps {
  items: ExecKPIItem[];
  comparisonLabel: string;
}

export const FinancialKPIsBlock = ({
  items,
  comparisonLabel,
}: FinancialKPIsBlockProps) => {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-foreground font-jakarta">
          Financeiro
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {comparisonLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((kpi) => (
          <div
            key={kpi.id}
            onClick={kpi.onClick}
            role={kpi.onClick ? "button" : undefined}
            tabIndex={kpi.onClick ? 0 : undefined}
            onKeyDown={(e) => {
              if (kpi.onClick && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                kpi.onClick();
              }
            }}
            className={cn(
              "rounded-xl border bg-card p-4 transition-all flex flex-col gap-2",
              kpi.onClick &&
                "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
              kpi.highlight
                ? "border-2 border-brand-green/60 bg-brand-green/[0.04] shadow-sm hover:border-brand-green"
                : "hover:border-brand-green/30",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {kpi.icon && (
                  <span
                    className={cn(
                      "shrink-0 text-muted-foreground",
                      kpi.highlight && "text-brand-green",
                    )}
                  >
                    {kpi.icon}
                  </span>
                )}
                <span
                  className={cn(
                    "text-xs font-medium truncate",
                    kpi.highlight
                      ? "text-brand-green"
                      : "text-muted-foreground",
                  )}
                >
                  {kpi.label}
                </span>
                {kpi.tooltip && (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Sobre este KPI"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground/50 hover:text-foreground transition-colors shrink-0"
                        >
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        {kpi.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <VariationPill variation={kpi.variation} />
            </div>

            <div>
              <div
                className={cn(
                  "font-bold text-foreground font-jakarta leading-none",
                  kpi.highlight ? "text-3xl" : "text-2xl",
                )}
              >
                {kpi.value}
              </div>
              {kpi.subValue && (
                <div className="text-[11px] text-muted-foreground/80 mt-1">
                  {kpi.subValue}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

interface VolumeKPIsBlockProps {
  items: ExecKPIItem[];
  comparisonLabel: string;
}

export const VolumeKPIsBlock = ({
  items,
  comparisonLabel,
}: VolumeKPIsBlockProps) => {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-foreground font-jakarta">
          Volume de atendimento
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {comparisonLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {items.map((kpi) => (
          <div
            key={kpi.id}
            onClick={kpi.onClick}
            role={kpi.onClick ? "button" : undefined}
            tabIndex={kpi.onClick ? 0 : undefined}
            onKeyDown={(e) => {
              if (kpi.onClick && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                kpi.onClick();
              }
            }}
            className={cn(
              "rounded-lg border border-border/60 bg-muted/40 p-3 transition-all flex flex-col gap-1.5",
              kpi.onClick &&
                "cursor-pointer hover:bg-muted/70 hover:border-border",
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
                {kpi.label}
              </span>
              <VariationPill variation={kpi.variation} />
            </div>
            <div className="text-xl font-bold text-foreground font-jakarta leading-none">
              {kpi.value}
            </div>
            {kpi.subValue && (
              <div className="text-[10px] text-muted-foreground/80 truncate">
                {kpi.subValue}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
