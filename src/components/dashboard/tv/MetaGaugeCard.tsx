import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Check, X, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MetaGoal {
  id: string;
  name: string;
  icon: string;
  targets: { diario: number; semanal: number; mensal: number };
  actuals: { diario: number; semanal: number; mensal: number };
}

type TabPeriod = 'diario' | 'semanal' | 'mensal';

interface Props {
  goal: MetaGoal;
  onUpdate: (goal: MetaGoal) => void;
  onDelete: (id: string) => void;
  isEditing: boolean;
}

function getColor(pct: number) {
  if (pct >= 100) return { arc: '#a855f7', label: 'text-purple-400', bg: 'from-purple-500/10 to-purple-500/5 border-purple-500/30' };
  if (pct >= 80) return { arc: '#22c55e', label: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/30' };
  if (pct >= 50) return { arc: '#eab308', label: 'text-amber-400', bg: 'from-amber-500/10 to-amber-500/5 border-amber-500/30' };
  return { arc: '#ef4444', label: 'text-red-400', bg: 'from-red-500/10 to-red-500/5 border-red-500/30' };
}

function SemiCircularGauge({ percentage, color }: { percentage: number; color: string }) {
  const clampPct = Math.min(percentage, 120);
  const radius = 52;
  const strokeWidth = 10;
  const cx = 65;
  const cy = 60;
  const startAngle = Math.PI;
  const endAngle = 0;
  const totalAngle = Math.PI;
  const fillAngle = startAngle - (clampPct / 120) * totalAngle;

  const bgPath = describeArc(cx, cy, radius, endAngle, startAngle);
  const fillPath = describeArc(cx, cy, radius, fillAngle, startAngle);

  return (
    <svg viewBox="0 0 130 75" className="w-full max-w-[160px] mx-auto">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={1} />
        </linearGradient>
      </defs>
      <path d={bgPath} fill="none" stroke="#374151" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d={fillPath} fill="none" stroke={`url(#grad-${color.replace('#', '')})`} strokeWidth={strokeWidth} strokeLinecap="round" />
      <text x={cx} y={cy - 5} textAnchor="middle" className="fill-white text-lg font-bold" style={{ fontSize: '18px' }}>
        {percentage.toFixed(0)}%
      </text>
    </svg>
  );
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy - r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy - r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`;
}

const TAB_LABELS: Record<TabPeriod, string> = { diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal' };

export function MetaGaugeCard({ goal, onUpdate, onDelete, isEditing }: Props) {
  const [tab, setTab] = useState<TabPeriod>('diario');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(goal);

  const target = goal.targets[tab];
  const actual = goal.actuals[tab];
  const pct = target > 0 ? (actual / target) * 100 : 0;
  const colorInfo = getColor(pct);

  const handleSave = () => {
    onUpdate(form);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">Editar Meta</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-emerald-400" onClick={handleSave}><Check className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400" onClick={() => { setForm(goal); setEditing(false); }}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="space-y-2">
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome da meta" className="h-8 text-xs bg-gray-800 border-gray-600 text-white" />
          {(['diario', 'semanal', 'mensal'] as TabPeriod[]).map(p => (
            <div key={p} className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400">{TAB_LABELS[p]} - Alvo</label>
                <Input type="number" value={form.targets[p]} onChange={e => setForm(f => ({ ...f, targets: { ...f.targets, [p]: Number(e.target.value) } }))} className="h-7 text-xs bg-gray-800 border-gray-600 text-white" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400">{TAB_LABELS[p]} - Atual</label>
                <Input type="number" value={form.actuals[p]} onChange={e => setForm(f => ({ ...f, actuals: { ...f.actuals, [p]: Number(e.target.value) } }))} className="h-7 text-xs bg-gray-800 border-gray-600 text-white" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-gradient-to-b border rounded-xl p-4 transition-all relative group', colorInfo.bg)}>
      {/* Edit/Delete buttons */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-white" onClick={() => { setForm(goal); setEditing(true); }}>
          <Pencil className="h-3 w-3" />
        </Button>
        {isEditing && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-300" onClick={() => onDelete(goal.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Title */}
      <div className="text-center mb-1">
        <span className="text-sm font-semibold text-white">{goal.icon} {goal.name}</span>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-1 mb-2">
        {(['diario', 'semanal', 'mensal'] as TabPeriod[]).map(p => (
          <button
            key={p}
            onClick={() => setTab(p)}
            className={cn(
              'text-[10px] px-2 py-0.5 rounded-full transition-all',
              tab === p ? 'bg-white/15 text-white font-medium' : 'text-gray-500 hover:text-gray-300'
            )}
          >
            {TAB_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Gauge */}
      <SemiCircularGauge percentage={pct} color={colorInfo.arc} />

      {/* Values */}
      <div className="text-center -mt-1">
        <div className="text-xs text-gray-300">
          <span className="font-bold text-white">{actual.toLocaleString('pt-BR')}</span>
          <span className="text-gray-500"> / {target.toLocaleString('pt-BR')}</span>
        </div>
        {pct > 0 && (
          <div className={cn('flex items-center justify-center gap-0.5 text-[10px] mt-0.5', colorInfo.label)}>
            {pct >= 100 ? <TrendingUp className="h-3 w-3" /> : pct < 50 ? <TrendingDown className="h-3 w-3" /> : null}
            <span>{pct >= 100 ? 'Acima da meta!' : pct >= 80 ? 'Quase lá!' : pct >= 50 ? 'Em progresso' : 'Atenção'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
