import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { isBusinessDay } from "@/lib/businessDays2026";

const formatMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function addBusinessDays(date: Date | string, n: number): Date {
  const d = new Date(date);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) added++;
  }
  return d;
}

interface TrocaPrestadorPagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fichaId: string;
  valorTotalFicha: number;
  prestadorAnteriorId: string;
  prestadorAnteriorNome: string;
  novoPrestadorId: string;
  novoPrestadorNome: string;
  fichaData: any;
  onSuccess: () => void;
}

export const TrocaPrestadorPagamentoDialog = ({
  open, onOpenChange, fichaId, valorTotalFicha,
  prestadorAnteriorId, prestadorAnteriorNome,
  novoPrestadorId, novoPrestadorNome,
  fichaData, onSuccess,
}: TrocaPrestadorPagamentoDialogProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [valorAnterior, setValorAnterior] = useState("");
  const [justificativaAnterior, setJustificativaAnterior] = useState("");
  const [valorNovo, setValorNovo] = useState("");
  const [justificativaNovo, setJustificativaNovo] = useState("");
  const [saving, setSaving] = useState(false);

  const valorAnteriorNum = parseFloat(valorAnterior) || 0;
  const valorRestante = valorTotalFicha - valorAnteriorNum;
  const valorNovoNum = parseFloat(valorNovo) || 0;
  const diferenca = valorRestante - valorNovoNum;

  const handleStep1Next = () => {
    if (!justificativaAnterior.trim()) {
      toast.error("Informe a justificativa para o prestador anterior");
      return;
    }
    setValorNovo(valorRestante > 0 ? valorRestante.toFixed(2) : "0");
    setStep(2);
  };

  const handleConfirm = async () => {
    if (!justificativaNovo.trim()) {
      toast.error("Informe a justificativa para o prestador substituto");
      return;
    }

    setSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      // Buscar data real de finalização do histórico
      const { data: histFinalizado } = await supabase
        .from("ficha_status_historico")
        .select("data_inicio")
        .eq("ficha_id", fichaId)
        .eq("status_novo", "Finalizado" as any)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const dataExecucaoReal = histFinalizado?.data_inicio ? new Date(histFinalizado.data_inicio) : new Date();
      const dataPagPrevista = addBusinessDays(dataExecucaoReal, 2).toISOString();

      // Fetch prestador details
      const { data: prestAnterior } = await supabase
        .from("prestadores")
        .select("cpf, nome, cnpj, id_crm, chave_pix, nome_pix, banco")
        .eq("cpf", prestadorAnteriorId)
        .single();

      const { data: prestNovo } = await supabase
        .from("prestadores")
        .select("cpf, nome, cnpj, id_crm, chave_pix, nome_pix, banco")
        .eq("cpf", novoPrestadorId)
        .single();

      const { data: cliente } = await supabase
        .from("clientes")
        .select("nome")
        .eq("telefone", fichaData?.telefone_cliente)
        .single();

      const clienteNome = cliente?.nome || fichaData?.nome_cliente || fichaData?.telefone_cliente || "Cliente";

      const baseTransacao = {
        ficha_id: fichaId,
        cliente_id: fichaData?.telefone_cliente || "",
        cliente_nome: clienteNome,
        data_contratacao: fichaData?.horario_agendamento || null,
        data_execucao: now,
        data_pagamento_prevista: dataPagPrevista,
        valor_mao_obra: 0,
        valor_material: 0,
        taxa_visita: 0,
        adiantamento_cliente: 0,
        adiantamento_prestador: 0,
        valor_subtotal: 0,
        margem_percentual: 23,
        valor_cliente_calculado: 0,
        valor_cliente_final: valorTotalFicha,
        valor_lucro_bruto: 0,
        margem_operacional_real: 0,
        material_pago_24help: false,
        forma_pagamento_cliente: fichaData?.pagamento_tipo || null,
        categoria: null,
        criado_por: authUser?.id || null,
      };

      // 1. Transaction for previous prestador
      const { data: trans1, error: err1 } = await (supabase
        .from("transacoes_financeiras" as any)
        .insert({
          ...baseTransacao,
          prestador_id: prestadorAnteriorId,
          prestador_nome: prestAnterior?.nome || prestadorAnteriorNome,
          prestador_cpf: prestAnterior?.cpf || prestadorAnteriorId,
          prestador_cnpj: prestAnterior?.cnpj || null,
          prestador_codigo: prestAnterior?.id_crm || null,
          valor_a_pagar_prestador: valorAnteriorNum,
          tipo_troca: "prestador_trocado",
          justificativa_troca: justificativaAnterior.trim(),
        })
        .select("id")
        .single() as any);

      if (err1) throw err1;

      // 2. Transaction for new prestador
      const { data: trans2, error: err2 } = await (supabase
        .from("transacoes_financeiras" as any)
        .insert({
          ...baseTransacao,
          prestador_id: novoPrestadorId,
          prestador_nome: prestNovo?.nome || novoPrestadorNome,
          prestador_cpf: prestNovo?.cpf || novoPrestadorId,
          prestador_cnpj: prestNovo?.cnpj || null,
          prestador_codigo: prestNovo?.id_crm || null,
          valor_a_pagar_prestador: valorNovoNum,
          tipo_troca: "prestador_substituto",
          justificativa_troca: justificativaNovo.trim(),
        })
        .select("id")
        .single() as any);

      if (err2) throw err2;

      // 3. Link both transactions via ficha_troca_ref
      if (trans1?.id && trans2?.id) {
        await Promise.all([
          (supabase.from("transacoes_financeiras" as any)
            .update({ ficha_troca_ref: trans2.id } as any)
            .eq("id", trans1.id) as any),
          (supabase.from("transacoes_financeiras" as any)
            .update({ ficha_troca_ref: trans1.id } as any)
            .eq("id", trans2.id) as any),
        ]);
      }

      // 4. Record in prestador_historico
      await (supabase as any).from("prestador_historico").insert([
        {
          prestador_cpf: prestadorAnteriorId,
          ficha_id: fichaId,
          tipo_evento: "pagamento_troca",
          descricao: `Pagamento dividido por troca: ${formatMoeda(valorAnteriorNum)} para ${prestadorAnteriorNome}`,
          criado_por: authUser?.id,
          dados_extras: {
            tipo: "prestador_trocado",
            valor: valorAnteriorNum,
            justificativa: justificativaAnterior.trim(),
            valor_total_ficha: valorTotalFicha,
            novo_prestador: novoPrestadorNome,
            transacao_id: trans1?.id,
          },
        },
        {
          prestador_cpf: novoPrestadorId,
          ficha_id: fichaId,
          tipo_evento: "pagamento_troca",
          descricao: `Pagamento dividido por troca: ${formatMoeda(valorNovoNum)} para ${novoPrestadorNome}`,
          criado_por: authUser?.id,
          dados_extras: {
            tipo: "prestador_substituto",
            valor: valorNovoNum,
            justificativa: justificativaNovo.trim(),
            valor_total_ficha: valorTotalFicha,
            prestador_anterior: prestadorAnteriorNome,
            transacao_id: trans2?.id,
          },
        },
      ]);

      toast.success("Pagamentos divididos criados com sucesso!");
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error("Erro ao criar pagamentos: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setValorAnterior("");
    setJustificativaAnterior("");
    setValorNovo("");
    setJustificativaNovo("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Divisão de Pagamento
            <Badge variant="outline" className="text-xs">{step}/2</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Reference info */}
          <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ficha</span>
              <span className="font-mono font-medium">{fichaId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor Total da Ficha</span>
              <span className="font-bold">{formatMoeda(valorTotalFicha)}</span>
            </div>
          </div>

          <Separator />

          {step === 1 ? (
            <>
              <div className="flex items-center gap-2">
                <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                  Prestador Anterior
                </Badge>
                <span className="font-medium text-sm">{prestadorAnteriorNome}</span>
              </div>

              <div className="space-y-2">
                <Label>Valor a pagar ao prestador anterior</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorAnterior}
                  onChange={(e) => setValorAnterior(e.target.value)}
                  placeholder="0.00"
                />
                {valorAnteriorNum > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Restante para o substituto: {formatMoeda(valorRestante)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Justificativa *</Label>
                <Textarea
                  value={justificativaAnterior}
                  onChange={(e) => setJustificativaAnterior(e.target.value)}
                  placeholder="Ex: Prestador realizou parte do serviço antes da troca..."
                  rows={3}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  Prestador Substituto
                </Badge>
                <span className="font-medium text-sm">{novoPrestadorNome}</span>
              </div>

              <div className="rounded-lg border bg-muted/30 p-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Pago ao anterior ({prestadorAnteriorNome})</span>
                  <span className="font-medium">{formatMoeda(valorAnteriorNum)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Valor restante</span>
                  <span>{formatMoeda(valorRestante)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Valor a pagar ao prestador substituto</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorNovo}
                  onChange={(e) => setValorNovo(e.target.value)}
                  placeholder="0.00"
                />

                {valorNovoNum > 0 && diferenca < 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Valor excede o restante em {formatMoeda(Math.abs(diferenca))}
                  </div>
                )}
                {valorNovoNum > 0 && diferenca > 0.01 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {formatMoeda(diferenca)} não alocado
                  </div>
                )}
                {valorNovoNum > 0 && Math.abs(diferenca) <= 0.01 && (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Valor total alocado corretamente
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Justificativa *</Label>
                <Textarea
                  value={justificativaNovo}
                  onChange={(e) => setJustificativaNovo(e.target.value)}
                  placeholder="Ex: Prestador substituto assumiu o serviço completo..."
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleStep1Next}>Próximo →</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>← Voltar</Button>
              <Button onClick={handleConfirm} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Confirmar Pagamentos
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
