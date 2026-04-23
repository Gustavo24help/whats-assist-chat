import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GitCompareArrows, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { ComparisonMode } from '@/hooks/useOperationalKPIs';

interface ComparisonModeSelectorProps {
  mode: ComparisonMode;
  range?: { from: Date; to: Date };
  onChange: (mode: ComparisonMode, range?: { from: Date; to: Date }) => void;
}

const MODE_OPTIONS: { value: ComparisonMode; label: string; description: string }[] = [
  {
    value: 'previous-month',
    label: 'Mesmo período do mês anterior',
    description: 'Compara com o mesmo intervalo de dias do mês anterior',
  },
  {
    value: 'avg-3-months',
    label: 'Média dos 3 meses anteriores',
    description: 'Média do mesmo intervalo dos 3 meses anteriores',
  },
  {
    value: 'custom',
    label: 'Personalizada',
    description: 'Escolher período comparativo manualmente',
  },
];

export const ComparisonModeSelector = ({
  mode,
  range,
  onChange,
}: ComparisonModeSelectorProps) => {
  const [tempRange, setTempRange] = useState<{ from?: Date; to?: Date }>({
    from: range?.from,
    to: range?.to,
  });

  const currentLabel =
    MODE_OPTIONS.find((o) => o.value === mode)?.label || 'Comparar com';

  const handleSelect = (value: ComparisonMode) => {
    if (value === 'custom') {
      onChange(value, range);
    } else {
      onChange(value, undefined);
    }
  };

  const handleRangeSelect = (r: { from?: Date; to?: Date } | undefined) => {
    if (!r) return;
    setTempRange(r);
    if (r.from && r.to) {
      onChange('custom', { from: r.from, to: r.to });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <GitCompareArrows className="h-4 w-4" />
            <span className="max-w-[200px] truncate">{currentLabel}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {MODE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={cn(
                'flex flex-col items-start gap-0.5 py-2',
                mode === option.value && 'bg-muted',
              )}
            >
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {mode === 'custom' && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span>
                {range?.from && range?.to
                  ? `${format(range.from, 'dd MMM', { locale: ptBR })} - ${format(range.to, 'dd MMM', { locale: ptBR })}`
                  : 'Escolher período'}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={tempRange as any}
              onSelect={handleRangeSelect as any}
              locale={ptBR}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
