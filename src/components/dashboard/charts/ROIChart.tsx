import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useVisualMode } from '@/contexts/VisualModeContext';
import { cn } from '@/lib/utils';

const data = [
  { name: 'Receita', value: 45820, color: 'hsl(160 100% 15%)' },
  { name: 'Custo Ads', value: 4480, color: 'hsl(45 89% 48%)' },
  { name: 'Lucro', value: 41340, color: 'hsl(0 100% 70%)' },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    return (
      <div className="saas-card p-3 shadow-lg border">
        <p className="text-sm font-medium" style={{ color: entry.payload.color }}>
          {entry.name}
        </p>
        <p className="text-sm text-foreground font-semibold">
          R$ {entry.value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export const ROIChart = () => {
  const { cardMode } = useVisualMode();
  
  // Calculate ROI: (Lucro / Custo) * 100
  const roi = ((data[2].value / data[1].value) * 100).toFixed(0);

  const cardBgClass = cardMode === 'white' 
    ? 'bg-white' 
    : cardMode === 'tinted' 
      ? 'bg-brand-green/5' 
      : 'bg-gradient-to-br from-brand-green/10 to-brand-yellow/5';

  return (
    <div className={cn("saas-card p-4 h-80", cardBgClass)}>
      <h4 className="text-sm font-medium text-foreground mb-4">ROI - Retorno sobre Investimento</h4>
      <div className="relative h-[85%]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center ROI Label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-3xl font-bold text-brand-green">{roi}%</p>
            <p className="text-xs text-muted-foreground">ROI</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-muted-foreground">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
