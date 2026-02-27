import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MetaSingleCard, MetaGoal, TabPeriod, MetaSource, PERIOD_LABELS, SOURCE_LABELS } from './MetaGaugeCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'tv-metas-goals-v2';
const PERIODS_KEY = 'tv-metas-visible-periods-v1';
const ORDER_KEY = 'tv-metas-card-order-v1';

const ALL_STATUS_OPTIONS = [
  'Ficha Criada', 'Contato Inicial', 'Dúvida Prestador', 'Orçamento Enviado',
  'Negociação', 'Visita Técnica', 'Orçamento Aprovado / Agendamento',
  'Orçamento Não Aprovado', 'Agendado', 'Em andamento', 'Finalizado',
  'Garantia', 'Perdido', 'Não foi adiante', 'pendente',
];

const DEFAULT_GOALS: MetaGoal[] = [
  { id: 'receita', name: 'Receita', icon: '💰', visible: true, source: 'receita_os', targets: { diario: 5000, semanal: 25000, mensal: 100000, anual: 1200000 }, actuals: { diario: 0, semanal: 0, mensal: 0, anual: 0 } },
  { id: 'servicos-realizados', name: 'Serviços Realizados', icon: '📋', visible: true, source: 'fichas_finalizadas', targets: { diario: 10, semanal: 50, mensal: 200, anual: 2400 }, actuals: { diario: 0, semanal: 0, mensal: 0, anual: 0 } },
  { id: 'novos-clientes', name: 'Novos Clientes', icon: '🤝', visible: true, source: 'manual', targets: { diario: 5, semanal: 25, mensal: 100, anual: 1200 }, actuals: { diario: 0, semanal: 0, mensal: 0, anual: 0 } },
  { id: 'avaliacao-media', name: 'Avaliação Média', icon: '⭐', visible: true, source: 'manual', targets: { diario: 4.8, semanal: 4.8, mensal: 4.8, anual: 4.8 }, actuals: { diario: 0, semanal: 0, mensal: 0, anual: 0 } },
];

function getPeriodRange(period: TabPeriod): { from: Date; to: Date } {
  const now = new Date();
  switch (period) {
    case 'diario': return { from: startOfDay(now), to: endOfDay(now) };
    case 'semanal': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'mensal': return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'anual': return { from: startOfYear(now), to: endOfYear(now) };
  }
}

interface Props {
  isLayoutEditing: boolean;
}

