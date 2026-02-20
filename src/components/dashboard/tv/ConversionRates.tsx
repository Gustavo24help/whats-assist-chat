import { motion } from 'framer-motion';
import { mockData } from '../shared/mockData';

const statusColors = {
  success: { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', icon: '✅' },
  warning: { text: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', icon: '⚠️' },
  danger: { text: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', icon: '🚨' },
};

export const ConversionRates = () => {
  const { taxasConversao } = mockData;

  return (
    <section className="px-6 py-4">
      <h2 className="text-xs font-bold tracking-[2px] uppercase text-white/50 mb-4">
        Taxas de Conversão
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {taxasConversao.map((taxa, i) => {
          const s = statusColors[taxa.status];
          const progressPct = Math.min((taxa.valor / taxa.meta) * 100, 100);

          return (
            <motion.div
              key={taxa.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.06, duration: 0.4 }}
              className="rounded-xl p-4 border border-white/10 bg-white/5 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-white/50">
                  {taxa.label}
                </span>
                <span className="text-xs">{s.icon}</span>
              </div>
              <div className="flex items-end gap-2 mb-2">
                <span
                  className="text-[28px] font-bold tabular-nums"
                  style={{
                    background: 'linear-gradient(135deg, #fff, rgba(255,255,255,0.8))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {taxa.valor}%
                </span>
                <span className="text-[10px] text-white/30 mb-1.5">({taxa.calculo})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${taxa.status === 'success' ? 'bg-emerald-500' : taxa.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ delay: 0.5 + i * 0.08, duration: 1 }}
                  />
                </div>
                <span className="text-[10px] text-white/40">Meta: {taxa.meta}%</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
