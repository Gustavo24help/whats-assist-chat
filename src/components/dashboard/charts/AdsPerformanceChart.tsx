import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useVisualMode } from '@/contexts/VisualModeContext';
import { useGoogleAdsWeeklyData, FALLBACK_WEEKLY_DATA } from '@/hooks/useGoogleAdsMetrics';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="saas-card p-3 shadow-lg border">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-semibold">
              {entry.name === 'Custo' ? `R$ ${entry.value.toLocaleString('pt-BR')}` : entry.value}
            </span>
          </p>
        ))}
        {payload.length === 2 && payload[1].value > 0 && (
          <p className="text-sm text-muted-foreground mt-1 pt-1 border-t">
            CPA: R$ {(payload[0].value / payload[1].value).toFixed(2)}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export const AdsPerformanceChart = () => {
  const { cardMode } = useVisualMode();
  const { data: weeklyData, isLoading } = useGoogleAdsWeeklyData();
  
  const chartData = weeklyData || FALLBACK_WEEKLY_DATA;

  const cardBgClass = cardMode === 'white' 
    ? 'bg-white' 
    : cardMode === 'tinted' 
      ? 'bg-brand-green/5' 
      : 'bg-gradient-to-br from-brand-green/10 to-brand-yellow/5';

  if (isLoading) {
    return (
      <div className={cn("saas-card p-4 h-80", cardBgClass)}>
        <h4 className="text-sm font-medium text-foreground mb-4">Custo vs Conversões (Semanal)</h4>
        <Skeleton className="w-full h-[85%]" />
      </div>
    );
  }

  return (
    <div className={cn("saas-card p-4 h-80", cardBgClass)}>
      <h4 className="text-sm font-medium text-foreground mb-4">Custo vs Conversões (Semanal)</h4>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis 
            dataKey="week" 
            axisLine={false} 
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <YAxis 
            yAxisId="left"
            axisLine={false} 
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickFormatter={(value) => `R$${value}`}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            axisLine={false} 
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
            iconType="circle"
          />
          <Bar 
            yAxisId="left"
            dataKey="cost" 
            name="Custo"
            fill="hsl(45 89% 48%)" 
            radius={[4, 4, 0, 0]}
            barSize={20}
          />
          <Bar 
            yAxisId="right"
            dataKey="conversions" 
            name="Conversões"
            fill="hsl(160 100% 15%)" 
            radius={[4, 4, 0, 0]}
            barSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
