import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface AtribuicaoDescricaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operadorNome: string;
  onConfirm: (descricao: string) => void;
}

export const AtribuicaoDescricaoDialog = ({
  open,
  onOpenChange,
  operadorNome,
  onConfirm,
}: AtribuicaoDescricaoDialogProps) => {
  const [descricao, setDescricao] = useState("");

  const handleConfirm = () => {
    onConfirm(descricao.trim());
    setDescricao("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atribuir para {operadorNome}</DialogTitle>
          <DialogDescription>
            Adicione uma descrição opcional sobre o motivo da atribuição
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Cliente pediu retorno sobre orçamento..."
              rows={3}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => { onOpenChange(false); setDescricao(""); }}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Atribuir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
