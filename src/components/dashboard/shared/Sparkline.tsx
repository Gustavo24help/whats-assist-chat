import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  data: { value: number }[];
  color?: string;
  height?: number;
}

export const Sparkline = ({ data, color = '#10b981', height = 40 }: SparklineProps) => (
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={2}
        fill={`url(#spark-${color.replace('#', '')})`}
        dot={false}
        isAnimationActive={true}
        animationDuration={1500}
      />
    </AreaChart>
  </ResponsiveContainer>
);
