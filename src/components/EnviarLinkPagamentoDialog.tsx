import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Send, ExternalLink, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface EnviarLinkPagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentUrl: string;
  fichaId: string;
  nomeCliente: string;
  telefoneCliente: string;
  valorTotal: number;
  onEnviado?: () => void;
}

const formatMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export const EnviarLinkPagamentoDialog = ({
  open,
  onOpenChange,
  paymentUrl,
  fichaId,
  nomeCliente,
  telefoneCliente,
  valorTotal,
}: EnviarLinkPagamentoDialogProps) => {
  const defaultMsg = `Olá${nomeCliente ? `, ${nomeCliente}` : ''}! 😊\n\nSegue o link para pagamento do serviço ${fichaId} no valor de ${formatMoeda(valorTotal)}:\n\n${paymentUrl}\n\nQualquer dúvida estou à disposição!`;

  const [mensagem, setMensagem] = useState(defaultMsg);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [foraJanela, setForaJanela] = useState(false);

  const copiarLink = () => {
    navigator.clipboard.writeText(paymentUrl);
    toast.success("Link copiado!");
  };

  const copiarMensagem = () => {
    navigator.clipboard.writeText(mensagem);
    toast.success("Mensagem copiada!");
  };

  const enviarMensagem = async () => {
    if (!telefoneCliente || !mensagem.trim()) return;

    setEnviando(true);
    setForaJanela(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: telefoneCliente,
          message: mensagem,
          userId: user?.id,
        },
      });

      if (error) throw error;

      if (!data.success) {
        if (data.error === "FORA_JANELA_24H") {
          setForaJanela(true);
          toast.warning("Fora da janela de 24h. Copie a mensagem e envie manualmente ou use um template.");
          return;
        }
        throw new Error(data.error || "Erro ao enviar");
      }

      setEnviado(true);
      toast.success("Link de pagamento enviado ao cliente!");
    } catch (err: any) {
      console.error("Erro ao enviar link:", err);
      toast.error(`Erro ao enviar: ${err.message || "Erro desconhecido"}`);
    } finally {
      setEnviando(false);
    }
  };

  // Reset state when dialog closes
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setEnviado(false);
      setForaJanela(false);
      setMensagem(defaultMsg);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Enviar Link de Pagamento
          </DialogTitle>
          <DialogDescription>
            Link gerado com sucesso. Revise a mensagem e envie ao cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Link info */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Link Asaas</div>
              <Badge variant="secondary" className="text-[10px]">{fichaId}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline truncate flex-1"
              >
                {paymentUrl}
              </a>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={copiarLink}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" asChild>
                <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
            <div className="text-sm font-semibold">{formatMoeda(valorTotal)}</div>
          </div>

          {/* Fora da janela warning */}
          {foraJanela && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Fora da janela de 24h.</strong> Copie a mensagem abaixo e envie manualmente pelo WhatsApp, ou use um template aprovado.
              </div>
            </div>
          )}

          {/* Enviado com sucesso */}
          {enviado && (
            <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-900/20 p-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-sm text-green-800 dark:text-green-200 font-medium">Mensagem enviada com sucesso!</span>
            </div>
          )}

          {/* Mensagem editável */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mensagem para o cliente</label>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={6}
              className="text-sm resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={copiarMensagem}
            >
              <Copy className="h-4 w-4" />
              Copiar
            </Button>
            <Button
              className="flex-1 gap-1.5"
              disabled={enviando || enviado}
              onClick={enviarMensagem}
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : enviado ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {enviando ? "Enviando..." : enviado ? "Enviado" : "Enviar WhatsApp"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
