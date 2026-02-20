import { motion } from 'framer-motion';
import { LiveIndicator } from '@/components/dashboard/shared/LiveIndicator';
import { AnimatedNumber } from '@/components/dashboard/shared/AnimatedNumber';
import { Sparkline } from '@/components/dashboard/shared/Sparkline';
import { mockData } from '@/components/dashboard/shared/mockData';
import logo from '@/assets/logo-green.png';

const statusColor: Record<string, string> = {
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

const DashboardMobile = () => {
  const { hero, funnel, metrics } = mockData;
  const metricsArray = Object.values(metrics);

  return (
    <div
      className="min-h-screen pb-8"
      style={{
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <img src={logo} alt="24Help" className="h-7" />
        <LiveIndicator />
      </header>

      {/* Hero Card - Receita */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 mt-4 rounded-2xl p-5 border border-white/10 bg-white/5 backdrop-blur-xl"
      >
        <div className="text-[11px] font-bold tracking-[2px] uppercase text-white/50 mb-2">
          💰 Receita Total
        </div>
        <div
          className="text-[40px] font-bold tabular-nums leading-none mb-2"
          style={{
            background: 'linear-gradient(135deg, #fff, rgba(255,255,255,0.8))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          <AnimatedNumber value={hero.receita.current} prefix="R$ " />
        </div>
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${hero.receita.change >= 0 ? 'text-emerald-400 bg-emerald-500/20' : 'text-red-400 bg-red-500/20'}`}>
          {hero.receita.change >= 0 ? '↑' : '↓'} {hero.receita.change >= 0 ? '+' : ''}{hero.receita.change}%
        </div>
        <div className="mt-3">
          <Sparkline data={mockData.sparklineData.receita} color="#10b981" height={36} />
        </div>
      </motion.div>

      {/* Mini Funnel */}
      <div className="grid grid-cols-3 gap-2 mx-4 mt-4">
        {funnel.map((step, i) => (
          <motion.div
            key={step.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="text-center rounded-xl p-3 border border-white/10 bg-white/5"
          >
            <div className="text-2xl mb-1">{step.icon}</div>
            <div className="text-xl font-bold text-white tabular-nums">{step.value}</div>
            <div className="text-[10px] text-white/50 leading-tight">{step.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Metrics 2-col */}
      <div className="grid grid-cols-2 gap-3 mx-4 mt-4">
        {metricsArray.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.06 }}
            className="rounded-xl p-4 border border-white/10 bg-white/5"
            style={{ borderLeftWidth: 3, borderLeftColor: statusColor[m.status] }}
          >
            <div className="text-lg mb-1">{m.icon}</div>
            <div className="text-xs text-white/50 mb-1">{m.label}</div>
            <div className="text-xl font-bold text-white tabular-nums">
              {m.value}{m.unit === '%' ? '%' : ` ${m.unit}`}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default DashboardMobile;
