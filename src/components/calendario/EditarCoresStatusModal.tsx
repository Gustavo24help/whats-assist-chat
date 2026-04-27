import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  CORES_PADRAO_STATUS,
  carregarCoresStatus,
  salvarCoresStatus,
  type CoresStatusMap,
} from "@/lib/calendarioStatusCores";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusList: { value: string; label: string }[];
}

export function EditarCoresStatusModal({ open, onOpenChange, statusList }: Props) {
  const [cores, setCores] = useState<CoresStatusMap>(() => carregarCoresStatus());

  useEffect(() => {
    if (open) setCores(carregarCoresStatus());
  }, [open]);

  const updateCor = (status: string, cor: string) => {
    setCores((prev) => ({ ...prev, [status]: cor }));
  };

  const resetOne = (status: string) => {
    setCores((prev) => ({ ...prev, [status]: CORES_PADRAO_STATUS[status] || "#888888" }));
  };

  const handleSalvar = () => {
    salvarCoresStatus(cores);
    toast.success("Cores atualizadas");
    onOpenChange(false);
  };

  const handleResetAll = () => {
    setCores({ ...CORES_PADRAO_STATUS });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar cores dos status</DialogTitle>
          <DialogDescription>
            Personalize a cor de exibição de cada status no calendário. As preferências ficam salvas neste navegador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {statusList.map((s) => {
            const cor = cores[s.value] || CORES_PADRAO_STATUS[s.value] || "#888888";
            const padrao = CORES_PADRAO_STATUS[s.value];
            const alterada = padrao && padrao.toLowerCase() !== cor.toLowerCase();
            return (
              <div key={s.value} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded border" style={{ backgroundColor: cor }} />
                <Label className="flex-1 text-sm">{s.label}</Label>
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => updateCor(s.value, e.target.value)}
                  className="h-8 w-12 rounded border bg-transparent cursor-pointer"
                  aria-label={`Cor para ${s.label}`}
                />
                <input
                  type="text"
                  value={cor}
                  onChange={(e) => updateCor(s.value, e.target.value)}
                  className="h-8 w-20 rounded border px-2 text-xs font-mono bg-background"
                  maxLength={7}
                />
                {alterada && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => resetOne(s.value)}
                    title="Restaurar cor padrão"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={handleResetAll}>
            Restaurar padrão
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSalvar}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
