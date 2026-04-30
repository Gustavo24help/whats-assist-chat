import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  STATUS_FICHA_CORES_HEX_PADRAO,
  carregarStatusFichaCores,
  salvarStatusFichaCores,
  resetarStatusFichaCores,
  type StatusFichaCoresMap,
} from "@/lib/statusFichaCores";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lista opcional adicional de status (ex.: vindos do banco) para incluir no editor */
  extraStatuses?: string[];
}

export function EditarCoresStatusFichaModal({ open, onOpenChange, extraStatuses = [] }: Props) {
  const [cores, setCores] = useState<StatusFichaCoresMap>(() => carregarStatusFichaCores());

  useEffect(() => {
    if (open) setCores(carregarStatusFichaCores());
  }, [open]);

  const allStatuses = Array.from(
    new Set([...Object.keys(STATUS_FICHA_CORES_HEX_PADRAO), ...extraStatuses.filter(Boolean)])
  );

  const updateCor = (status: string, cor: string) => {
    setCores((prev) => ({ ...prev, [status]: cor }));
  };

  const resetOne = (status: string) => {
    setCores((prev) => ({ ...prev, [status]: STATUS_FICHA_CORES_HEX_PADRAO[status] || "#9ca3af" }));
  };

  const handleSalvar = () => {
    salvarStatusFichaCores(cores);
    toast.success("Cores atualizadas");
    onOpenChange(false);
  };

  const handleResetAll = () => {
    resetarStatusFichaCores();
    setCores({ ...STATUS_FICHA_CORES_HEX_PADRAO });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar cores dos status</DialogTitle>
          <DialogDescription>
            Personalize a cor de cada status exibida nos chats. As preferências ficam salvas neste navegador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {allStatuses.map((status) => {
            const cor = cores[status] || STATUS_FICHA_CORES_HEX_PADRAO[status] || "#9ca3af";
            const padrao = STATUS_FICHA_CORES_HEX_PADRAO[status];
            const alterada = padrao && padrao.toLowerCase() !== cor.toLowerCase();
            return (
              <div key={status} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border shrink-0" style={{ backgroundColor: cor }} />
                <Label className="flex-1 text-sm truncate">{status}</Label>
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => updateCor(status, e.target.value)}
                  className="h-7 w-10 rounded border bg-transparent cursor-pointer"
                  aria-label={`Cor para ${status}`}
                />
                <input
                  type="text"
                  value={cor}
                  onChange={(e) => updateCor(status, e.target.value)}
                  className="h-7 w-20 rounded border px-2 text-xs font-mono bg-background"
                  maxLength={7}
                />
                {alterada ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => resetOne(status)}
                    title="Restaurar cor padrão"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                ) : (
                  <div className="w-6" />
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
