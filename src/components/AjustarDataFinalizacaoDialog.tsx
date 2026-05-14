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

      // Preserve the time-of-day from the original finalization (avoid timezone shifts)
      const novaData = new Date(dataFinal);

      // 1. Get the canonical Finalizado entry used by finance: the FIRST finalization.
      // This keeps the 2-business-day payment calculation aligned with Contas a Pagar.
      const { data: historico } = await supabase
        .from("ficha_status_historico")
        .select("id, data_inicio")
        .eq("ficha_id", fichaId)
        .eq("status_novo", "Finalizado")
        .order("data_inicio", { ascending: true })
        .limit(1)
        .maybeSingle();

      const dataAnterior = historico?.data_inicio || new Date().toISOString();

      // Preserve hour/minute/second from original record so we don't shift times
      if (historico?.data_inicio) {
        const original = new Date(historico.data_inicio);
        novaData.setHours(original.getHours(), original.getMinutes(), original.getSeconds(), original.getMilliseconds());
      }
      const novaDataISO = novaData.toISOString();
      const novaDataPagamento = calcularDataPagamento(novaData);

      // 2. Update only the relevant ficha_status_historico entry
      if (historico) {
        await supabase
          .from("ficha_status_historico")
          .update({ data_inicio: novaDataISO } as any)
          .eq("id", historico.id);
      }

      // 3. Update derived finance dates. Preserve actual payment fields/status.
      const { data: transacoesAfetadas, error: txErr } = await supabase
        .from("transacoes_financeiras")
        .update({
          data_execucao: novaDataISO,
          data_pagamento_prevista: novaDataPagamento,
          atualizado_por: user.id,
        } as any)
        .eq("ficha_id", fichaId)
        .select("id");

      if (txErr) console.warn("[AjustarData] Erro ao atualizar transações:", txErr);

      // 4. Touch the ficha so caches/listeners refresh
      await supabase
        .from("fichas_de_servico")
        .update({ updated_at: new Date().toISOString() } as any)
        .eq("id", fichaId);

      // 5. Log the adjustment
      await supabase.from("ajustes_data_finalizacao" as any).insert({
        ficha_id: fichaId,
        data_anterior: dataAnterior,
        data_nova: novaDataISO,
        justificativa: justificativa.trim(),
        prestador_id: prestadorId || null,
        prestador_nome: prestadorNome || null,
        ajustado_por: user.id,
      });

      // 6. Notify external spreadsheet (Make.com) — non-blocking
      try {
        await supabase.functions.invoke("webhook-update-planilha", {
          body: {
            evento: "ajuste_data_finalizacao",
            ficha_id: fichaId,
            data_anterior: dataAnterior,
            data_nova: novaDataISO,
            data_pagamento_prevista: novaDataPagamento,
            prestador_id: prestadorId || null,
            prestador_nome: prestadorNome || null,
            justificativa: justificativa.trim(),
            transacoes_atualizadas: transacoesAfetadas?.length || 0,
          },
        });
      } catch (whErr) {
        console.warn("[AjustarData] Webhook planilha falhou (não-crítico):", whErr);
      }

      const msgExtra = transacoesAfetadas && transacoesAfetadas.length > 0
        ? ` (${transacoesAfetadas.length} transação(ões) atualizadas)`
        : " (sem transação financeira vinculada)";
      toast.success("Data de finalização ajustada com sucesso" + msgExtra);
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
