import { motion } from 'framer-motion';
import { AnimatedNumber } from '../shared/AnimatedNumber';
import { mockData } from '../shared/mockData';

const colorMap: Record<string, { bg: string; shadow: string }> = {
  green: { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', shadow: 'rgba(16,185,129,0.4)' },
  blue: { bg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', shadow: 'rgba(59,130,246,0.4)' },
  purple: { bg: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', shadow: 'rgba(139,92,246,0.4)' },
  orange: { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', shadow: 'rgba(245,158,11,0.4)' },
  cyan: { bg: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', shadow: 'rgba(6,182,212,0.4)' },
  emerald: { bg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', shadow: 'rgba(16,185,129,0.4)' },
};

export const SalesFunnel = () => {
  const { funnel } = mockData;
  const totalConversion = funnel.length > 1
    ? ((funnel[funnel.length - 1].value / funnel[0].value) * 100).toFixed(1)
    : '0';

  return (
    <section className="px-6 py-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
        <h2 className="text-xs font-bold tracking-[2px] uppercase text-white/50 mb-6">
          Funil de Vendas — Conversão ao Vivo
        </h2>

        <div className="flex items-center gap-2">
          {funnel.map((step, i) => {
            const c = colorMap[step.color] || colorMap.green;
            const isPositive = step.change >= 0;
            return (
              <div key={step.label} className="flex items-center gap-2 flex-1">
                <motion.div
                  className="flex-1 text-center"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="w-14 h-14 mx-auto mb-2 rounded-2xl flex items-center justify-center text-[24px]"
                    style={{ background: c.bg, boxShadow: `0 8px 24px ${c.shadow}` }}
                  >
                    {step.icon}
                  </motion.div>
                  <div
                    className="text-[28px] font-bold tabular-nums mb-0.5"
                    style={{
                      background: 'linear-gradient(135deg, #fff, rgba(255,255,255,0.8))',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    <AnimatedNumber value={step.value} />
                  </div>
                  <div className="text-[11px] text-white/50 mb-1 leading-tight">{step.label}</div>
                  <div
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      isPositive ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {isPositive ? '↑' : '↓'} {isPositive ? '+' : ''}{step.change}%
                  </div>
                </motion.div>

                {i < funnel.length - 1 && (
                  <motion.span
                    className="text-[24px] text-white/20"
                    animate={{ x: [0, 6, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    →
                  </motion.span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 text-center text-sm text-white/40">
          Conversão Total: {funnel[0].value} → {funnel[funnel.length - 1].value} = <span className="text-white/70 font-semibold">{totalConversion}%</span>
        </div>
      </div>
    </section>
  );
};
