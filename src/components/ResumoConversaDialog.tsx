import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Loader2, Copy, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ResumoConversaDialogProps {
  fichaId: string;
  fichaName?: string;
  trigger?: React.ReactNode;
}

interface ResumoData {
  resumo: string;
  periodo: {
    inicio: string;
    fim: string;
  };
  total_mensagens: number;
  ficha: {
    id: string;
    nome: string;
    status: string;
  };
}

export const ResumoConversaDialog = ({ fichaId, fichaName, trigger }: ResumoConversaDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resumoData, setResumoData] = useState<ResumoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const gerarResumo = async () => {
    setLoading(true);
    setError(null);
    setResumoData(null);

    try {
      console.log("🤖 Gerando resumo para ficha:", fichaId);

      const { data, error: fnError } = await supabase.functions.invoke("summarize-conversation", {
        body: { ficha_id: fichaId },
      });

      if (fnError) {
        console.error("❌ Erro na function:", fnError);
        throw new Error(fnError.message || "Erro ao gerar resumo");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.resumo) {
        setError(data.mensagem || "Não há mensagens para resumir.");
        return;
      }

      console.log("✅ Resumo gerado:", data);
      setResumoData(data);
    } catch (err) {
      console.error("❌ Erro:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMessage);
      toast.error("Erro ao gerar resumo: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !resumoData && !loading) {
      gerarResumo();
    }
  };

  const copiarResumo = async () => {
    if (!resumoData?.resumo) return;

    try {
      await navigator.clipboard.writeText(resumoData.resumo);
      setCopied(true);
      toast.success("Resumo copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const formatarData = (dataISO: string) => {
    return new Date(dataISO).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      {trigger ? (
        <div onClick={() => handleOpen(true)}>{trigger}</div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => handleOpen(true)}
        >
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Resumir</span>
        </Button>
      )}

      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Resumo da Conversa
            {fichaName && (
              <span className="text-sm font-normal text-muted-foreground">
                — {fichaName}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Resumo gerado por IA para facilitar a transferência de atendimento
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando conversa...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">{error}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tente novamente ou verifique se há mensagens no período.
              </p>
            </div>
            <Button variant="outline" onClick={gerarResumo} className="mt-2">
              Tentar Novamente
            </Button>
          </div>
        )}

        {resumoData && !loading && (
          <div className="space-y-4">
            {/* Metadados */}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <span className="flex items-center gap-1">
                📅 {formatarData(resumoData.periodo.inicio)} até {formatarData(resumoData.periodo.fim)}
              </span>
              <span className="text-muted-foreground/50">•</span>
              <span>{resumoData.total_mensagens} mensagens analisadas</span>
            </div>

            {/* Resumo */}
            <ScrollArea className="h-[400px] rounded-lg border bg-card p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {resumoData.resumo.split("\n").map((line, index) => {
                  // Detectar headers (linhas que começam com ##)
                  if (line.startsWith("## ")) {
                    return (
                      <h3
                        key={index}
                        className="text-base font-semibold mt-4 mb-2 first:mt-0 text-foreground"
                      >
                        {line.replace("## ", "")}
                      </h3>
                    );
                  }
                  // Linhas normais
                  if (line.trim()) {
                    return (
                      <p key={index} className="text-sm text-foreground/90 mb-1.5 leading-relaxed">
                        {line}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            </ScrollArea>

            {/* Ações */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={gerarResumo}>
                Atualizar Resumo
              </Button>
              <Button size="sm" onClick={copiarResumo} className="gap-1.5">
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
