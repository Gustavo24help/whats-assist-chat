import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type TVBlockId = 
  | 'kpis-principais'
  | 'funil-vendas'
  | 'taxas-conversao'
  | 'metricas-tempo'
  | 'conversas-abertas'
  | 'metas-resultados';

export interface TVBlock {
  id: TVBlockId;
  label: string;
  icon: string;
  enabled: boolean;
  order: number;
  scale: number; // free-form scale factor, default 1
}

const DEFAULT_TV_BLOCKS: TVBlock[] = [
  { id: 'kpis-principais', label: 'KPIs Principais', icon: '📊', enabled: true, order: 0, scale: 1 },
  { id: 'funil-vendas', label: 'Funil de Vendas', icon: '🔄', enabled: true, order: 1, scale: 1 },
  { id: 'taxas-conversao', label: 'Taxas de Conversão', icon: '📈', enabled: true, order: 2, scale: 1 },
  { id: 'metricas-tempo', label: 'Métricas de Tempo', icon: '⏱️', enabled: true, order: 3, scale: 1 },
  { id: 'conversas-abertas', label: 'Conversas em Aberto', icon: '📞', enabled: true, order: 4, scale: 1 },
  { id: 'metas-resultados', label: 'Metas & Resultados', icon: '🏆', enabled: true, order: 5, scale: 1 },
];

interface TVLayoutContextType {
  blocks: TVBlock[];
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  toggleBlock: (id: TVBlockId) => void;
  reorderBlocks: (fromIndex: number, toIndex: number) => void;
  setBlockScale: (id: TVBlockId, scale: number) => void;
  resetLayout: () => void;
}

const TVLayoutContext = createContext<TVLayoutContextType | undefined>(undefined);
const STORAGE_KEY = 'tv-dashboard-layout-v1';

export function TVLayoutProvider({ children }: { children: ReactNode }) {
  const [blocks, setBlocks] = useState<TVBlock[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return DEFAULT_TV_BLOCKS.map(def => {
          const s = parsed.find((b: TVBlock) => b.id === def.id);
          return s ? { ...def, enabled: s.enabled, order: s.order } : def;
        }).sort((a, b) => a.order - b.order);
      }
    } catch {}
    return DEFAULT_TV_BLOCKS;
  });

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
  }, [blocks]);

  const toggleBlock = (id: TVBlockId) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b));
  };

  const reorderBlocks = (fromIndex: number, toIndex: number) => {
    setBlocks(prev => {
      const arr = [...prev];
      const [removed] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, removed);
      return arr.map((b, i) => ({ ...b, order: i }));
    });
  };

  const setBlockScale = (id: TVBlockId, scale: number) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, scale: Math.max(0.5, Math.min(2.5, scale)) } : b));
  };

  const resetLayout = () => {
    setBlocks(DEFAULT_TV_BLOCKS);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <TVLayoutContext.Provider value={{ blocks, isEditing, setIsEditing, toggleBlock, reorderBlocks, setBlockScale, resetLayout }}>
      {children}
    </TVLayoutContext.Provider>
  );
}

export function useTVLayout() {
  const ctx = useContext(TVLayoutContext);
  if (!ctx) throw new Error('useTVLayout must be used within TVLayoutProvider');
  return ctx;
}
