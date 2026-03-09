import { useTVFreeform } from '@/contexts/TVFreeformContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Lock, Unlock, AlignCenterHorizontal, AlignCenterVertical, RotateCcw, ArrowUp, ArrowDown, Trash2, Grid3X3, Save, Upload, Download, Eye, EyeOff, MoveUp, MoveDown, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function TVWidgetProperties() {
  const {
    widgets, selectedId, setSelectedId, updateWidget, isEditing,
    bringToFront, sendToBack, centerHorizontal, centerVertical,
    resetWidgetSize, toggleWidget, snapEnabled, setSnapEnabled,
    savedLayouts, saveLayout, loadLayout, deleteLayout, moveSavedLayout,
    exportLayout, importLayout, applyPreset, presets, resetLayout,
    layoutRotationEnabled, setLayoutRotationEnabled,
    layoutRotationIntervalSec, setLayoutRotationIntervalSec,
    layoutRotationItems, setLayoutRotationItems,
  } = useTVFreeform();

  const [saveName, setSaveName] = useState('');
  const [importJson, setImportJson] = useState('');
  const [showImport, setShowImport] = useState(false);

  if (!isEditing) return null;

  const selected = selectedId ? widgets.find(w => w.id === selectedId) : null;

  const handleExport = () => {
    const json = exportLayout();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tv-layout.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (importLayout(importJson)) {
      setImportJson('');
      setShowImport(false);
    }
  };


  const toggleLayoutInRotation = (name: string, enabled: boolean) => {
    setLayoutRotationItems(prev => {
      const next = enabled ? [...new Set([...prev, name])] : prev.filter(item => item !== name);
      return next;
    });
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[280px] bg-gray-900/95 backdrop-blur-md border-l border-cyan-500/20 text-white z-50 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-700/50 flex items-center justify-between">
        <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Propriedades</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={cn('p-1 rounded text-xs', snapEnabled ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-500')}
            title="Snap to Grid"
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Selected widget properties */}
      {selected ? (
        <div className="p-3 space-y-3 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <span className="text-sm">{selected.icon}</span>
            <span className="text-sm font-medium flex-1">{selected.label}</span>
            <button onClick={() => setSelectedId(null)} className="text-gray-500 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Position */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">X (px)</label>
              <Input
                type="number"
                value={Math.round(selected.x)}
                onChange={e => updateWidget(selected.id, { x: Number(e.target.value) || 0 })}
                className="h-7 text-xs bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Y (px)</label>
              <Input
                type="number"
                value={Math.round(selected.y)}
                onChange={e => updateWidget(selected.id, { y: Number(e.target.value) || 0 })}
                className="h-7 text-xs bg-gray-800 border-gray-600 text-white"
              />
            </div>
          </div>

          {/* Size */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Largura (px)</label>
              <Input
                type="number"
                value={Math.round(selected.width)}
                onChange={e => updateWidget(selected.id, { width: Math.max(100, Number(e.target.value) || 100) })}
                className="h-7 text-xs bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Altura (px)</label>
              <Input
                type="number"
                value={Math.round(selected.height)}
                onChange={e => updateWidget(selected.id, { height: Math.max(60, Number(e.target.value) || 60) })}
                className="h-7 text-xs bg-gray-800 border-gray-600 text-white"
                disabled={selected.autoHeight}
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                {selected.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                Travar proporção
              </span>
              <Switch
                checked={selected.locked}
                onCheckedChange={v => updateWidget(selected.id, { locked: v })}
                className="h-4 w-7"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400">Altura automática</span>
              <Switch
                checked={selected.autoHeight}
                onCheckedChange={v => updateWidget(selected.id, { autoHeight: v })}
                className="h-4 w-7"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400">Escala</span>
              <div className="flex gap-1">
                {(['fixed', 'fluid'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => updateWidget(selected.id, { scaleMode: mode })}
                    className={cn(
                      'text-[9px] px-2 py-0.5 rounded border',
                      selected.scaleMode === mode
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                        : 'bg-gray-800 border-gray-600 text-gray-400'
                    )}
                  >
                    {mode === 'fixed' ? '📌 Fixa' : '📐 Fluida'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-[10px] bg-gray-800 border-gray-600 text-gray-300" onClick={() => centerHorizontal(selected.id)}>
              <AlignCenterHorizontal className="h-3 w-3 mr-1" />
              Centralizar H
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px] bg-gray-800 border-gray-600 text-gray-300" onClick={() => centerVertical(selected.id)}>
              <AlignCenterVertical className="h-3 w-3 mr-1" />
              Centralizar V
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px] bg-gray-800 border-gray-600 text-gray-300" onClick={() => bringToFront(selected.id)}>
              <ArrowUp className="h-3 w-3 mr-1" />
              Para frente
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px] bg-gray-800 border-gray-600 text-gray-300" onClick={() => sendToBack(selected.id)}>
              <ArrowDown className="h-3 w-3 mr-1" />
              Para trás
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px] bg-gray-800 border-gray-600 text-gray-300" onClick={() => resetWidgetSize(selected.id)}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Resetar
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px] bg-gray-800 border-gray-600 text-red-400 hover:text-red-300" onClick={() => { toggleWidget(selected.id); setSelectedId(null); }}>
              <EyeOff className="h-3 w-3 mr-1" />
              Ocultar
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3 border-b border-gray-700/50 text-xs text-gray-500 text-center">
          Clique num widget para editar
        </div>
      )}

      {/* Widgets list / layers */}
      <div className="p-3 border-b border-gray-700/50">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Camadas / Widgets</div>
        <div className="space-y-1">
          {[...widgets].sort((a, b) => b.zIndex - a.zIndex).map(w => (
            <div
              key={w.id}
              className={cn(
                'flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer transition-all',
                selectedId === w.id ? 'bg-cyan-500/15 text-cyan-300' : 'text-gray-400 hover:bg-gray-800/50',
                !w.enabled && 'opacity-40'
              )}
              onClick={() => setSelectedId(w.id)}
            >
              <span>{w.icon}</span>
              <span className="flex-1 truncate">{w.label}</span>
              <button onClick={(e) => { e.stopPropagation(); toggleWidget(w.id); }} className="hover:text-white">
                {w.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div className="p-3 border-b border-gray-700/50">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Presets</div>
        <div className="space-y-1">
          {presets.map(p => (
            <button
              key={p.name}
              onClick={() => applyPreset(p.name)}
              className="w-full text-left text-xs p-1.5 rounded bg-gray-800/50 text-gray-300 hover:bg-gray-700 transition-all"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Save / Load */}
      <div className="p-3 border-b border-gray-700/50 space-y-2">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Salvar / Carregar</div>
        <div className="flex gap-1">
          <Input
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            placeholder="Nome do layout"
            className="h-7 text-xs bg-gray-800 border-gray-600 text-white flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs bg-gray-800 border-gray-600 text-cyan-300"
            onClick={() => { if (saveName.trim()) { saveLayout(saveName.trim()); setSaveName(''); } }}
            disabled={!saveName.trim()}
          >
            <Save className="h-3 w-3" />
          </Button>
        </div>
        {savedLayouts.length > 0 && (
          <div className="space-y-1">
            {savedLayouts.map((l, idx) => (
              <div key={l.name} className="flex items-center gap-1">
                <button
                  onClick={() => loadLayout(l.name)}
                  className="flex-1 text-left text-[10px] p-1 rounded bg-gray-800/50 text-gray-300 hover:bg-gray-700 truncate"
                >
                  {l.name}
                </button>
                <button
                  onClick={() => moveSavedLayout(l.name, 'up')}
                  disabled={idx === 0}
                  className="text-gray-500 hover:text-cyan-300 p-0.5 disabled:opacity-30"
                  title="Subir"
                >
                  <MoveUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => moveSavedLayout(l.name, 'down')}
                  disabled={idx === savedLayouts.length - 1}
                  className="text-gray-500 hover:text-cyan-300 p-0.5 disabled:opacity-30"
                  title="Descer"
                >
                  <MoveDown className="h-3 w-3" />
                </button>
                <button onClick={() => deleteLayout(l.name)} className="text-gray-500 hover:text-red-400 p-0.5">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-6 text-[9px] bg-gray-800 border-gray-600 text-gray-300 flex-1" onClick={handleExport}>
            <Download className="h-3 w-3 mr-1" />
            Exportar JSON
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-[9px] bg-gray-800 border-gray-600 text-gray-300 flex-1" onClick={() => setShowImport(!showImport)}>
            <Upload className="h-3 w-3 mr-1" />
            Importar
          </Button>
        </div>
        {showImport && (
          <div className="space-y-1">
            <textarea
              value={importJson}
              onChange={e => setImportJson(e.target.value)}
              placeholder="Cole o JSON aqui..."
              className="w-full h-16 text-[10px] bg-gray-800 border border-gray-600 rounded p-1 text-white resize-none"
            />
            <Button variant="outline" size="sm" className="h-6 text-[9px] w-full bg-cyan-500/10 border-cyan-500/30 text-cyan-300" onClick={handleImport}>
              Aplicar
            </Button>
          </div>
        )}
      </div>

      {/* Rotação de layouts */}
      <div className="p-3 border-b border-gray-700/50 space-y-2">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
          <Repeat className="h-3 w-3" />
          Alternar layouts
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">Ativar loop</span>
          <Switch checked={layoutRotationEnabled} onCheckedChange={setLayoutRotationEnabled} className="h-4 w-7" />
        </div>

        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Velocidade (segundos)</label>
          <Input
            type="number"
            min={5}
            value={layoutRotationIntervalSec}
            onChange={e => setLayoutRotationIntervalSec(Math.max(5, Number(e.target.value) || 5))}
            className="h-7 text-xs bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div className="space-y-1">
          {savedLayouts.map(l => (
            <label key={`rotation-${l.name}`} className="flex items-center justify-between rounded bg-gray-800/40 p-1.5 text-[10px] text-gray-300">
              <span className="truncate mr-2">{l.name}</span>
              <Checkbox
                checked={layoutRotationItems.includes(l.name)}
                onCheckedChange={(checked) => toggleLayoutInRotation(l.name, checked === true)}
              />
            </label>
          ))}
          {savedLayouts.length === 0 && <div className="text-[10px] text-gray-500">Salve layouts para incluir no loop.</div>}
        </div>
      </div>

      {/* Reset */}
      <div className="p-3">
        <Button variant="outline" size="sm" className="h-7 text-xs w-full bg-gray-800 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={resetLayout}>
          <RotateCcw className="h-3 w-3 mr-1" />
          Resetar Layout
        </Button>
      </div>
    </div>
  );
}
