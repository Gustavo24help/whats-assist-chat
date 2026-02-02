import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type BlockType = 
  | 'operational-kpis'
  | 'conversion-funnel'
  | 'google-ads'
  | 'whatsapp-metrics'
  | 'sales-metrics'
  | 'charts'
  | 'export';

export interface DashboardBlock {
  id: BlockType;
  label: string;
  enabled: boolean;
  order: number;
  size: 'full' | 'half' | 'third';
}

const DEFAULT_BLOCKS: DashboardBlock[] = [
  { id: 'operational-kpis', label: 'Métricas Operacionais', enabled: true, order: 0, size: 'full' },
  { id: 'conversion-funnel', label: 'Funil de Conversão', enabled: true, order: 1, size: 'full' },
  { id: 'google-ads', label: 'Google Ads', enabled: true, order: 2, size: 'full' },
  { id: 'whatsapp-metrics', label: 'WhatsApp', enabled: false, order: 3, size: 'full' },
  { id: 'sales-metrics', label: 'Vendas', enabled: false, order: 4, size: 'full' },
  { id: 'charts', label: 'Gráficos de Evolução', enabled: true, order: 5, size: 'full' },
  { id: 'export', label: 'Exportar Relatórios', enabled: false, order: 6, size: 'full' },
];

interface DashboardLayoutContextType {
  blocks: DashboardBlock[];
  toggleBlock: (id: BlockType) => void;
  reorderBlocks: (fromIndex: number, toIndex: number) => void;
  resetLayout: () => void;
  isCustomizing: boolean;
  setIsCustomizing: (value: boolean) => void;
}

const DashboardLayoutContext = createContext<DashboardLayoutContextType | undefined>(undefined);

const STORAGE_KEY = 'dashboard-layout-v1';

export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const [blocks, setBlocks] = useState<DashboardBlock[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle new blocks
        return DEFAULT_BLOCKS.map(defaultBlock => {
          const savedBlock = parsed.find((b: DashboardBlock) => b.id === defaultBlock.id);
          return savedBlock ? { ...defaultBlock, ...savedBlock } : defaultBlock;
        });
      }
    } catch (e) {
      console.error('Error loading dashboard layout:', e);
    }
    return DEFAULT_BLOCKS;
  });

  const [isCustomizing, setIsCustomizing] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
  }, [blocks]);

  const toggleBlock = (id: BlockType) => {
    setBlocks(prev => 
      prev.map(block => 
        block.id === id ? { ...block, enabled: !block.enabled } : block
      )
    );
  };

  const reorderBlocks = (fromIndex: number, toIndex: number) => {
    setBlocks(prev => {
      const newBlocks = [...prev];
      const [removed] = newBlocks.splice(fromIndex, 1);
      newBlocks.splice(toIndex, 0, removed);
      return newBlocks.map((block, index) => ({ ...block, order: index }));
    });
  };

  const resetLayout = () => {
    setBlocks(DEFAULT_BLOCKS);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <DashboardLayoutContext.Provider value={{
      blocks,
      toggleBlock,
      reorderBlocks,
      resetLayout,
      isCustomizing,
      setIsCustomizing,
    }}>
      {children}
    </DashboardLayoutContext.Provider>
  );
}

export function useDashboardLayout() {
  const context = useContext(DashboardLayoutContext);
  if (!context) {
    throw new Error('useDashboardLayout must be used within DashboardLayoutProvider');
  }
  return context;
}
