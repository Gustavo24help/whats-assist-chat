import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  Bell,
  RefreshCw,
  Calendar as CalendarIcon,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';

type PeriodOption = 'today' | '7days' | '30days' | 'month' | 'custom';

interface PeriodConfig {
  label: string;
  value: PeriodOption;
}

const periodOptions: PeriodConfig[] = [
  { label: 'Hoje', value: 'today' },
  { label: 'Últimos 7 dias', value: '7days' },
  { label: 'Últimos 30 dias', value: '30days' },
  { label: 'Este mês', value: 'month' },
  { label: 'Personalizado', value: 'custom' },
];

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
  onSearch?: (query: string) => void;
  onPeriodChange?: (period: PeriodOption, dateRange?: { from: Date; to: Date }) => void;
  notificationCount?: number;
  isRefreshing?: boolean;
  className?: string;
}

export const Header = ({
  title = 'Visão Executiva',
  subtitle,
  onRefresh,
  onSearch,
  onPeriodChange,
  notificationCount = 0,
  isRefreshing = false,
  className,
}: HeaderProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('30days');
  const [dateRange, setDateRange] = useState<{ from: Date; to?: Date }>({
    from: new Date(),
  });
  const [showSearch, setShowSearch] = useState(false);

  const handlePeriodChange = (period: PeriodOption) => {
    setSelectedPeriod(period);
    if (period !== 'custom') {
      onPeriodChange?.(period);
    }
  };

  const handleDateSelect = (range: { from: Date; to?: Date } | undefined) => {
    if (range) {
      setDateRange(range);
      if (range.from && range.to) {
        onPeriodChange?.('custom', { from: range.from, to: range.to });
      }
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  const getSelectedPeriodLabel = () => {
    if (selectedPeriod === 'custom' && dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'dd MMM', { locale: ptBR })} - ${format(dateRange.to, 'dd MMM', { locale: ptBR })}`;
    }
    return periodOptions.find(p => p.value === selectedPeriod)?.label || 'Selecionar período';
  };

  return (
    <header className={cn('flex items-center justify-between py-4 px-6 bg-background border-b', className)}>
      {/* Title Section */}
      <div>
        <h1 className="text-2xl font-bold text-foreground font-jakarta">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Actions Section */}
      <div className="flex items-center gap-3">
        {/* Search */}
        {showSearch ? (
          <div className="relative animate-fade-in">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={handleSearchChange}
              onBlur={() => !searchQuery && setShowSearch(false)}
              className="pl-9 w-64"
              autoFocus
            />
          </div>
        ) : (
          <Button variant="ghost" size="icon" onClick={() => setShowSearch(true)}>
            <Search className="h-5 w-5" />
          </Button>
        )}

        {/* Period Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span>{getSelectedPeriodLabel()}</span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {periodOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => handlePeriodChange(option.value)}
                className={cn(selectedPeriod === option.value && 'bg-muted')}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Custom Date Range Picker */}
        {selectedPeriod === 'custom' && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon">
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={handleDateSelect as any}
                locale={ptBR}
                className="pointer-events-auto"
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        )}

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-brand-red text-white text-xs font-bold flex items-center justify-center"
            >
              {notificationCount > 99 ? '99+' : notificationCount}
            </Badge>
          )}
        </Button>

        {/* Refresh */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn('h-5 w-5', isRefreshing && 'animate-spin')} />
        </Button>
      </div>
    </header>
  );
};
