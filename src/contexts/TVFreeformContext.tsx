import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface TVWidgetLayout {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  x: number;       // px
  y: number;       // px
  width: number;   // px
  height: number;  // px
  zIndex: number;
  locked: boolean;       // lock aspect ratio
  autoHeight: boolean;   // height auto by content
  scaleMode: 'fixed' | 'fluid'; // px vs %
}

export interface TVSavedLayout {
  name: string;
  widgets: TVWidgetLayout[];
  createdAt: string;
}

const CANVAS_W = 1920;
const CANVAS_H = 1080;

const DEFAULT_WIDGETS: TVWidgetLayout[] = [
  { id: 'kpis-principais',  label: 'KPIs Principais',       icon: '📊', enabled: true,  x: 0,   y: 0,   width: 1920, height: 200, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'funil-vendas',     label: 'Funil de Vendas',       icon: '🔄', enabled: true,  x: 0,   y: 210, width: 1920, height: 180, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'taxas-conversao',  label: 'Taxas de Conversão',    icon: '📈', enabled: true,  x: 0,   y: 400, width: 1920, height: 180, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'metricas-tempo',   label: 'Métricas de Tempo',     icon: '⏱️', enabled: true,  x: 0,   y: 590, width: 1920, height: 170, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'conversas-abertas', label: 'Conversas em Aberto',  icon: '📞', enabled: true,  x: 0,   y: 770, width: 1920, height: 250, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'metas-resultados', label: 'Metas & Resultados',    icon: '🏆', enabled: true,  x: 0,   y: 1030, width: 1920, height: 200, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
];

const PRESETS: { name: string; widgets: TVWidgetLayout[] }[] = [
  {
    name: 'Monitor 16:9',
    widgets: DEFAULT_WIDGETS,
  },
  {
    name: 'TV Antiga (4:3)',
    widgets: DEFAULT_WIDGETS.map(w => ({
      ...w,
      x: Math.round(w.x * 0.75) + 240,
      width: Math.round(w.width * 0.75),
    })),
  },
  {
    name: 'Widescreen 21:9',
    widgets: DEFAULT_WIDGETS.map((w, i) => ({
      ...w,
      width: i < 3 ? 640 : 960,
      x: i < 3 ? i * 640 : (i - 3) * 960,
      y: i < 3 ? 0 : 320,
      height: i < 3 ? 310 : 280,
    })),
  },
];

const STORAGE_KEY = 'tv-freeform-layout-v1';
const SAVED_LAYOUTS_KEY = 'tv-freeform-saved-layouts-v1';

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
        // Merge with defaults for new widgets
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  }, [widgets]);

  useEffect(() => {
    localStorage.setItem(SAVED_LAYOUTS_KEY, JSON.stringify(savedLayouts));
  }, [savedLayouts]);

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

  const duplicateWidget = useCallback((id: string) => {
    setWidgets(prev => {
      const w = prev.find(w => w.id === id);
      if (!w) return prev;
      // Can't truly duplicate since IDs map to render blocks, so just inform user
      return prev;
    });
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
