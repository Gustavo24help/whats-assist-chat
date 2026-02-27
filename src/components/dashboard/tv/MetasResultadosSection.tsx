import React, { useState, useEffect, useCallback } from 'react';
import { MetaGaugeCard, MetaGoal, TabPeriod, MetaSource } from './MetaGaugeCard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'tv-metas-goals-v2';
const PERIODS_KEY = 'tv-metas-visible-periods-v1';

const ALL_STATUS_OPTIONS = [
  'Ficha Criada', 'Contato Inicial', 'Dúvida Prestador', 'Orçamento Enviado',
  'Negociação', 'Visita Técnica', 'Orçamento Aprovado / Agendamento',
  'Orçamento Não Aprovado', 'Agendado', 'Em andamento', 'Finalizado',
  'Garantia', 'Perdido', 'Não foi adiante', 'pendente',
];

const DEFAULT_GOALS: MetaGoal[] = [
  {
    id: 'receita',
    name: 'Receita',
    icon: '💰',
    visible: true,
    source: 'receita_os',
    targets: { diario: 5000, semanal: 25000, mensal: 100000, anual: 1200000 },
    actuals: { diario: 0, semanal: 0, mensal: 0, anual: 0 },
  },
  {
    id: 'servicos-realizados',
    name: 'Serviços Realizados',
    icon: '📋',
    visible: true,
    source: 'fichas_finalizadas',
    targets: { diario: 10, semanal: 50, mensal: 200, anual: 2400 },
    actuals: { diario: 0, semanal: 0, mensal: 0, anual: 0 },
  },
  {
    id: 'novos-clientes',
    name: 'Novos Clientes',
    icon: '🤝',
    visible: true,
    source: 'manual',
    targets: { diario: 5, semanal: 25, mensal: 100, anual: 1200 },
    actuals: { diario: 0, semanal: 0, mensal: 0, anual: 0 },
  },
  {
    id: 'avaliacao-media',
    name: 'Avaliação Média',
    icon: '⭐',
    visible: true,
    source: 'manual',
    targets: { diario: 4.8, semanal: 4.8, mensal: 4.8, anual: 4.8 },
    actuals: { diario: 0, semanal: 0, mensal: 0, anual: 0 },
  },
];

function getPeriodRange(period: TabPeriod): { from: Date; to: Date } {
  const now = new Date();
  switch (period) {
    case 'diario':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'semanal':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'mensal':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'anual':
      return { from: startOfYear(now), to: endOfYear(now) };
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
        const parsed = JSON.parse(saved) as MetaGoal[];
        // Migrate: ensure new fields exist
        return parsed.map(g => ({
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem(PERIODS_KEY, JSON.stringify(visiblePeriods));
  }, [visiblePeriods]);

  // Fetch real data from DB for auto-source goals
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
            const { count } = await supabase
              .from('fichas_de_servico')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'Finalizado')
              .gte('created_at', fromStr)
              .lte('created_at', toStr);
            results[goal.id][period] = count || 0;
          } else if (goal.source === 'receita_os') {
            const { data } = await supabase
              .from('fichas_de_servico')
              .select('valor_total')
              .eq('status', 'Finalizado')
              .eq('pagamento_realizado', true)
              .gte('created_at', fromStr)
              .lte('created_at', toStr);
            results[goal.id][period] = (data || []).reduce((s, f) => s + (f.valor_total || 0), 0);
          } else if (goal.source === 'status_filter' && goal.statusFilter?.length) {
            const { count } = await supabase
              .from('fichas_de_servico')
              .select('*', { count: 'exact', head: true })
              .in('status', goal.statusFilter as any)
              .gte('created_at', fromStr)
              .lte('created_at', toStr);
            results[goal.id][period] = count || 0;
          }
        }
      }
      return results;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  // Merge DB actuals into goals for display
  const goalsWithActuals = goals.map(g => {
    if (g.source !== 'manual' && dbActuals?.[g.id]) {
      return { ...g, actuals: { ...g.actuals, ...dbActuals[g.id] } };
    }
    return g;
  });

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
  };

  const togglePeriod = (p: TabPeriod) => {
    setVisiblePeriods(prev => {
      if (prev.includes(p)) {
        if (prev.length <= 1) return prev; // keep at least one
        return prev.filter(x => x !== p);
      }
      return [...prev, p].sort((a, b) => {
        const order: TabPeriod[] = ['diario', 'semanal', 'mensal', 'anual'];
        return order.indexOf(a) - order.indexOf(b);
      });
    });
  };

  const PERIOD_OPTIONS: { key: TabPeriod; label: string }[] = [
    { key: 'diario', label: 'Diário' },
    { key: 'semanal', label: 'Semanal' },
    { key: 'mensal', label: 'Mensal' },
    { key: 'anual', label: 'Anual' },
  ];

  const visibleGoals = goalsWithActuals.filter(g => g.visible);

  return (
    <section className="px-4 pb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider">
            🏆 Metas & Resultados
          </div>
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="h-6 text-[10px] bg-gray-800 border-gray-700 gap-1 hover:bg-gray-700"
        >
          <Plus className="h-3 w-3" />
          Adicionar Meta
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {visibleGoals.map(goal => (
          <MetaGaugeCard
            key={goal.id}
            goal={goal}
            visiblePeriods={visiblePeriods}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            isEditing={isLayoutEditing}
            statusOptions={ALL_STATUS_OPTIONS}
          />
        ))}
      </div>
      {goalsWithActuals.some(g => !g.visible) && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-gray-500">Ocultos:</span>
          {goalsWithActuals.filter(g => !g.visible).map(g => (
            <button
              key={g.id}
              onClick={() => handleUpdate({ ...g, visible: true })}
              className="text-[10px] px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-all"
            >
              {g.icon} {g.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
