import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useVisualMode } from '@/contexts/VisualModeContext';
import { cn } from '@/lib/utils';

const data = [
  { day: '01', services: 4, goal: 5 },
  { day: '02', services: 6, goal: 5 },
  { day: '03', services: 3, goal: 5 },
  { day: '04', services: 7, goal: 5 },
  { day: '05', services: 5, goal: 5 },
  { day: '06', services: 8, goal: 5 },
  { day: '07', services: 4, goal: 5 },
  { day: '08', services: 6, goal: 5 },
  { day: '09', services: 9, goal: 5 },
  { day: '10', services: 5, goal: 5 },
  { day: '11', services: 7, goal: 5 },
  { day: '12', services: 4, goal: 5 },
  { day: '13', services: 6, goal: 5 },
  { day: '14', services: 8, goal: 5 },
  { day: '15', services: 5, goal: 5 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="saas-card p-3 shadow-lg border">
        <p className="text-sm font-medium text-foreground">Dia {label}</p>
        <p className="text-sm text-brand-coral">
          Serviços: <span className="font-semibold">{payload[0].value}</span>
        </p>
        <p className="text-sm text-brand-green">
          Meta: <span className="font-semibold">{payload[0].payload.goal}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const ServicesLineChart = () => {
  const { cardMode } = useVisualMode();

  const cardBgClass = cardMode === 'white' 
    ? 'bg-white' 
    : cardMode === 'tinted' 
      ? 'bg-brand-green/5' 
      : 'bg-gradient-to-br from-brand-green/10 to-brand-yellow/5';

  return (
    <div className={cn("saas-card p-4 h-80", cardBgClass)}>
      <h4 className="text-sm font-medium text-foreground mb-4">Serviços Fechados (Diário)</h4>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorServices" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(0 100% 70%)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(0 100% 70%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis 
            dataKey="day" 
            axisLine={false} 
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine 
            y={5} 
            stroke="hsl(160 100% 15%)" 
            strokeDasharray="5 5" 
            strokeWidth={2}
            label={{ 
              value: 'Meta', 
              fill: 'hsl(160 100% 15%)', 
              fontSize: 11,
              position: 'right'
            }}
          />
          <Area
            type="monotone"
            dataKey="services"
            stroke="hsl(0 100% 70%)"
            strokeWidth={2}
            fill="url(#colorServices)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
