import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { AnimatedNumber } from '../shared/AnimatedNumber';
import { Sparkline } from '../shared/Sparkline';
import { mockData } from '../shared/mockData';

const cards = [
  {
    label: 'REVENUE',
    icon: '💰',
    data: mockData.hero.revenue,
    sparkline: mockData.sparklineData.revenue,
    prefix: 'R$ ',
    color: '#10b981',
    goalLabel: 'Meta',
  },
  {
    label: 'PROFIT',
    icon: '📈',
    data: mockData.hero.profit,
    sparkline: mockData.sparklineData.profit,
    prefix: 'R$ ',
    color: '#3b82f6',
    goalLabel: 'Margem',
    extra: `${mockData.hero.profit.margin}%`,
  },
  {
    label: 'SERVICES',
    icon: '🏆',
    data: mockData.hero.services,
    sparkline: mockData.sparklineData.services,
    prefix: '',
    color: '#8b5cf6',
    goalLabel: 'Meta',
  },
];

export const HeroKPIs = () => (
  <div className="grid grid-cols-3 gap-6 px-6 py-6">
    {cards.map((card, i) => {
      const target = 'target' in card.data ? card.data.target : undefined;
      const margin = 'margin' in card.data ? card.data.margin : undefined;
      const progress = target
        ? Math.min((card.data.current / target) * 100, 100)
        : margin || 0;
      const isPositive = card.data.change >= 0;

      return (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.15, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          whileHover={{ y: -4, transition: { duration: 0.3 } }}
          className="relative rounded-[20px] p-6 border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.37)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: `${card.color}22`, boxShadow: `0 4px 12px ${card.color}33` }}
              >
                {card.icon}
              </div>
              <span className="text-[11px] font-bold tracking-[2px] uppercase text-white/50">
                {card.label}
              </span>
            </div>
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                isPositive
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/20 border border-red-500/30 text-red-400'
              }`}
            >
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <motion.span
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {isPositive ? '+' : ''}{card.data.change.toFixed(1)}%
              </motion.span>
            </div>
          </div>

          {/* Value */}
          <div className="mb-3">
            <div
              className="text-[48px] font-bold tabular-nums leading-none"
              style={{
                background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              <AnimatedNumber value={card.data.current} prefix={card.prefix} />
            </div>
          </div>

          {/* Sparkline */}
          <div className="mb-4 -mx-2">
            <Sparkline data={card.sparkline} color={card.color} height={48} />
          </div>

          {/* Footer */}
          <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="text-xs text-white/40">
              vs Ontem: {card.prefix}{card.data.previous.toLocaleString('pt-BR')}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">{card.goalLabel}: {Math.round(progress)}%</span>
              <span className="text-white/30">
                {card.extra || `${card.prefix}${target?.toLocaleString('pt-BR') ?? ''}`}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: card.color }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ delay: 0.5 + i * 0.15, duration: 1.2, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
      );
    })}
  </div>
);
