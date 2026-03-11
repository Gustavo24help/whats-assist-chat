import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TrocarPrestadorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fichaId: string;
  prestadorAtualId: string | null;
  onSuccess: () => void;
}

interface Prestador {
  cpf: string;
  nome: string;
}

export const TrocarPrestadorDialog = ({
  open,
  onOpenChange,
  fichaId,
  prestadorAtualId,
  onSuccess,
}: TrocarPrestadorDialogProps) => {
  const { user } = useAuth();
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [novoPrestadorId, setNovoPrestadorId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadPrestadores();
      setNovoPrestadorId("");
      setMotivo("");
    }
  }, [open]);

  const loadPrestadores = async () => {
    const { data } = await supabase
      .from("prestadores")
      .select("cpf, nome")
      .eq("ativo", true)
      .order("nome");
    setPrestadores(data || []);
  };

  const handleTroca = async () => {
    if (!novoPrestadorId) {
      toast.error("Selecione o novo prestador");
      return;
    }
    if (!motivo.trim()) {
      toast.error("Informe o motivo da troca");
      return;
    }

    setSaving(true);

    try {
      const prestadorAnteriorNome = prestadores.find(p => p.cpf === prestadorAtualId)?.nome || prestadorAtualId || "Nenhum";
      const novoPrestadorNome = prestadores.find(p => p.cpf === novoPrestadorId)?.nome || novoPrestadorId;

      // 1. Update the ficha
      const { error: updateError } = await supabase
        .from("fichas_de_servico")
        .update({
          prestador_id: novoPrestadorId,
          prestador_anterior_id: prestadorAtualId,
          motivo_troca_prestador: motivo.trim(),
          descricao: `[TROCA DE PRESTADOR] Motivo: ${motivo.trim()}\nAnterior: ${prestadorAnteriorNome}\n\n`,
        } as any)
        .eq("id", fichaId);

      if (updateError) throw updateError;

      // 2. Record in prestador_historico (for the previous prestador)
      if (prestadorAtualId) {
        await (supabase as any)
          .from("prestador_historico")
          .insert({
            prestador_cpf: prestadorAtualId,
            ficha_id: fichaId,
            tipo_evento: "troca_prestador",
            descricao: `Trocado por ${novoPrestadorNome} na ficha ${fichaId}. Motivo: ${motivo.trim()}`,
            criado_por: user?.id,
            dados_extras: {
              novo_prestador_cpf: novoPrestadorId,
              novo_prestador_nome: novoPrestadorNome,
              motivo: motivo.trim(),
            },
          });
      }

      toast.success("Prestador trocado com sucesso!");
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error("Erro ao trocar prestador: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Trocar Prestador</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">Prestador atual</Label>
            <p className="font-medium text-sm">
              {prestadorAtualId
                ? prestadores.find((p) => p.cpf === prestadorAtualId)?.nome || prestadorAtualId
                : "Nenhum"}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Novo Prestador</Label>
            <Select value={novoPrestadorId} onValueChange={setNovoPrestadorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o novo prestador" />
              </SelectTrigger>
              <SelectContent>
                {prestadores
                  .filter((p) => p.cpf !== prestadorAtualId)
                  .map((p) => (
                    <SelectItem key={p.cpf} value={p.cpf}>
                      {p.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Motivo da troca *</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da troca de prestador..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleTroca} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Confirmar Troca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
