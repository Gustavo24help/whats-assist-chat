import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, Check, X, TrendingUp, TrendingDown, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabPeriod = 'diario' | 'semanal' | 'mensal' | 'anual';

export type MetaSource = 'manual' | 'fichas_finalizadas' | 'receita_os' | 'status_filter';

export interface MetaGoal {
  id: string;
  name: string;
  icon: string;
  visible: boolean;
  source: MetaSource;
  statusFilter?: string[]; // for status_filter source
  targets: Record<TabPeriod, number>;
  actuals: Record<TabPeriod, number>;
}

interface Props {
  goal: MetaGoal;
  visiblePeriods: TabPeriod[];
  onUpdate: (goal: MetaGoal) => void;
  onDelete: (id: string) => void;
  isEditing: boolean;
  statusOptions: string[];
}

function getColor(pct: number) {
  if (pct >= 100) return { arc: '#a855f7', label: 'text-purple-400', bg: 'from-purple-500/10 to-purple-500/5 border-purple-500/30' };
  if (pct >= 80) return { arc: '#22c55e', label: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/30' };
  if (pct >= 50) return { arc: '#eab308', label: 'text-amber-400', bg: 'from-amber-500/10 to-amber-500/5 border-amber-500/30' };
  return { arc: '#ef4444', label: 'text-red-400', bg: 'from-red-500/10 to-red-500/5 border-red-500/30' };
}

function MiniGauge({ percentage, color, size = 80 }: { percentage: number; color: string; size?: number }) {
  const clampPct = Math.min(percentage, 120);
  const radius = size * 0.4;
  const strokeWidth = size * 0.08;
  const cx = size / 2;
  const cy = size * 0.46;
  const startAngle = Math.PI;
  const fillAngle = startAngle - (clampPct / 120) * Math.PI;

  const bgPath = describeArc(cx, cy, radius, 0, startAngle);
  const fillPath = describeArc(cx, cy, radius, fillAngle, startAngle);

  return (
    <svg viewBox={`0 0 ${size} ${size * 0.58}`} className="w-full mx-auto" style={{ maxWidth: size }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={1} />
        </linearGradient>
      </defs>
      <path d={bgPath} fill="none" stroke="#374151" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d={fillPath} fill="none" stroke={`url(#grad-${color.replace('#', '')}-${size})`} strokeWidth={strokeWidth} strokeLinecap="round" />
      <text x={cx} y={cy - 2} textAnchor="middle" className="fill-white font-bold" style={{ fontSize: size * 0.18 }}>
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

const PERIOD_LABELS: Record<TabPeriod, string> = { diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal', anual: 'Anual' };

const SOURCE_LABELS: Record<MetaSource, string> = {
  manual: 'Manual',
  fichas_finalizadas: 'Serviços Realizados (BD)',
  receita_os: 'Receita OS (BD)',
  status_filter: 'Filtro por Status (BD)',
};

export function MetaGaugeCard({ goal, visiblePeriods, onUpdate, onDelete, isEditing, statusOptions }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(goal);

  const handleSave = () => {
    onUpdate(form);
    setEditing(false);
  };

  const isAutoSource = goal.source !== 'manual';

  if (editing) {
    return (
      <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-4 space-y-3 col-span-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">Editar Meta</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-emerald-400" onClick={handleSave}><Check className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400" onClick={() => { setForm(goal); setEditing(false); }}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="space-y-2">
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome da meta" className="h-8 text-xs bg-gray-800 border-gray-600 text-white" />
          <div>
            <label className="text-[10px] text-gray-400">Fonte dos dados</label>
            <Select value={form.source} onValueChange={(v: MetaSource) => setForm(f => ({ ...f, source: v }))}>
              <SelectTrigger className="h-8 text-xs bg-gray-800 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.source === 'status_filter' && (
            <div>
              <label className="text-[10px] text-gray-400">Status (selecione)</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {statusOptions.map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      const current = form.statusFilter || [];
                      const next = current.includes(s) ? current.filter(x => x !== s) : [...current, s];
                      setForm(f => ({ ...f, statusFilter: next }));
                    }}
                    className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded border transition-all',
                      (form.statusFilter || []).includes(s)
                        ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                        : 'bg-gray-800 border-gray-600 text-gray-400'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(['diario', 'semanal', 'mensal', 'anual'] as TabPeriod[]).map(p => (
            <div key={p} className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400">{PERIOD_LABELS[p]} - Alvo</label>
                <Input type="number" value={form.targets[p]} onChange={e => setForm(f => ({ ...f, targets: { ...f.targets, [p]: Number(e.target.value) } }))} className="h-7 text-xs bg-gray-800 border-gray-600 text-white" />
              </div>
              {form.source === 'manual' && (
                <div>
                  <label className="text-[10px] text-gray-400">{PERIOD_LABELS[p]} - Atual</label>
                  <Input type="number" value={form.actuals[p]} onChange={e => setForm(f => ({ ...f, actuals: { ...f.actuals, [p]: Number(e.target.value) } }))} className="h-7 text-xs bg-gray-800 border-gray-600 text-white" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Determine best color from first visible period
  const firstPeriod = visiblePeriods[0] || 'diario';
  const firstTarget = goal.targets[firstPeriod];
  const firstActual = goal.actuals[firstPeriod];
  const firstPct = firstTarget > 0 ? (firstActual / firstTarget) * 100 : 0;
  const borderColor = getColor(firstPct);

  return (
    <div className={cn('bg-gradient-to-b border rounded-xl p-3 transition-all relative group', borderColor.bg)}>
      {/* Edit/Delete/Visibility buttons */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-white" onClick={() => { setForm(goal); setEditing(true); }}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-white" onClick={() => onUpdate({ ...goal, visible: !goal.visible })}>
          {goal.visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
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
        {isAutoSource && (
          <div className="text-[8px] text-gray-500 mt-0.5">
            {goal.source === 'status_filter' ? `📊 ${(goal.statusFilter || []).join(', ')}` : SOURCE_LABELS[goal.source]}
          </div>
        )}
      </div>

      {/* Multi-period display */}
      <div className={cn('grid gap-2', visiblePeriods.length === 1 ? 'grid-cols-1' : visiblePeriods.length === 2 ? 'grid-cols-2' : visiblePeriods.length === 3 ? 'grid-cols-3' : 'grid-cols-4')}>
        {visiblePeriods.map(period => {
          const target = goal.targets[period];
          const actual = goal.actuals[period];
          const pct = target > 0 ? (actual / target) * 100 : 0;
          const colorInfo = getColor(pct);

          return (
            <div key={period} className="text-center">
              <div className="text-[9px] text-gray-400 font-medium mb-0.5">{PERIOD_LABELS[period]}</div>
              <MiniGauge percentage={pct} color={colorInfo.arc} size={visiblePeriods.length > 2 ? 70 : 90} />
              <div className="text-[10px] text-gray-300 -mt-0.5">
                <span className="font-bold text-white">{actual.toLocaleString('pt-BR')}</span>
                <span className="text-gray-500"> / {target.toLocaleString('pt-BR')}</span>
              </div>
              {pct > 0 && (
                <div className={cn('flex items-center justify-center gap-0.5 text-[8px] mt-0.5', colorInfo.label)}>
                  {pct >= 100 ? <TrendingUp className="h-2.5 w-2.5" /> : pct < 50 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                  <span>{pct >= 100 ? 'Meta!' : pct >= 80 ? 'Quase!' : pct >= 50 ? 'Progresso' : 'Atenção'}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
