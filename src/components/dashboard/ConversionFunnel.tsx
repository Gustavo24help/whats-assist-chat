import { useState } from "react";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useVisualMode } from "@/contexts/VisualModeContext";

export interface FunnelStepData {
  id: string;
  label: string;
  value: number;
  variation: number | null;
  bgColor: string;
}

interface ConversionFunnelProps {
  data: FunnelStepData[];
  isLoading?: boolean;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace('.0', '') + 'k';
  return num.toLocaleString('pt-BR');
};

export const ConversionFunnel = ({ data, isLoading }: ConversionFunnelProps) => {
  const { cardMode } = useVisualMode();
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

  const cardBgClass = cardMode === 'white'
    ? 'bg-white'
    : cardMode === 'tinted'
      ? 'bg-brand-green/5'
      : 'bg-gradient-to-br from-brand-green/10 to-brand-yellow/5';

  if (isLoading) {
    return (
      <div className={cn("saas-card p-6", cardBgClass)}>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);

  // Largura proporcional, com mínimo de 18% para legibilidade
  const getWidth = (value: number) => {
    const pct = (value / maxValue) * 100;
    return Math.max(pct, 18);
  };

  // Taxa de conversão entre etapas
  const conversionRates = data.slice(1).map((step, index) => {
    const prev = data[index].value;
    const rate = prev > 0 ? (step.value / prev) * 100 : 0;
    return rate.toFixed(1);
  });

  return (
    <div className={cn("saas-card p-6", cardBgClass)}>
      <div className="flex flex-col items-center gap-1">
        {data.map((step, index) => {
          const width = getWidth(step.value);
          const nextWidth = index < data.length - 1 ? getWidth(data[index + 1].value) : width;
          const conversionToNext = index < data.length - 1 ? conversionRates[index] : null;
          const variation = step.variation;
          const isHovered = hoveredStep === step.id;

          return (
            <div key={step.id} className="w-full flex flex-col items-center">
              {/* Funnel segment */}
              <div className="w-full flex items-center justify-center gap-4">
                {/* Label esquerda */}
                <div className="hidden sm:block w-44 text-right text-sm font-medium text-foreground">
                  {step.label}
                </div>

                {/* Trapézio */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="relative h-14 cursor-pointer transition-all duration-300 flex items-center justify-center"
                      style={{
                        width: `${width}%`,
                        clipPath: `polygon(0 0, 100% 0, ${50 + (nextWidth / width) * 50}% 100%, ${50 - (nextWidth / width) * 50}% 100%)`,
                      }}
                      onMouseEnter={() => setHoveredStep(step.id)}
                      onMouseLeave={() => setHoveredStep(null)}
                    >
                      <div
                        className={cn(
                          "absolute inset-0 transition-all duration-300",
                          step.bgColor,
                          isHovered && "brightness-110"
                        )}
                      />
                      <div className="relative z-10 flex flex-col items-center justify-center px-3 text-center">
                        <span className="text-base font-bold text-white drop-shadow-sm leading-tight">
                          {formatNumber(step.value)}
                        </span>
                        <span className="sm:hidden text-[10px] font-medium text-white/90 drop-shadow-sm leading-tight">
                          {step.label}
                        </span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="space-y-1">
                      <p className="font-medium">{step.label}</p>
                      <p>Valor: {step.value.toLocaleString('pt-BR')}</p>
                      {variation !== null && (
                        <p className={variation >= 0 ? "text-brand-green" : "text-brand-red"}>
                          Variação: {variation >= 0 ? '+' : ''}{variation.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Variação direita */}
                <div className="w-20 flex-shrink-0 flex items-center gap-1 text-sm">
                  {variation === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : variation >= 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-brand-green" />
                      <span className="font-medium text-brand-green">
                        +{variation.toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3 text-brand-red" />
                      <span className="font-medium text-brand-red">
                        {variation.toFixed(1)}%
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Taxa entre etapas */}
              {conversionToNext !== null && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground py-1">
                  <ArrowRight className="h-3 w-3 rotate-90" />
                  <span>Taxa: {conversionToNext}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
