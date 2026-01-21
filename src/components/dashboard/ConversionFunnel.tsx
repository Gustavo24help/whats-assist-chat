import { useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Award, ArrowRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useVisualMode } from "@/contexts/VisualModeContext";

interface FunnelStep {
  id: string;
  label: string;
  value: number;
  previousValue: number;
  color: string;
  bgColor: string;
}

const funnelData: FunnelStep[] = [
  { 
    id: "impressions", 
    label: "Impressões", 
    value: 125000, 
    previousValue: 118000,
    color: "text-brand-green",
    bgColor: "bg-brand-green"
  },
  { 
    id: "clicks", 
    label: "Cliques", 
    value: 4875, 
    previousValue: 4200,
    color: "text-brand-green",
    bgColor: "bg-brand-green/80"
  },
  { 
    id: "conversations", 
    label: "Conversas Iniciadas", 
    value: 892, 
    previousValue: 756,
    color: "text-brand-yellow",
    bgColor: "bg-brand-yellow"
  },
  { 
    id: "fichas", 
    label: "Fichas de Serviço", 
    value: 423, 
    previousValue: 398,
    color: "text-brand-coral",
    bgColor: "bg-brand-coral"
  },
  { 
    id: "closed", 
    label: "Serviços Fechados", 
    value: 127, 
    previousValue: 112,
    color: "text-brand-coral",
    bgColor: "bg-brand-coral/80"
  },
];

const formatNumber = (num: number): string => {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace('.0', '') + 'k';
  }
  return num.toString();
};

const calculateConversionRate = (current: number, previous: number): string => {
  return ((current / previous) * 100).toFixed(1) + '%';
};

const calculateVariation = (current: number, previous: number): number => {
  return ((current - previous) / previous) * 100;
};

export const ConversionFunnel = () => {
  const { cardMode } = useVisualMode();
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

  const maxValue = funnelData[0].value;
  
  // Calculate conversion rates between steps
  const conversionRates = funnelData.slice(1).map((step, index) => ({
    from: funnelData[index].label,
    to: step.label,
    rate: calculateConversionRate(step.value, funnelData[index].value),
    rawRate: (step.value / funnelData[index].value) * 100,
  }));

  // Find bottleneck (lowest conversion rate) and best improvement
  const sortedRates = [...conversionRates].sort((a, b) => a.rawRate - b.rawRate);
  const bottleneck = sortedRates[0];
  const bestImprovement = funnelData.reduce((best, step) => {
    const variation = calculateVariation(step.value, step.previousValue);
    return variation > best.variation ? { step, variation } : best;
  }, { step: funnelData[0], variation: -Infinity });

  // Total conversion rate
  const totalConversion = ((funnelData[funnelData.length - 1].value / funnelData[0].value) * 100).toFixed(2);

  const cardBgClass = cardMode === 'white' 
    ? 'bg-white' 
    : cardMode === 'tinted' 
      ? 'bg-brand-green/5' 
      : 'bg-gradient-to-br from-brand-green/10 to-brand-yellow/5';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cn("saas-card p-4", cardBgClass)}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-brand-green" />
            <span className="text-sm text-muted-foreground">Conversão Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalConversion}%</p>
          <p className="text-xs text-muted-foreground mt-1">Impressões → Serviços</p>
        </div>

        <div className={cn("saas-card p-4 border-brand-coral/30", cardBgClass)}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-brand-coral" />
            <span className="text-sm text-muted-foreground">Maior Gargalo</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{bottleneck.rate}</p>
          <p className="text-xs text-muted-foreground mt-1">{bottleneck.from} → {bottleneck.to}</p>
        </div>

        <div className={cn("saas-card p-4 border-brand-green/30", cardBgClass)}>
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-4 w-4 text-brand-green" />
            <span className="text-sm text-muted-foreground">Maior Melhoria</span>
          </div>
          <p className="text-2xl font-bold text-foreground">+{bestImprovement.variation.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1">{bestImprovement.step.label}</p>
        </div>
      </div>

      {/* Funnel Visualization */}
      <div className={cn("saas-card p-6", cardBgClass)}>
        <div className="space-y-3">
          {funnelData.map((step, index) => {
            const width = (step.value / maxValue) * 100;
            const variation = calculateVariation(step.value, step.previousValue);
            const isBottleneck = index > 0 && conversionRates[index - 1] === bottleneck;
            const isBestImprovement = step === bestImprovement.step;
            const conversionToNext = index < funnelData.length - 1 
              ? conversionRates[index] 
              : null;

            return (
              <div key={step.id} className="space-y-1">
                <div className="flex items-center gap-4">
                  {/* Label */}
                  <div className="w-40 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{step.label}</span>
                      {isBottleneck && (
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="px-1.5 py-0.5 text-[10px] bg-brand-coral/20 text-brand-coral rounded-full">
                              Gargalo
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Menor taxa de conversão do funil</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {isBestImprovement && (
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="px-1.5 py-0.5 text-[10px] bg-brand-green/20 text-brand-green rounded-full">
                              Melhoria
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Maior crescimento vs mês anterior</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="flex-1 relative">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="relative h-10 rounded-lg overflow-hidden cursor-pointer transition-all duration-300"
                          onMouseEnter={() => setHoveredStep(step.id)}
                          onMouseLeave={() => setHoveredStep(null)}
                          style={{ width: `${Math.max(width, 5)}%` }}
                        >
                          <div 
                            className={cn(
                              "absolute inset-0 transition-all duration-300",
                              step.bgColor,
                              hoveredStep === step.id && "brightness-110"
                            )}
                          />
                          {hoveredStep === step.id && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                          )}
                          <div className="absolute inset-0 flex items-center px-3">
                            <span className="text-sm font-semibold text-white drop-shadow-sm">
                              {formatNumber(step.value)}
                            </span>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="font-medium">{step.label}</p>
                          <p>Atual: {step.value.toLocaleString()}</p>
                          <p>Mês anterior: {step.previousValue.toLocaleString()}</p>
                          <p className={variation >= 0 ? "text-brand-green" : "text-brand-red"}>
                            Variação: {variation >= 0 ? '+' : ''}{variation.toFixed(1)}%
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Variation */}
                  <div className="w-20 flex-shrink-0 flex items-center gap-1">
                    {variation >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-brand-green" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-brand-red" />
                    )}
                    <span className={cn(
                      "text-sm font-medium",
                      variation >= 0 ? "text-brand-green" : "text-brand-red"
                    )}>
                      {variation >= 0 ? '+' : ''}{variation.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Conversion rate to next step */}
                {conversionToNext && (
                  <div className="flex items-center gap-4 pl-44">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ArrowRight className="h-3 w-3" />
                      <span>Taxa: {conversionToNext.rate}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
