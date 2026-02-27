import React, { useState, useEffect } from 'react';
import { MetaGaugeCard, MetaGoal } from './MetaGaugeCard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const STORAGE_KEY = 'tv-metas-goals-v1';

const DEFAULT_GOALS: MetaGoal[] = [
  {
    id: 'receita',
    name: 'Receita',
    icon: '💰',
    targets: { diario: 5000, semanal: 25000, mensal: 100000 },
    actuals: { diario: 0, semanal: 0, mensal: 0 },
  },
  {
    id: 'ordens-servico',
    name: 'Ordens de Serviço',
    icon: '📋',
    targets: { diario: 10, semanal: 50, mensal: 200 },
    actuals: { diario: 0, semanal: 0, mensal: 0 },
  },
  {
    id: 'novos-clientes',
    name: 'Novos Clientes',
    icon: '🤝',
    targets: { diario: 5, semanal: 25, mensal: 100 },
    actuals: { diario: 0, semanal: 0, mensal: 0 },
  },
  {
    id: 'avaliacao-media',
    name: 'Avaliação Média',
    icon: '⭐',
    targets: { diario: 4.8, semanal: 4.8, mensal: 4.8 },
    actuals: { diario: 0, semanal: 0, mensal: 0 },
  },
];

interface Props {
  isLayoutEditing: boolean;
}

export function MetasResultadosSection({ isLayoutEditing }: Props) {
  const [goals, setGoals] = useState<MetaGoal[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_GOALS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  }, [goals]);

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
      targets: { diario: 0, semanal: 0, mensal: 0 },
      actuals: { diario: 0, semanal: 0, mensal: 0 },
    };
    setGoals(prev => [...prev, newGoal]);
  };

  return (
    <section className="px-4 pb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-400 uppercase tracking-wider">
          🏆 Metas & Resultados
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
        {goals.map(goal => (
          <MetaGaugeCard
            key={goal.id}
            goal={goal}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            isEditing={isLayoutEditing}
          />
        ))}
      </div>
    </section>
  );
}