export function MetasResultadosSection({ isLayoutEditing }: Props) {
  const [goals, setGoals] = useState<MetaGoal[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return (JSON.parse(saved) as MetaGoal[]).map(g => ({
          ...g,
          visible: g.visible ?? true,
          source: g.source ?? 'manual',
          targets: { diario: 0, semanal: 0, mensal: 0, anual: 0, ...g.targets },
          actuals: { diario: 0, semanal: 0, mensal: 0, anual: 0, ...g.actuals },
        }));
      }
    } catch {}
    return DEFAULT_GOALS;
  });

  const [visiblePeriods, setVisiblePeriods] = useState<TabPeriod[]>(() => {
    try {
      const saved = localStorage.getItem(PERIODS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return ['diario', 'mensal'];
  });

  // Card order: array of "goalId-period" keys
  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(ORDER_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MetaGoal | null>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(goals)); }, [goals]);
  useEffect(() => { localStorage.setItem(PERIODS_KEY, JSON.stringify(visiblePeriods)); }, [visiblePeriods]);
  useEffect(() => { localStorage.setItem(ORDER_KEY, JSON.stringify(cardOrder)); }, [cardOrder]);

  // Fetch DB actuals
  const autoGoals = goals.filter(g => g.source !== 'manual');
  const { data: dbActuals } = useQuery({
    queryKey: ['metas-db-actuals', visiblePeriods, autoGoals.map(g => `${g.id}-${g.source}-${(g.statusFilter || []).join(',')}`).join('|')],
    queryFn: async () => {
      const results: Record<string, Record<TabPeriod, number>> = {};
      for (const goal of autoGoals) {
        results[goal.id] = { diario: 0, semanal: 0, mensal: 0, anual: 0 };
        for (const period of visiblePeriods) {
          const { from, to } = getPeriodRange(period);
          const fromStr = from.toISOString();
          const toStr = to.toISOString();
          if (goal.source === 'fichas_finalizadas') {
            const { count } = await supabase.from('fichas_de_servico').select('*', { count: 'exact', head: true }).eq('status', 'Finalizado').gte('created_at', fromStr).lte('created_at', toStr);
            results[goal.id][period] = count || 0;
          } else if (goal.source === 'receita_os') {
            const { data } = await supabase.from('fichas_de_servico').select('valor_total').eq('status', 'Finalizado').eq('pagamento_realizado', true).gte('created_at', fromStr).lte('created_at', toStr);
            results[goal.id][period] = (data || []).reduce((s, f) => s + (f.valor_total || 0), 0);
          } else if (goal.source === 'status_filter' && goal.statusFilter?.length) {
            const { count } = await supabase.from('fichas_de_servico').select('*', { count: 'exact', head: true }).in('status', goal.statusFilter as any).gte('created_at', fromStr).lte('created_at', toStr);
            results[goal.id][period] = count || 0;
          }
        }
      }
      return results;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const goalsWithActuals = goals.map(g => {
    if (g.source !== 'manual' && dbActuals?.[g.id]) {
      return { ...g, actuals: { ...g.actuals, ...dbActuals[g.id] } };
    }
    return g;
  });

  // Build card list: each visible goal × each visible period
  const visibleGoals = goalsWithActuals.filter(g => g.visible);
  const allCardKeys = visibleGoals.flatMap(g => visiblePeriods.map(p => `${g.id}-${p}`));

  // Merge saved order with current cards
  const orderedKeys = (() => {
    const existing = cardOrder.filter(k => allCardKeys.includes(k));
    const newKeys = allCardKeys.filter(k => !existing.includes(k));
    return [...existing, ...newKeys];
  })();

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const handleDragStart = (idx: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = idx;
    setDragIdx(idx);

    const onMove = (ev: MouseEvent) => {
      const els = document.querySelectorAll('[data-meta-card]');
      let closest = idx;
      let closestDist = Infinity;
      els.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.sqrt((ev.clientX - cx) ** 2 + (ev.clientY - cy) ** 2);
        if (dist < closestDist) { closestDist = dist; closest = i; }
      });
      setDragOverIdx(closest);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const from = dragRef.current;
      setDragIdx(null);
      setDragOverIdx(null);
      if (from !== null && dragOverIdx !== null && from !== dragOverIdx) {
        // We use the latest dragOverIdx from the ref trick
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Use a more reliable drag approach with HTML5 drag
  const handleDragStartHTML = (idx: number) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', String(idx));
    setDragIdx(idx);
  };

  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (toIdx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
    setDragIdx(null);
    setDragOverIdx(null);
    if (fromIdx !== toIdx) {
      const newOrder = [...orderedKeys];
      const [moved] = newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, moved);
      setCardOrder(newOrder);
    }
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const togglePeriod = (p: TabPeriod) => {
    setVisiblePeriods(prev => {
      if (prev.includes(p)) {
        if (prev.length <= 1) return prev;
        return prev.filter(x => x !== p);
      }
      return [...prev, p].sort((a, b) => {
        const order: TabPeriod[] = ['diario', 'semanal', 'mensal', 'anual'];
        return order.indexOf(a) - order.indexOf(b);
      });
    });
  };

  const handleUpdate = (updated: MetaGoal) => {
    setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
  };

  const handleDelete = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const handleAdd = () => {
    const newGoal: MetaGoal = {
      id: `meta-${Date.now()}`,
      name: 'Nova Meta',
      icon: '🎯',
      visible: true,
      source: 'manual',
      targets: { diario: 0, semanal: 0, mensal: 0, anual: 0 },
      actuals: { diario: 0, semanal: 0, mensal: 0, anual: 0 },
    };
    setGoals(prev => [...prev, newGoal]);
    setEditingGoalId(newGoal.id);
    setEditForm(newGoal);
  };

  const handleEditSave = () => {
    if (editForm) {
      handleUpdate(editForm);
      setEditingGoalId(null);
      setEditForm(null);
    }
  };

  const PERIOD_OPTIONS: { key: TabPeriod; label: string }[] = [
    { key: 'diario', label: 'Diário' },
    { key: 'semanal', label: 'Semanal' },
    { key: 'mensal', label: 'Mensal' },
    { key: 'anual', label: 'Anual' },
  ];

  return (
    <section className="px-4 pb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider">🏆 Metas & Resultados</div>
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p.key}
                onClick={() => togglePeriod(p.key)}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border transition-all',
                  visiblePeriods.includes(p.key)
                    ? 'bg-white/10 border-white/20 text-white font-medium'
                    : 'bg-transparent border-gray-700 text-gray-500 hover:text-gray-300'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleAdd} className="h-6 text-[10px] bg-gray-800 border-gray-700 gap-1 hover:bg-gray-700">
          <Plus className="h-3 w-3" /> Adicionar Meta
        </Button>
      </div>

      {/* Edit form overlay */}
      {editingGoalId && editForm && (
        <div className="mb-4 bg-gray-900/90 border border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">Editar Meta</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-emerald-400" onClick={handleEditSave}><Check className="h-3.5 w-3.5 mr-1" />Salvar</Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-gray-400" onClick={() => { setEditingGoalId(null); setEditForm(null); }}><X className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-gray-400">Nome</label>
              <Input value={editForm.name} onChange={e => setEditForm(f => f ? { ...f, name: e.target.value } : f)} className="h-8 text-xs bg-gray-800 border-gray-600 text-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400">Emoji</label>
              <Input value={editForm.icon} onChange={e => setEditForm(f => f ? { ...f, icon: e.target.value } : f)} className="h-8 text-xs bg-gray-800 border-gray-600 text-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400">Fonte dos dados</label>
              <Select value={editForm.source} onValueChange={(v: MetaSource) => setEditForm(f => f ? { ...f, source: v } : f)}>
                <SelectTrigger className="h-8 text-xs bg-gray-800 border-gray-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {editForm.source === 'status_filter' && (
            <div>
              <label className="text-[10px] text-gray-400">Status (selecione)</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {ALL_STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      const current = editForm.statusFilter || [];
                      const next = current.includes(s) ? current.filter(x => x !== s) : [...current, s];
                      setEditForm(f => f ? { ...f, statusFilter: next } : f);
                    }}
                    className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded border transition-all',
                      (editForm.statusFilter || []).includes(s) ? 'bg-blue-600/30 border-blue-500/50 text-blue-300' : 'bg-gray-800 border-gray-600 text-gray-400'
                    )}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(['diario', 'semanal', 'mensal', 'anual'] as TabPeriod[]).map(p => (
              <div key={p} className="space-y-1">
                <label className="text-[10px] text-gray-400 font-medium">{PERIOD_LABELS[p]} - Alvo</label>
                <Input type="number" value={editForm.targets[p]} onChange={e => setEditForm(f => f ? { ...f, targets: { ...f.targets, [p]: Number(e.target.value) } } : f)} className="h-7 text-xs bg-gray-800 border-gray-600 text-white" />
                {editForm.source === 'manual' && (
                  <>
                    <label className="text-[10px] text-gray-400">{PERIOD_LABELS[p]} - Atual</label>
                    <Input type="number" value={editForm.actuals[p]} onChange={e => setEditForm(f => f ? { ...f, actuals: { ...f.actuals, [p]: Number(e.target.value) } } : f)} className="h-7 text-xs bg-gray-800 border-gray-600 text-white" />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cards grid - draggable */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {orderedKeys.map((key, idx) => {
          const [goalId, period] = [key.substring(0, key.lastIndexOf('-')), key.substring(key.lastIndexOf('-') + 1) as TabPeriod];
          const goal = goalsWithActuals.find(g => g.id === goalId);
          if (!goal) return null;

          return (
            <div
              key={key}
              data-meta-card
              draggable
              onDragStart={handleDragStartHTML(idx)}
              onDragOver={handleDragOver(idx)}
              onDrop={handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className={cn(
                'transition-all',
                dragOverIdx === idx && dragIdx !== idx && 'ring-2 ring-blue-500/50 rounded-xl'
              )}
            >
              <MetaSingleCard
                goal={goal}
                period={period}
                onEdit={() => { setEditingGoalId(goal.id); setEditForm(goals.find(g => g.id === goal.id) || goal); }}
                onToggleVisibility={() => handleUpdate({ ...goal, visible: !goal.visible })}
                onDelete={isLayoutEditing ? () => handleDelete(goal.id) : undefined}
                isDragging={dragIdx === idx}
              />
            </div>
          );
        })}
      </div>

      {/* Hidden goals */}
      {goalsWithActuals.some(g => !g.visible) && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-gray-500">Ocultos:</span>
          {goalsWithActuals.filter(g => !g.visible).map(g => (
            <button key={g.id} onClick={() => handleUpdate({ ...g, visible: true })} className="text-[10px] px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-all">
              {g.icon} {g.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
