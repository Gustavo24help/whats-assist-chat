import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'tv-monitor-settings-v1';

export interface MonitorSettings {
  preset: string;
  safeZone: number;     // 0-20%
  fontSize: number;     // 80-150%
  brightness: number;   // 50-120%
  presetName: string;
}

const DEFAULT_SETTINGS: MonitorSettings = {
  preset: 'hd',
  safeZone: 0,
  fontSize: 100,
  brightness: 100,
  presetName: '',
};

const PRESETS = [
  { id: 'old-tv', label: '📺 TV Antiga (4:3)', safeZone: 8, fontSize: 120 },
  { id: 'hd', label: '📺 TV HD (16:9)', safeZone: 0, fontSize: 100 },
  { id: 'widescreen', label: '🖥️ Monitor Widescreen (21:9)', safeZone: 0, fontSize: 95 },
  { id: 'tablet', label: '📱 Tablet (vertical)', safeZone: 2, fontSize: 110 },
];

export function useMonitorSettings(): [MonitorSettings, (s: MonitorSettings) => void] {
  const [settings, setSettings] = useState<MonitorSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  return [settings, setSettings];
}

interface Props {
  open: boolean;
  onClose: () => void;
  settings: MonitorSettings;
  onUpdate: (s: MonitorSettings) => void;
}

export function TVMonitorSettings({ open, onClose, settings, onUpdate }: Props) {
  const [local, setLocal] = useState(settings);

  useEffect(() => {
    if (open) setLocal(settings);
  }, [open, settings]);

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setLocal(s => ({ ...s, preset: preset.id, safeZone: preset.safeZone, fontSize: preset.fontSize }));
  };

  const save = () => {
    onUpdate(local);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">⚙️ Configurações de Monitor</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Presets */}
          <div>
            <label className="text-xs text-gray-400 font-medium mb-2 block">Presets</label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className={cn(
                    'text-xs p-2.5 rounded-lg border transition-all text-left',
                    local.preset === p.id
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Safe Zone */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-400">Safe Zone (margens)</label>
              <span className="text-xs text-cyan-400 font-mono">{local.safeZone}%</span>
            </div>
            <Slider
              value={[local.safeZone]}
              onValueChange={([v]) => setLocal(s => ({ ...s, safeZone: v }))}
              min={0} max={20} step={1}
              className="w-full"
            />
          </div>

          {/* Font Size */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-400">Tamanho da fonte</label>
              <span className="text-xs text-cyan-400 font-mono">{local.fontSize}%</span>
            </div>
            <Slider
              value={[local.fontSize]}
              onValueChange={([v]) => setLocal(s => ({ ...s, fontSize: v }))}
              min={80} max={150} step={5}
              className="w-full"
            />
          </div>

          {/* Brightness */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-400">Brilho</label>
              <span className="text-xs text-cyan-400 font-mono">{local.brightness}%</span>
            </div>
            <Slider
              value={[local.brightness]}
              onValueChange={([v]) => setLocal(s => ({ ...s, brightness: v }))}
              min={50} max={120} step={5}
              className="w-full"
            />
          </div>

          {/* Save preset name */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Nome da configuração (opcional)</label>
            <Input
              value={local.presetName}
              onChange={e => setLocal(s => ({ ...s, presetName: e.target.value }))}
              placeholder="Ex: Minha TV Samsung"
              className="h-8 text-xs bg-gray-800 border-gray-600 text-white"
            />
          </div>

          <Button onClick={save} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
            Salvar Configurações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
