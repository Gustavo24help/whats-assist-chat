import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useVisualMode } from '@/contexts/VisualModeContext';
import { cn } from '@/lib/utils';

const data = [
  { week: 'Sem 1', cost: 850, conversions: 28 },
  { week: 'Sem 2', cost: 1200, conversions: 42 },
  { week: 'Sem 3', cost: 980, conversions: 35 },
  { week: 'Sem 4', cost: 1450, conversions: 52 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="saas-card p-3 shadow-lg border">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-semibold">
              {entry.name === 'Custo' ? `R$ ${entry.value}` : entry.value}
            </span>
          </p>
        ))}
        {payload.length === 2 && (
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

  const cardBgClass = cardMode === 'white' 
    ? 'bg-white' 
    : cardMode === 'tinted' 
      ? 'bg-brand-green/5' 
      : 'bg-gradient-to-br from-brand-green/10 to-brand-yellow/5';

  return (
    <div className={cn("saas-card p-4 h-80", cardBgClass)}>
      <h4 className="text-sm font-medium text-foreground mb-4">Custo vs Conversões (Semanal)</h4>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
