import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { isBusinessDay } from "@/lib/businessDays2026";
import { toast } from "sonner";

interface AjustarDataFinalizacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fichaId: string;
  prestadorNome?: string | null;
  prestadorId?: string | null;
  onAjustado?: () => void;
}

function calcularDataPagamento(dataBase: Date): string {
  const data = new Date(dataBase);
  let diasAdicionados = 0;
  while (diasAdicionados < 2) {
    data.setDate(data.getDate() + 1);
    if (isBusinessDay(data)) {
      diasAdicionados++;
    }
  }
  return data.toISOString();
}

export function AjustarDataFinalizacaoDialog({
  open,
  onOpenChange,
  fichaId,
  prestadorNome,
  prestadorId,
  onAjustado,
}: AjustarDataFinalizacaoDialogProps) {
  const [dataFinal, setDataFinal] = useState<Date>();
  const [justificativa, setJustificativa] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!dataFinal || !justificativa.trim()) {
      toast.error("Preencha a data e a justificativa");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Get current finalization date from ficha_status_historico
      const { data: historico } = await supabase
        .from("ficha_status_historico")
        .select("id, data_inicio")
        .eq("ficha_id", fichaId)
        .eq("status_novo", "Finalizado")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const dataAnterior = historico?.data_inicio || new Date().toISOString();
      const novaDataISO = dataFinal.toISOString();
      const novaDataPagamento = calcularDataPagamento(dataFinal);

      // 2. Update ficha_status_historico
      if (historico) {
        await supabase
          .from("ficha_status_historico")
          .update({ data_inicio: novaDataISO } as any)
          .eq("id", historico.id);
      }

      // 3. Update transacoes_financeiras
      await supabase
        .from("transacoes_financeiras")
        .update({
          data_execucao: novaDataISO,
          data_pagamento_prevista: novaDataPagamento,
        } as any)
        .eq("ficha_id", fichaId);

      // 4. Log the adjustment
      await supabase.from("ajustes_data_finalizacao" as any).insert({
        ficha_id: fichaId,
        data_anterior: dataAnterior,
        data_nova: novaDataISO,
        justificativa: justificativa.trim(),
        prestador_id: prestadorId || null,
        prestador_nome: prestadorNome || null,
        ajustado_por: user.id,
      });

      toast.success("Data de finalização ajustada com sucesso");
      setDataFinal(undefined);
      setJustificativa("");
      onOpenChange(false);
      onAjustado?.();
    } catch (err: any) {
      console.error("Erro ao ajustar data:", err);
      toast.error("Erro ao ajustar data de finalização");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar Data de Finalização</DialogTitle>
          <DialogDescription>
            Altere a data em que o serviço foi realmente finalizado. Isso recalculará a data de pagamento prevista.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {prestadorNome && (
            <div>
              <Label className="text-muted-foreground text-xs">Prestador</Label>
              <p className="text-sm font-medium">{prestadorNome}</p>
            </div>
          )}

          <div>
            <Label>Data real de finalização *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !dataFinal && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFinal ? format(dataFinal, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataFinal}
                  onSelect={setDataFinal}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {dataFinal && (
              <p className="text-xs text-muted-foreground mt-1">
                Nova data de pagamento prevista: {format(new Date(calcularDataPagamento(dataFinal)), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            )}
          </div>

          <div>
            <Label>Justificativa *</Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Serviço finalizado no sábado, ajustando para sexta-feira..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !dataFinal || !justificativa.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
