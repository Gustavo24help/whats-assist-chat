import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useVisualMode } from '@/contexts/VisualModeContext';
import { cn } from '@/lib/utils';

const data = [
  { month: 'Set', ticket: 380 },
  { month: 'Out', ticket: 420 },
  { month: 'Nov', ticket: 395 },
  { month: 'Dez', ticket: 480 },
  { month: 'Jan', ticket: 520 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="saas-card p-3 shadow-lg border">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-brand-green">
          Ticket Médio: <span className="font-semibold">R$ {payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const TicketMedioChart = () => {
  const { cardMode } = useVisualMode();

  const cardBgClass = cardMode === 'white' 
    ? 'bg-white' 
    : cardMode === 'tinted' 
      ? 'bg-brand-green/5' 
      : 'bg-gradient-to-br from-brand-green/10 to-brand-yellow/5';

  return (
    <div className={cn("saas-card p-4 h-80", cardBgClass)}>
      <h4 className="text-sm font-medium text-foreground mb-4">Ticket Médio (Mensal)</h4>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis 
            dataKey="month" 
            axisLine={false} 
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickFormatter={(value) => `R$${value}`}
            domain={['dataMin - 50', 'dataMax + 50']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="ticket"
            stroke="hsl(160 100% 15%)"
            strokeWidth={3}
            dot={{ fill: 'hsl(160 100% 15%)', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 7, fill: 'hsl(160 100% 15%)', stroke: 'white', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
