import { motion } from 'framer-motion';
import { mockData } from '../shared/mockData';

const statusStyles = {
  success: { border: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  danger: { border: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  warning: { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  info: { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
};

const formatValue = (value: number, unit: string) => {
  if (unit === 'min' && value >= 60) {
    const h = Math.floor(value / 60);
    const m = Math.round(value % 60);
    return `${h}h ${m}min`;
  }
  if (unit === 'dias') return `${value} dias`;
  if (unit === '%') return `${value}%`;
  return `${value} ${unit}`;
};

const metricsArray = Object.values(mockData.metrics);

export const MetricsGrid = () => (
  <section className="px-6 py-4">
    <h2 className="text-xs font-bold tracking-[2px] uppercase text-white/50 mb-4">
      Métricas Críticas — Tempos
    </h2>
    <div className="grid grid-cols-3 gap-4">
      {metricsArray.map((m, i) => {
        const s = statusStyles[m.status];
        const isDanger = m.status === 'danger';
        const hasTarget = 'target' in m && m.target !== undefined;
        const targetMet = hasTarget
          ? m.unit === '%'
            ? m.value >= (m as any).target
            : m.value <= (m as any).target
          : true;

        const targetLabel = hasTarget
          ? `${targetMet ? '✅' : '🚨'} Meta: ${m.unit === '%' ? `>${(m as any).target}%` : `<${formatValue((m as any).target, m.unit)}`}`
          : 'change' in m
          ? `${(m as any).change < 0 ? '' : '+'}${(m as any).change}% vs anterior`
          : '';

        return (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + i * 0.08, duration: 0.5 }}
            className="rounded-2xl p-5 border border-white/10 backdrop-blur-xl"
            style={{
              background: s.bg,
              borderLeftWidth: 4,
              borderLeftColor: s.border,
              ...(isDanger
                ? { animation: 'pulse-danger 2s ease-in-out infinite' }
                : {}),
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{m.icon}</span>
              <span className="text-[11px] font-bold tracking-wider uppercase text-white/50">
                {m.label}
              </span>
            </div>
            <div
              className="text-[32px] font-bold tabular-nums my-2"
              style={{
                background: 'linear-gradient(135deg, #fff, rgba(255,255,255,0.8))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {formatValue(m.value, m.unit)}
            </div>
            <div className="text-xs text-white/40">{targetLabel}</div>
          </motion.div>
        );
      })}
    </div>
  </section>
);
