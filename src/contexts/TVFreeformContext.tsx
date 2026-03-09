import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  dbId?: string; // id from tv_layouts table
}

const CANVAS_W = 1920;
const CANVAS_H = 1080;

const DEFAULT_WIDGETS: TVWidgetLayout[] = [
  // Row 1 — KPIs principais
  { id: 'receita-total',       label: 'Receita Total',         icon: '💰', enabled: true,  x: 0,    y: 0,   width: 320, height: 180, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'lucro-bruto',         label: 'Lucro Bruto',           icon: '📈', enabled: true,  x: 330,  y: 0,   width: 320, height: 180, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'servicos-fechados',   label: 'Serviços Fechados',     icon: '✅', enabled: true,  x: 660,  y: 0,   width: 320, height: 180, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'ticket-medio',        label: 'Ticket Médio',          icon: '🎫', enabled: true,  x: 990,  y: 0,   width: 310, height: 180, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'margem-media',        label: 'Margem Média',          icon: '📊', enabled: true,  x: 1310, y: 0,   width: 300, height: 180, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'conversao-total',     label: 'Conversão Total',       icon: '🔄', enabled: true,  x: 1620, y: 0,   width: 300, height: 180, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },

  // Row 2 — Metas individuais
  { id: 'meta-diaria-os',        label: 'Meta Diária — Agendamentos',   icon: '🎯', enabled: true,  x: 0,    y: 190, width: 240, height: 170, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'meta-mensal-os',        label: 'Meta Mensal — Agendamentos',   icon: '📅', enabled: true,  x: 250,  y: 190, width: 240, height: 170, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'meta-diaria-receita',   label: 'Meta Diária — Valor OS Agend.',icon: '💰', enabled: true,  x: 500,  y: 190, width: 240, height: 170, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'meta-mensal-receita',   label: 'Meta Mensal — Valor OS Agend.',icon: '📊', enabled: true,  x: 750,  y: 190, width: 240, height: 170, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'meta-diaria-finalizados',label:'Meta Diária — Finalizados',    icon: '✅', enabled: true,  x: 1000, y: 190, width: 240, height: 170, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'meta-mensal-finalizados',label:'Meta Mensal — Finalizados',    icon: '📋', enabled: true,  x: 1250, y: 190, width: 240, height: 170, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'meta-acumulada-os',      label:'Acumulado Mês — Agendamentos', icon: '📈', enabled: true,  x: 1500, y: 190, width: 240, height: 170, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'meta-acumulada-receita', label:'Acumulado Mês — Valor OS',     icon: '📈', enabled: true,  x: 1750, y: 190, width: 240, height: 170, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'resultado-hoje-os',     label: 'Agendamentos Hoje',            icon: '📋', enabled: true,  x: 0,    y: 370, width: 230, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'resultado-mensal-os',   label: 'Agendamentos do Mês',          icon: '📋', enabled: true,  x: 240,  y: 370, width: 230, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'resultado-hoje-receita',label: 'Finalizados Hoje',             icon: '✅', enabled: true,  x: 480,  y: 370, width: 220, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'resultado-mensal-receita',label:'Finalizados do Mês',          icon: '✅', enabled: true,  x: 710,  y: 370, width: 210, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },

  // Row 4 — Funil de vendas
  { id: 'funil-cliques',       label: 'Cliques',               icon: '🎯', enabled: true,  x: 0,    y: 530, width: 310, height: 160, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'funil-conversas',     label: 'Conversas',             icon: '💬', enabled: true,  x: 320,  y: 530, width: 310, height: 160, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'funil-fs',            label: 'FS Criadas',            icon: '📋', enabled: true,  x: 640,  y: 530, width: 310, height: 160, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'funil-agendados',     label: 'Status Agendado',       icon: '📅', enabled: true,  x: 960,  y: 530, width: 310, height: 160, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'funil-executados',    label: 'Executados',            icon: '✅', enabled: true,  x: 1280, y: 530, width: 310, height: 160, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'funil-pagos',         label: 'Pagos',                 icon: '💰', enabled: true,  x: 1600, y: 530, width: 320, height: 160, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },

  // Row 5 — Taxas de conversão
  { id: 'taxa-agend-fs',       label: 'Agendados / FS',        icon: '📊', enabled: true,  x: 0,    y: 700, width: 310, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'taxa-pagos-fs',       label: 'Pagos / FS',            icon: '📊', enabled: true,  x: 320,  y: 700, width: 310, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'taxa-pagos-agend',    label: 'Pagos / Agendados',     icon: '📊', enabled: true,  x: 640,  y: 700, width: 310, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'taxa-pagos-cliques',  label: 'Pagos / Cliques',       icon: '📊', enabled: true,  x: 960,  y: 700, width: 310, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'taxa-conv-cliques',   label: 'Conversas / Cliques',   icon: '📊', enabled: true,  x: 1280, y: 700, width: 310, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'taxa-exec-agend',     label: 'Executados / Agendados',icon: '📊', enabled: true,  x: 1600, y: 700, width: 320, height: 150, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },

  // Row 6 — Métricas de tempo
  { id: 'tempo-resposta',      label: 'Tempo Resposta',        icon: '⚡', enabled: true,  x: 0,    y: 860, width: 380, height: 140, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'tempo-orcamento',     label: 'Receb. Orçamento',      icon: '🎯', enabled: true,  x: 390,  y: 860, width: 380, height: 140, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'tempo-fs-agendado',   label: 'FS → Agendado',         icon: '📅', enabled: true,  x: 780,  y: 860, width: 380, height: 140, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'tempo-agendado-exec', label: 'Agendado → Executado',  icon: '🔄', enabled: true,  x: 1170, y: 860, width: 370, height: 140, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
  { id: 'tempo-ciclo',         label: 'Ciclo Completo',        icon: '🎪', enabled: true,  x: 1550, y: 860, width: 370, height: 140, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },

  // Row 7 — Blocos maiores
  { id: 'widget-rotativo',    label: 'Widget Rotativo',       icon: '🔁', enabled: true,  x: 0,    y: 1010, width: 1920, height: 260, zIndex: 1, locked: false, autoHeight: false, scaleMode: 'fluid' },
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
const LAYOUT_ROTATION_KEY = 'tv-freeform-layout-rotation-v1';

/** Merge saved widgets with defaults: keeps saved positions, adds any new widgets from code */
function mergeWithDefaults(saved: TVWidgetLayout[]): TVWidgetLayout[] {
  const savedMap = new Map(saved.map(w => [w.id, w]));
  return DEFAULT_WIDGETS.map(def => {
    const s = savedMap.get(def.id);
    return s ? { ...def, ...s } : def;
  });
}

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
  moveSavedLayout: (name: string, direction: 'up' | 'down') => void;
  exportLayout: () => string;
  importLayout: (json: string) => boolean;
  canvasWidth: number;
  canvasHeight: number;
  centerHorizontal: (id: string) => void;
  centerVertical: (id: string) => void;
  resetWidgetSize: (id: string) => void;
  duplicateWidget: (id: string) => void;
  dbSaving: boolean;
  layoutRotationEnabled: boolean;
  setLayoutRotationEnabled: (v: boolean) => void;
  layoutRotationIntervalSec: number;
  setLayoutRotationIntervalSec: (sec: number) => void;
  layoutRotationItems: string[];
  setLayoutRotationItems: (names: string[]) => void;
}

const TVFreeformContext = createContext<TVFreeformContextType | undefined>(undefined);

export function TVFreeformProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage cache for instant load
  const [widgets, setWidgets] = useState<TVWidgetLayout[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return mergeWithDefaults(JSON.parse(saved));
    } catch {}
    return DEFAULT_WIDGETS;
  });

  const [savedLayouts, setSavedLayouts] = useState<TVSavedLayout[]>(() => {
    try {
      const s = localStorage.getItem(SAVED_LAYOUTS_KEY);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  const [isEditing, setIsEditingRaw] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [dbSaving, setDbSaving] = useState(false);
  const [layoutRotationEnabled, setLayoutRotationEnabled] = useState(false);
  const [layoutRotationIntervalSec, setLayoutRotationIntervalSec] = useState(20);
  const [layoutRotationItems, setLayoutRotationItems] = useState<string[]>([]);
  const dbLoaded = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_ROTATION_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (typeof parsed.enabled === 'boolean') setLayoutRotationEnabled(parsed.enabled);
      if (typeof parsed.intervalSec === 'number') setLayoutRotationIntervalSec(Math.max(5, parsed.intervalSec));
      if (Array.isArray(parsed.items)) setLayoutRotationItems(parsed.items.filter((v: unknown) => typeof v === 'string'));
    } catch {}
  }, []);

  // ---- DB: Load default layout on mount ----
  useEffect(() => {
    async function loadFromDB() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const db = supabase as any;

      // Load default layout
      const { data: defaultLayout } = await db
        .from('tv_layouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

      if (defaultLayout?.widgets) {
        const dbWidgets = mergeWithDefaults(defaultLayout.widgets as TVWidgetLayout[]);
        setWidgets(dbWidgets);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dbWidgets));
      }

      // Load saved layouts list
      const { data: allLayouts } = await db
        .from('tv_layouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (allLayouts) {
        const loaded = allLayouts.map((l: any) => ({
          name: l.nome,
          widgets: l.widgets as TVWidgetLayout[],
          createdAt: l.created_at,
          dbId: l.id,
        }));
        setSavedLayouts(loaded);
      }

      dbLoaded.current = true;
    }
    loadFromDB();
  }, []);

  // ---- Persist to localStorage as cache ----
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets)); }, [widgets]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_ROTATION_KEY, JSON.stringify({
      enabled: layoutRotationEnabled,
      intervalSec: layoutRotationIntervalSec,
      items: layoutRotationItems,
    }));
  }, [layoutRotationEnabled, layoutRotationIntervalSec, layoutRotationItems]);

  // ---- DB: Auto-save when exiting edit mode ----
  const setIsEditing = useCallback((v: boolean) => {
    setIsEditingRaw(prev => {
      // Was editing, now stopping → auto-save to DB
      if (prev && !v) {
        saveDefaultToDB(widgets);
      }
      return v;
    });
  }, [widgets]);

  async function saveDefaultToDB(widgetsToSave: TVWidgetLayout[]) {
    setDbSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const db = supabase as any;

      const { data: existing } = await db
        .from('tv_layouts')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

      if (existing) {
        await db.from('tv_layouts').update({
          widgets: JSON.parse(JSON.stringify(widgetsToSave)),
        }).eq('id', existing.id);
      } else {
        await db.from('tv_layouts').insert({
          user_id: user.id,
          nome: 'default',
          widgets: JSON.parse(JSON.stringify(widgetsToSave)),
          is_default: true,
        });
      }
    } catch (e) {
      console.error('Error saving layout to DB:', e);
    } finally {
      setDbSaving(false);
    }
  }

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
    // Also save reset to DB
    saveDefaultToDB(DEFAULT_WIDGETS);
  }, []);

  const applyPreset = useCallback((name: string) => {
    const preset = PRESETS.find(p => p.name === name);
    if (preset) {
      setWidgets(preset.widgets);
      // Save preset to DB
      saveDefaultToDB(preset.widgets);
    }
  }, []);

  const saveLayout = useCallback(async (name: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const db = supabase as any;
    
    if (user) {
      const { data: existing } = await db
        .from('tv_layouts')
        .select('id')
        .eq('user_id', user.id)
        .eq('nome', name)
        .maybeSingle();

      if (existing) {
        await db.from('tv_layouts').update({
          widgets: JSON.parse(JSON.stringify(widgets)),
        }).eq('id', existing.id);
      } else {
        await db.from('tv_layouts').insert({
          user_id: user.id,
          nome: name,
          widgets: JSON.parse(JSON.stringify(widgets)),
          is_default: false,
        });
      }

      // Reload saved layouts
      const { data: allLayouts } = await db
        .from('tv_layouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (allLayouts) {
        const loaded = allLayouts.map((l: any) => ({
          name: l.nome,
          widgets: l.widgets as TVWidgetLayout[],
          createdAt: l.created_at,
          dbId: l.id,
        }));
        setSavedLayouts(loaded);
      }
    }

    // Also keep in localStorage as fallback
    setSavedLayouts(prev => {
      const filtered = prev.filter(l => l.name !== name);
      return [...filtered, { name, widgets: [...widgets], createdAt: new Date().toISOString() }];
    });
  }, [widgets]);

  const loadLayout = useCallback((name: string) => {
    const layout = savedLayouts.find(l => l.name === name);
    if (layout) {
      const merged = mergeWithDefaults(layout.widgets);
      setWidgets(merged);
    }
  }, [savedLayouts]);

  const deleteLayout = useCallback(async (name: string) => {
    const layout = savedLayouts.find(l => l.name === name);
    if (layout?.dbId) {
      await (supabase as any).from('tv_layouts').delete().eq('id', layout.dbId);
    }
    setSavedLayouts(prev => prev.filter(l => l.name !== name));
    setLayoutRotationItems(prev => prev.filter(item => item !== name));
  }, [savedLayouts]);

  const moveSavedLayout = useCallback((name: string, direction: 'up' | 'down') => {
    setSavedLayouts(prev => {
      const index = prev.findIndex(l => l.name === name);
      if (index < 0) return prev;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const exportLayout = useCallback(() => {
    return JSON.stringify({ widgets, exportedAt: new Date().toISOString() }, null, 2);
  }, [widgets]);

  const importLayout = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (parsed.widgets && Array.isArray(parsed.widgets)) {
        setWidgets(mergeWithDefaults(parsed.widgets));
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
      savedLayouts, saveLayout, loadLayout, deleteLayout, moveSavedLayout,
      exportLayout, importLayout,
      canvasWidth: CANVAS_W, canvasHeight: CANVAS_H,
      centerHorizontal, centerVertical, resetWidgetSize, duplicateWidget,
      dbSaving,
      layoutRotationEnabled,
      setLayoutRotationEnabled,
      layoutRotationIntervalSec,
      setLayoutRotationIntervalSec,
      layoutRotationItems,
      setLayoutRotationItems,
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
