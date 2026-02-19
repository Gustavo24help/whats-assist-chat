import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Copy, Loader2, Star } from "lucide-react";

interface OperationalRatingPanelProps {
  clienteTelefone: string;
  fichaId: string;
  onCopyMessage?: (msg: string) => void;
}

interface AvaliacaoOperacional {
  id: string;
  ficha_id: string;
  telefone_cliente: string;
  nota: number | null;
  status: string;
  enviada_em: string;
  respondida_em: string | null;
}

export const OperationalRatingPanel = ({
  clienteTelefone,
  fichaId,
  onCopyMessage,
}: OperationalRatingPanelProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avaliacao, setAvaliacao] = useState<AvaliacaoOperacional | null>(null);
  const [copied, setCopied] = useState(false);

  const mensagemTemplate =
    "De 1 a 5, como você avalia o serviço realizado hoje? Responda apenas com um número (1,2,3,4 ou 5).";

  const fetchAvaliacao = useCallback(async () => {
    if (!fichaId) return;

    try {
      const { data, error } = await supabase
        .from("avaliacoes_operacionais")
        .select("*")
        .eq("ficha_id", fichaId)
        .maybeSingle();

      if (error) throw error;
      if (data) setAvaliacao(data as AvaliacaoOperacional);
    } catch (error) {
      console.error("Erro ao buscar avaliação operacional:", error);
    }
  }, [fichaId]);

  useEffect(() => {
    if (!fichaId) return;

    fetchAvaliacao();

    const channel = supabase
      .channel(`avaliacao-operacional-${fichaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "avaliacoes_operacionais",
          filter: `ficha_id=eq.${fichaId}`,
        },
        (payload) => {
          setAvaliacao(payload.new as AvaliacaoOperacional);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fichaId, fetchAvaliacao]);

  const iniciarAvaliacao = async () => {
    if (!fichaId || !clienteTelefone) return;

    setLoading(true);
    try {
      if (avaliacao) {
        toast.info("Avaliação já iniciada para esta ficha.");
        return;
      }

      const { data, error } = await supabase
        .from("avaliacoes_operacionais")
        .insert({
          ficha_id: fichaId,
          telefone_cliente: clienteTelefone,
          status: "pendente",
          enviada_em: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      setAvaliacao(data as AvaliacaoOperacional);
      toast.success("Avaliação operacional iniciada.");
    } catch (error) {
      console.error("Erro ao iniciar avaliação operacional:", error);
      toast.error("Erro ao iniciar avaliação.");
    } finally {
      setLoading(false);
    }
  };

  const copiarMensagem = async () => {
    try {
      await navigator.clipboard.writeText(mensagemTemplate);
      onCopyMessage?.(mensagemTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Mensagem copiada.");
    } catch (error) {
      toast.error("Não foi possível copiar a mensagem.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!fichaId}
          title={!fichaId ? "É necessário ter uma ficha de serviço" : "Avaliação operacional"}
        >
          <Star className="h-4 w-4" />
          <span className="hidden md:inline">Avaliação</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Avaliação Operacional (1-5)
          </DialogTitle>
          <DialogDescription>
            Opcional. Conta apenas a primeira resposta numérica válida (1 a 5).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {avaliacao?.nota ? (
            <Card className="border-emerald-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Avaliação respondida</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold">{avaliacao.nota}/5</div>
                <Badge variant="secondary">Primeira resposta registrada</Badge>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Mensagem para enviar ao cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <pre className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg font-sans">
                  {mensagemTemplate}
                </pre>
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={copiarMensagem}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copiar mensagem
                </Button>
              </CardContent>
            </Card>
          )}

          {avaliacao && !avaliacao.nota && (
            <Badge variant="outline" className="w-full justify-center py-1.5">
              Aguardando resposta do cliente
            </Badge>
          )}
        </div>

        <DialogFooter>
          {!avaliacao && (
            <Button onClick={iniciarAvaliacao} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Iniciar avaliação
            </Button>
          )}
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
