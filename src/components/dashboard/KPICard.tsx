import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { useVisualMode } from '@/contexts/VisualModeContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type IconColor = 'brand-green' | 'yellow' | 'coral' | 'red';
type CardSize = 'sm' | 'md' | 'lg';

export interface KPICardProps {
  label: string;
  value: string | number;
  subValue?: string;
  variation?: number | null;
  comparisonLabel?: string;
  icon?: ReactNode;
  iconColor?: IconColor;
  size?: CardSize;
  animationDelay?: number;
  className?: string;
  /** Texto explicativo da fonte/evento usado neste KPI. Renderiza ícone (i) com tooltip. */
  tooltip?: string;
}

const iconColorClasses: Record<IconColor, string> = {
  'brand-green': 'icon-container brand-green',
  'yellow': 'icon-container brand-yellow',
  'coral': 'icon-container brand-coral',
  'red': 'icon-container brand-red',
};

const sizeClasses: Record<CardSize, { wrapper: string; value: string; label: string }> = {
  sm: { wrapper: 'p-4', value: 'text-2xl', label: 'text-xs' },
  md: { wrapper: 'p-5', value: 'text-3xl', label: 'text-sm' },
  lg: { wrapper: 'p-6', value: 'text-4xl', label: 'text-base' },
};

export const KPICard = ({
  label,
  value,
  subValue,
  variation,
  comparisonLabel = 'vs período comparativo',
  icon,
  iconColor = 'brand-green',
  size = 'md',
  animationDelay = 0,
  className,
  tooltip,
}: KPICardProps) => {
  const { cardMode, accentIntensity } = useVisualMode();

  const getVariationStyles = () => {
    if (variation === undefined || variation === null) return null;
    if (variation === 0) {
      return { className: 'variation-neutral', Icon: Minus, prefix: '' };
    }
    if (variation > 0) {
      return { className: 'variation-positive', Icon: TrendingUp, prefix: '+' };
    }
    return { className: 'variation-negative', Icon: TrendingDown, prefix: '' };
  };

  const variationData = getVariationStyles();
  const sizes = sizeClasses[size];

  const getCardModeClass = () => {
    switch (cardMode) {
      case 'tinted': return 'kpi-card-tinted';
      case 'vibrant': return 'kpi-card-vibrant';
      default: return '';
    }
  };

  const getAccentIntensityClass = () => {
    switch (accentIntensity) {
      case 'subtle': return 'opacity-70';
      case 'bold': return 'scale-110';
      default: return '';
    }
  };

  return (
    <div
      className={cn(
        'kpi-card animate-fade-in',
        sizes.wrapper,
        getCardModeClass(),
        className,
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
      data-icon-color={iconColor}
    >
      <div className="flex items-start justify-between mb-4">
        {icon && (
          <div className={cn(iconColorClasses[iconColor], getAccentIntensityClass())}>
            {icon}
          </div>
        )}
        {variationData && (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              variationData.className,
            )}
          >
            <variationData.Icon className="h-3 w-3" />
            <span>
              {variationData.prefix}
              {Math.abs(variation!).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className={cn('font-bold text-foreground font-jakarta', sizes.value)}>
          {value}
        </div>
        {subValue && (
          <div className="text-xs text-muted-foreground/80">{subValue}</div>
        )}
        <div
          className={cn(
            'text-muted-foreground font-medium flex items-center gap-1.5',
            sizes.label,
          )}
        >
          <span>{label}</span>
          {tooltip && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Sobre este KPI"
                    className="text-muted-foreground/60 hover:text-foreground transition-colors"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {variationData && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <span className="text-xs text-muted-foreground">{comparisonLabel}</span>
        </div>
      )}
    </div>
  );
};
