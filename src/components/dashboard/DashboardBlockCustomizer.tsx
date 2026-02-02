import { useDashboardLayout, BlockType } from '@/contexts/DashboardLayoutContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Settings2, RotateCcw, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DashboardBlockCustomizer = () => {
  const { blocks, toggleBlock, reorderBlocks, resetLayout, isCustomizing, setIsCustomizing } = useDashboardLayout();

  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (fromIndex !== toIndex) {
      reorderBlocks(fromIndex, toIndex);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <Sheet open={isCustomizing} onOpenChange={setIsCustomizing}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Personalizar
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px]">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Personalizar Dashboard</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetLayout}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Resetar
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          <p className="text-sm text-muted-foreground mb-4">
            Arraste para reordenar e ative/desative os blocos que deseja visualizar.
          </p>

          {sortedBlocks.map((block, index) => (
            <div
              key={block.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragOver={handleDragOver}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border bg-card transition-all",
                "hover:border-primary/30 cursor-grab active:cursor-grabbing",
                !block.enabled && "opacity-50"
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 text-sm font-medium">{block.label}</span>
              <Switch
                checked={block.enabled}
                onCheckedChange={() => toggleBlock(block.id)}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            As configurações são salvas automaticamente e persistem entre sessões.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
