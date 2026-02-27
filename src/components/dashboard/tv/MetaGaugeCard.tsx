import React from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Eye, EyeOff, TrendingUp, TrendingDown, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabPeriod = 'diario' | 'semanal' | 'mensal' | 'anual';

export type MetaSource = 'manual' | 'fichas_finalizadas' | 'receita_os' | 'status_filter';

export interface MetaGoal {
  id: string;
  name: string;
  icon: string;
  visible: boolean;
  source: MetaSource;
  statusFilter?: string[];
  targets: Record<TabPeriod, number>;
  actuals: Record<TabPeriod, number>;
}

const PERIOD_LABELS: Record<TabPeriod, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  mensal: 'Mensal',
  anual: 'Anual',
};

const SOURCE_LABELS: Record<MetaSource, string> = {
  manual: 'Manual',
  fichas_finalizadas: 'Serviços Realizados (BD)',
  receita_os: 'Receita OS (BD)',
  status_filter: 'Filtro por Status (BD)',
};

function getColor(pct: number) {
  if (pct >= 100) return { arc: '#a855f7', label: 'text-purple-400', bg: 'from-purple-500/10 to-purple-500/5 border-purple-500/30' };
  if (pct >= 80) return { arc: '#22c55e', label: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/30' };
  if (pct >= 50) return { arc: '#eab308', label: 'text-amber-400', bg: 'from-amber-500/10 to-amber-500/5 border-amber-500/30' };
  return { arc: '#ef4444', label: 'text-red-400', bg: 'from-red-500/10 to-red-500/5 border-red-500/30' };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy - r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy - r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`;
}

function Gauge({ percentage, color }: { percentage: number; color: string }) {
  const size = 120;
  const clampPct = Math.min(percentage, 120);
  const radius = size * 0.4;
  const strokeWidth = size * 0.09;
  const cx = size / 2;
  const cy = size * 0.46;
  const startAngle = Math.PI;
  const fillAngle = startAngle - (clampPct / 120) * Math.PI;

  const bgPath = describeArc(cx, cy, radius, 0, startAngle);
  const fillPath = describeArc(cx, cy, radius, fillAngle, startAngle);
  const gradId = `grad-${color.replace('#', '')}-single`;

  return (
    <svg viewBox={`0 0 ${size} ${size * 0.55}`} className="w-full mx-auto" style={{ maxWidth: size }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={1} />
        </linearGradient>
      </defs>
      <path d={bgPath} fill="none" stroke="#374151" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d={fillPath} fill="none" stroke={`url(#${gradId})`} strokeWidth={strokeWidth} strokeLinecap="round" />
      <text x={cx} y={cy - 2} textAnchor="middle" className="fill-white font-bold" style={{ fontSize: size * 0.2 }}>
        {percentage.toFixed(0)}%
      </text>
    </svg>
  );
}

/** A single card = 1 goal + 1 period */
interface SingleCardProps {
  goal: MetaGoal;
  period: TabPeriod;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onDelete?: () => void;
  isDragging?: boolean;
  dragHandleProps?: {
    onMouseDown: (e: React.MouseEvent) => void;
  };
}

export function MetaSingleCard({ goal, period, onEdit, onToggleVisibility, onDelete, isDragging, dragHandleProps }: SingleCardProps) {
  const target = goal.targets[period];
  const actual = goal.actuals[period];
  const pct = target > 0 ? (actual / target) * 100 : 0;
  const colorInfo = getColor(pct);
  const isAutoSource = goal.source !== 'manual';

  return (
    <div
      className={cn(
        'bg-gradient-to-b border rounded-xl p-4 transition-all relative group select-none',
        colorInfo.bg,
        isDragging && 'opacity-60 ring-2 ring-blue-500/50 scale-[1.02]'
      )}
    >
      {/* Drag handle */}
      <div
        className="absolute top-2 left-2 cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 transition-colors"
        {...dragHandleProps}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Action buttons */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-white" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-white" onClick={onToggleVisibility}>
          {goal.visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </Button>
        {onDelete && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-300" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Title */}
      <div className="text-center mb-1 mt-1">
        <span className="text-sm font-semibold text-white">{goal.icon} {goal.name}</span>
        <div className="text-[10px] text-gray-400 font-medium">{PERIOD_LABELS[period]}</div>
        {isAutoSource && (
          <div className="text-[8px] text-gray-500 mt-0.5">
            {goal.source === 'status_filter' ? `📊 ${(goal.statusFilter || []).join(', ')}` : SOURCE_LABELS[goal.source]}
          </div>
        )}
      </div>

      {/* Gauge */}
      <Gauge percentage={pct} color={colorInfo.arc} />

      {/* Values */}
      <div className="text-center -mt-1">
        <div className="text-sm text-gray-300">
          <span className="font-bold text-white text-base">{actual.toLocaleString('pt-BR')}</span>
          <span className="text-gray-500"> / {target.toLocaleString('pt-BR')}</span>
        </div>
        {pct > 0 && (
          <div className={cn('flex items-center justify-center gap-0.5 text-[10px] mt-1', colorInfo.label)}>
            {pct >= 100 ? <TrendingUp className="h-3 w-3" /> : pct < 50 ? <TrendingDown className="h-3 w-3" /> : null}
            <span>{pct >= 100 ? 'Meta atingida!' : pct >= 80 ? 'Quase lá!' : pct >= 50 ? 'Em progresso' : 'Atenção'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export { PERIOD_LABELS, SOURCE_LABELS };
