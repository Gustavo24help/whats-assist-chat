import { useTVLayout, TVBlockSize } from '@/contexts/TVLayoutContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GripVertical, Pencil, RotateCcw, Minus, Square, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZE_OPTIONS: { value: TVBlockSize; label: string; icon: React.ReactNode }[] = [
  { value: 'compact', label: 'P', icon: <Minus className="h-3 w-3" /> },
  { value: 'normal', label: 'M', icon: <Square className="h-3 w-3" /> },
  { value: 'large', label: 'G', icon: <Maximize2 className="h-3 w-3" /> },
];

export function TVLayoutCustomizer() {
  const { blocks, isEditing, setIsEditing, toggleBlock, reorderBlocks, setBlockSize, resetLayout } = useTVLayout();

  const sorted = [...blocks].sort((a, b) => a.order - b.order);

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', String(idx));
  };
  const handleDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('text/plain'));
    if (from !== toIdx) reorderBlocks(from, toIdx);
  };

  return (
    <Sheet open={isEditing} onOpenChange={setIsEditing}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs bg-gray-800 border-gray-700 gap-1.5 hover:bg-gray-700">
          <Pencil className="h-3 w-3" />
          Editar Layout
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[340px] bg-gray-900 border-gray-700 text-white">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between text-white">
            <span>Personalizar Dashboard TV</span>
            <Button variant="ghost" size="sm" onClick={resetLayout} className="text-gray-400 hover:text-white">
              <RotateCcw className="h-4 w-4 mr-1" />
              Resetar
            </Button>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-2">
          <p className="text-xs text-gray-400 mb-4">
            Arraste para reordenar, ative/desative e ajuste o tamanho dos blocos.
          </p>
          {sorted.map((block, idx) => (
            <div
              key={block.id}
              draggable
              onDragStart={e => handleDragStart(e, idx)}
              onDrop={e => handleDrop(e, idx)}
              onDragOver={e => e.preventDefault()}
              className={cn(
                'flex flex-col gap-2 p-3 rounded-lg border border-gray-700 bg-gray-800/50 transition-all',
                'hover:border-gray-500 cursor-grab active:cursor-grabbing',
                !block.enabled && 'opacity-40'
              )}
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm mr-1">{block.icon}</span>
                <span className="flex-1 text-sm font-medium">{block.label}</span>
                <Switch
                  checked={block.enabled}
                  onCheckedChange={() => toggleBlock(block.id)}
                />
              </div>
              {block.enabled && (
                <div className="flex items-center gap-1 ml-8">
                  <span className="text-[10px] text-gray-500 mr-1">Tamanho:</span>
                  {SIZE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setBlockSize(block.id, opt.value)}
                      className={cn(
                        'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-all',
                        block.size === opt.value
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                      )}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-gray-700">
          <p className="text-[10px] text-gray-500">
            Configurações salvas automaticamente no navegador.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
