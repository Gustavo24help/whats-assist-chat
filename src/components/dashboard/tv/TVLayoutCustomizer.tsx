import { useTVLayout } from '@/contexts/TVLayoutContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { GripVertical, Pencil, RotateCcw, Columns, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const COL_OPTIONS = [
  { value: 2, label: '2/6' },
  { value: 3, label: '3/6' },
  { value: 4, label: '4/6' },
  { value: 6, label: '6/6' },
];

export function TVLayoutCustomizer() {
  const { blocks, isEditing, setIsEditing, toggleBlock, reorderBlocks, setBlockCols, setBlockMinHeight, resetLayout } = useTVLayout();

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
        <Button variant="outline" size="sm" className="h-7 text-xs bg-gray-800/80 border-cyan-500/30 gap-1.5 hover:bg-gray-700 hover:border-cyan-400/50 text-cyan-300">
          <Pencil className="h-3 w-3" />
          Editar Layout
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[360px] bg-gray-900 border-gray-700 text-white overflow-y-auto">
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
                'flex flex-col gap-2.5 p-3 rounded-lg border border-gray-700 bg-gray-800/50 transition-all',
                'hover:border-cyan-500/30 cursor-grab active:cursor-grabbing',
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
                <div className="ml-8 space-y-2">
                  {/* Column span */}
                  <div className="flex items-center gap-2">
                    <Columns className="h-3 w-3 text-gray-500" />
                    <span className="text-[10px] text-gray-500 w-12">Largura:</span>
                    <div className="flex gap-1">
                      {COL_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setBlockCols(block.id, opt.value)}
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded border transition-all',
                            block.cols === opt.value
                              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                              : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-gray-200'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Min height */}
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-3 w-3 text-gray-500" />
                    <span className="text-[10px] text-gray-500 w-12">Altura:</span>
                    <Input
                      type="number"
                      value={block.minHeight || ''}
                      onChange={e => setBlockMinHeight(block.id, Number(e.target.value) || 0)}
                      placeholder="Auto"
                      className="h-6 w-20 text-[10px] bg-gray-800 border-gray-600 text-white"
                    />
                    <span className="text-[9px] text-gray-500">px (0=auto)</span>
                  </div>
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
