import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export const NovoAdiantamentoDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { toast } = useToast();
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [prestadorId, setPrestadorId] = useState("");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fichaId, setFichaId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from("prestadores").select("cpf, nome").order("nome").then(({ data }) => {
        setPrestadores(data || []);
      });
    }
  }, [open]);

  const handleSave = async () => {
    if (!prestadorId || !valor) {
      toast({ title: "Preencha prestador e valor", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("adiantamentos").insert({
        prestador_id: prestadorId,
        valor: parseFloat(valor),
        motivo: motivo || null,
        ficha_id: fichaId || null,
        criado_por: user?.id || null,
        status: "pendente",
      } as any);

      if (error) throw error;

      toast({ title: "✅ Adiantamento criado com sucesso!" });
      setPrestadorId("");
      setValor("");
      setMotivo("");
      setFichaId("");
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast({ title: "Erro ao criar adiantamento", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Adiantamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Prestador *</Label>
            <Select value={prestadorId} onValueChange={setPrestadorId}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {prestadores.map((p) => (
                  <SelectItem key={p.cpf} value={p.cpf}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor (R$) *</Label>
            <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label>Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: Material urgente" />
          </div>
          <div>
            <Label>Ficha (opcional)</Label>
            <Input value={fichaId} onChange={(e) => setFichaId(e.target.value)} placeholder="ID da ficha" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Criar Adiantamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
