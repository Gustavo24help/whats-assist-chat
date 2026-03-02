import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface TVWidgetLayout {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  locked: boolean;
  autoHeight: boolean;
  scaleMode: 'fixed' | 'fluid';
}

export interface TVSavedLayout {
  name: string;
  widgets: TVWidgetLayout[];
  createdAt: string;
}

const CANVAS_W = 1920;
const CANVAS_H = 1080;

const DEFAULT_WIDGETS: TVWidgetLayout[] = [
  // Row 1 — KPIs principais (cada um independente)
  { id: 'receita-total',       label: 'Receita Total',         icon: '💰', enabled: true,  x: 0,    y: 0,   width: 320, height: 180, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'lucro-bruto',         label: 'Lucro Bruto',           icon: '📈', enabled: true,  x: 330,  y: 0,   width: 320, height: 180, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'servicos-fechados',   label: 'Serviços Fechados',     icon: '✅', enabled: true,  x: 660,  y: 0,   width: 320, height: 180, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'ticket-medio',        label: 'Ticket Médio',          icon: '🎫', enabled: true,  x: 990,  y: 0,   width: 310, height: 180, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'margem-media',        label: 'Margem Média',          icon: '📊', enabled: true,  x: 1310, y: 0,   width: 300, height: 180, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'conversao-total',     label: 'Conversão Total',       icon: '🔄', enabled: true,  x: 1620, y: 0,   width: 300, height: 180, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },

  // Row 2 — Metas
  { id: 'meta-diaria',         label: 'Meta Diária',           icon: '🎯', enabled: true,  x: 0,    y: 190, width: 960, height: 100, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'meta-mensal',         label: 'Meta Mensal',           icon: '📅', enabled: true,  x: 970,  y: 190, width: 950, height: 100, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },

  // Row 3 — Funil de vendas (cada etapa é um widget)
  { id: 'funil-cliques',       label: 'Cliques',               icon: '🎯', enabled: true,  x: 0,    y: 300, width: 310, height: 160, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'funil-conversas',     label: 'Conversas',             icon: '💬', enabled: true,  x: 320,  y: 300, width: 310, height: 160, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'funil-fs',            label: 'FS Criadas',            icon: '📋', enabled: true,  x: 640,  y: 300, width: 310, height: 160, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'funil-agendados',     label: 'Agendados',             icon: '📅', enabled: true,  x: 960,  y: 300, width: 310, height: 160, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'funil-executados',    label: 'Executados',            icon: '✅', enabled: true,  x: 1280, y: 300, width: 310, height: 160, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'funil-pagos',         label: 'Pagos',                 icon: '💰', enabled: true,  x: 1600, y: 300, width: 320, height: 160, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },

  // Row 4 — Taxas de conversão
  { id: 'taxa-agend-fs',       label: 'Agendados / FS',        icon: '📊', enabled: true,  x: 0,    y: 470, width: 310, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'taxa-pagos-fs',       label: 'Pagos / FS',            icon: '📊', enabled: true,  x: 320,  y: 470, width: 310, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'taxa-pagos-agend',    label: 'Pagos / Agendados',     icon: '📊', enabled: true,  x: 640,  y: 470, width: 310, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'taxa-pagos-cliques',  label: 'Pagos / Cliques',       icon: '📊', enabled: true,  x: 960,  y: 470, width: 310, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'taxa-conv-cliques',   label: 'Conversas / Cliques',   icon: '📊', enabled: true,  x: 1280, y: 470, width: 310, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'taxa-exec-agend',     label: 'Executados / Agendados',icon: '📊', enabled: true,  x: 1600, y: 470, width: 320, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },

  // Row 5 — Métricas de tempo
  { id: 'tempo-resposta',      label: 'Tempo Resposta',        icon: '⚡', enabled: true,  x: 0,    y: 630, width: 380, height: 140, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'tempo-orcamento',     label: 'Receb. Orçamento',      icon: '🎯', enabled: true,  x: 390,  y: 630, width: 380, height: 140, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'tempo-fs-agendado',   label: 'FS → Agendado',         icon: '📅', enabled: true,  x: 780,  y: 630, width: 380, height: 140, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'tempo-agendado-exec', label: 'Agendado → Executado',  icon: '🔄', enabled: true,  x: 1170, y: 630, width: 370, height: 140, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'tempo-ciclo',         label: 'Ciclo Completo',        icon: '🎪', enabled: true,  x: 1550, y: 630, width: 370, height: 140, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },

  // Row 6 — Blocos maiores
  { id: 'conversas-abertas',   label: 'Conversas em Aberto',   icon: '📞', enabled: true,  x: 0,    y: 780, width: 960, height: 260, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'metas-resultados',    label: 'Metas & Resultados',    icon: '🏆', enabled: true,  x: 970,  y: 780, width: 950, height: 260, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
];

const PRESETS: { name: string; widgets: TVWidgetLayout[] }[] = [
  { name: 'Monitor 16:9', widgets: DEFAULT_WIDGETS },
  {
    name: 'TV Antiga (4:3)',
    widgets: DEFAULT_WIDGETS.map(w => ({ ...w, x: Math.round(w.x * 0.7) + 290, width: Math.round(w.width * 0.7) })),
  },
  {
    name: 'Widescreen 21:9',
    widgets: DEFAULT_WIDGETS.map(w => ({ ...w, width: Math.round(w.width * 1.1) })),
  },
];

const STORAGE_KEY = 'tv-freeform-layout-v2';
const SAVED_LAYOUTS_KEY = 'tv-freeform-saved-layouts-v2';

interface TVFreeformContextType {
  widgets: TVWidgetLayout[];
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  updateWidget: (id: string, partial: Partial<TVWidgetLayout>) => void;
  toggleWidget: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  resetLayout: () => void;
  applyPreset: (name: string) => void;
  presets: { name: string }[];
  savedLayouts: TVSavedLayout[];
  saveLayout: (name: string) => void;
  loadLayout: (name: string) => void;
  deleteLayout: (name: string) => void;
  exportLayout: () => string;
  importLayout: (json: string) => boolean;
  canvasWidth: number;
  canvasHeight: number;
  centerHorizontal: (id: string) => void;
  centerVertical: (id: string) => void;
  resetWidgetSize: (id: string) => void;
  duplicateWidget: (id: string) => void;
}

const TVFreeformContext = createContext<TVFreeformContextType | undefined>(undefined);

export function TVFreeformProvider({ children }: { children: ReactNode }) {
  const [widgets, setWidgets] = useState<TVWidgetLayout[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return DEFAULT_WIDGETS.map(def => {
          const s = parsed.find((w: TVWidgetLayout) => w.id === def.id);
          return s ? { ...def, ...s } : def;
        });
      }
    } catch {}
    return DEFAULT_WIDGETS;
  });

  const [savedLayouts, setSavedLayouts] = useState<TVSavedLayout[]>(() => {
    try {
      const s = localStorage.getItem(SAVED_LAYOUTS_KEY);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets)); }, [widgets]);
  useEffect(() => { localStorage.setItem(SAVED_LAYOUTS_KEY, JSON.stringify(savedLayouts)); }, [savedLayouts]);

  const updateWidget = useCallback((id: string, partial: Partial<TVWidgetLayout>) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, ...partial } : w));
  }, []);

  const toggleWidget = useCallback((id: string) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));
  }, []);

  const bringToFront = useCallback((id: string) => {
    setWidgets(prev => {
      const maxZ = Math.max(...prev.map(w => w.zIndex));
      return prev.map(w => w.id === id ? { ...w, zIndex: maxZ + 1 } : w);
    });
  }, []);

  const sendToBack = useCallback((id: string) => {
    setWidgets(prev => {
      const minZ = Math.min(...prev.map(w => w.zIndex));
      return prev.map(w => w.id === id ? { ...w, zIndex: minZ - 1 } : w);
    });
  }, []);

  const resetLayout = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const applyPreset = useCallback((name: string) => {
    const preset = PRESETS.find(p => p.name === name);
    if (preset) setWidgets(preset.widgets);
  }, []);

  const saveLayout = useCallback((name: string) => {
    setSavedLayouts(prev => {
      const filtered = prev.filter(l => l.name !== name);
      return [...filtered, { name, widgets: [...widgets], createdAt: new Date().toISOString() }];
    });
  }, [widgets]);

  const loadLayout = useCallback((name: string) => {
    const layout = savedLayouts.find(l => l.name === name);
    if (layout) setWidgets(layout.widgets);
  }, [savedLayouts]);

  const deleteLayout = useCallback((name: string) => {
    setSavedLayouts(prev => prev.filter(l => l.name !== name));
  }, []);

  const exportLayout = useCallback(() => {
    return JSON.stringify({ widgets, exportedAt: new Date().toISOString() }, null, 2);
  }, [widgets]);

  const importLayout = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (parsed.widgets && Array.isArray(parsed.widgets)) {
        setWidgets(parsed.widgets);
        return true;
      }
    } catch {}
    return false;
  }, []);

  const centerHorizontal = useCallback((id: string) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, x: Math.round((CANVAS_W - w.width) / 2) } : w));
  }, []);

  const centerVertical = useCallback((id: string) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, y: Math.round((CANVAS_H - w.height) / 2) } : w));
  }, []);

  const resetWidgetSize = useCallback((id: string) => {
    const def = DEFAULT_WIDGETS.find(w => w.id === id);
    if (def) {
      setWidgets(prev => prev.map(w => w.id === id ? { ...w, width: def.width, height: def.height, x: def.x, y: def.y } : w));
    }
  }, []);

  const duplicateWidget = useCallback((_id: string) => {
    // IDs map to render blocks, can't truly duplicate
  }, []);

  return (
    <TVFreeformContext.Provider value={{
      widgets, isEditing, setIsEditing, selectedId, setSelectedId,
      snapEnabled, setSnapEnabled, updateWidget, toggleWidget,
      bringToFront, sendToBack, resetLayout, applyPreset,
      presets: PRESETS.map(p => ({ name: p.name })),
      savedLayouts, saveLayout, loadLayout, deleteLayout,
      exportLayout, importLayout,
      canvasWidth: CANVAS_W, canvasHeight: CANVAS_H,
      centerHorizontal, centerVertical, resetWidgetSize, duplicateWidget,
    }}>
      {children}
    </TVFreeformContext.Provider>
  );
}

export function useTVFreeform() {
  const ctx = useContext(TVFreeformContext);
  if (!ctx) throw new Error('useTVFreeform must be used within TVFreeformProvider');
  return ctx;
}
