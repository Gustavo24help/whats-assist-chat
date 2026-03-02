import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  dailyActual: number;
  dailyTarget: number;
  monthlyActual: number;
  monthlyTarget: number;
  onEditMetas: () => void;
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function GoalBar({ label, actual, target }: { label: string; actual: number; target: number }) {
  const pct = target > 0 ? Math.min((actual / target) * 100, 120) : 0;
  const barPct = Math.min(pct, 100);

  const barColor =
    pct >= 100 ? 'from-emerald-400 to-emerald-500' :
    pct >= 80 ? 'from-amber-400 to-yellow-500' :
    pct >= 50 ? 'from-cyan-400 to-blue-500' :
    'from-red-400 to-red-500';

  const glowColor =
    pct >= 100 ? 'shadow-[0_0_15px_rgba(16,185,129,0.5)]' :
    pct >= 80 ? 'shadow-[0_0_15px_rgba(245,158,11,0.4)]' :
    '';

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-300">{label}</span>
        <span className="text-xs text-gray-400">
          <span className="text-white font-bold">{fmtCurrency(actual)}</span>
          <span className="text-gray-500"> / {fmtCurrency(target)}</span>
          <span className={cn('ml-2 font-bold', pct >= 100 ? 'text-emerald-400' : pct >= 80 ? 'text-amber-400' : 'text-gray-400')}>
            {pct.toFixed(0)}%
          </span>
        </span>
      </div>
      <div className={cn('h-3 rounded-full bg-gray-800/80 overflow-hidden', glowColor)}>
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out', barColor)}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  );
}

export function TVGoalBars({ dailyActual, dailyTarget, monthlyActual, monthlyTarget, onEditMetas }: Props) {
  return (
    <div className="px-4 py-2 flex items-center gap-6">
      <GoalBar label="🎯 Meta do Dia" actual={dailyActual} target={dailyTarget} />
      <GoalBar label="📅 Meta do Mês" actual={monthlyActual} target={monthlyTarget} />
      <button
        onClick={onEditMetas}
        className="p-1.5 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-white/5 transition-colors"
        title="Editar metas"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
