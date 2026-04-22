import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";

interface AprovacaoOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  orcamento: {
    id: string;
    valor_total: number | null;
    tempo_servico: string | null;
    observacoes: string | null;
  };
  fichaNome: string;
  clienteTelefone: string;
}

export const AprovacaoOrcamentoDialog = ({
  open,
  onOpenChange,
  onConfirm,
  orcamento,
  fichaNome,
  clienteTelefone,
}: AprovacaoOrcamentoDialogProps) => {
  const [enviarMensagem, setEnviarMensagem] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mensagem, setMensagem] = useState(
    `Segue abaixo o orçamento referente ao serviço solicitado:

📋 Ficha: ${fichaNome}
💰 Valor: ${formatBRL(orcamento.valor_total)}
⏰ Tempo: ${orcamento.tempo_servico || "A definir"}
📌 Observações: ${orcamento.observacoes || "Nenhuma"}

👉 Esse valor já inclui deslocamento, mão de obra e garantia de 30 dias sobre o serviço realizado.
💳 Facilitamos o pagamento! Parcelamos para você, caso prefira.

Aguardamos sua confirmação para darmos sequência 😊.`
  );

  const handleConfirm = async () => {
    if (isSubmitting) return; // Proteção contra cliques duplos
    setIsSubmitting(true);
    
    try {
      if (enviarMensagem && mensagem.trim()) {
        try {
          const { data, error } = await supabase.functions.invoke("send-whatsapp", {
            body: { to: clienteTelefone, message: mensagem },
          });

          if (error) {
            console.error("Erro ao enviar WhatsApp:", error);
            toast.error("Erro ao enviar mensagem pelo WhatsApp");
          } else if (data?.success === false) {
            console.error("Erro ao enviar WhatsApp:", data);
            toast.error(data?.message || "Erro ao enviar mensagem pelo WhatsApp");
          } else {
            toast.success("Mensagem enviada ao cliente!");
          }
        } catch (error) {
          console.error("Erro ao enviar WhatsApp:", error);
          toast.error("Erro ao enviar mensagem pelo WhatsApp");
        }
      }

      onConfirm();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aprovar Orçamento</DialogTitle>
          <DialogDescription>
            Deseja enviar uma mensagem ao cliente informando a aprovação do orçamento?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enviar_mensagem"
              checked={enviarMensagem}
              onChange={(e) => setEnviarMensagem(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="enviar_mensagem" className="text-sm cursor-pointer">
              Enviar mensagem ao cliente
            </Label>
          </div>

          {enviarMensagem && (
            <div className="space-y-2">
              <Label htmlFor="mensagem">Mensagem (editável)</Label>
              <Textarea
                id="mensagem"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Aprovando..." : enviarMensagem ? "Aprovar e Enviar" : "Aprovar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
