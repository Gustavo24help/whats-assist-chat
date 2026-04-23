import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Copy, Check, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ResumoIATabProps {
  fichaId: string | null;
}

interface ResumoData {
  resumo: string;
  periodo?: { inicio: string; fim: string };
  total_mensagens?: number;
}

export const ResumoIATab = ({ fichaId }: ResumoIATabProps) => {
  const [loading, setLoading] = useState(false);
  const [resumoData, setResumoData] = useState<ResumoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const gerarResumo = async () => {
    if (!fichaId) {
      toast.error("Selecione uma ficha primeiro");
      return;
    }
    setLoading(true);
    setError(null);
    setResumoData(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("summarize-conversation", {
        body: { ficha_id: fichaId },
      });

      if (fnError) throw new Error(fnError.message || "Erro ao gerar resumo");
      if (data?.error) throw new Error(data.error);

      if (!data?.resumo) {
        setError(data?.mensagem || "Não há mensagens para resumir.");
        return;
      }
      setResumoData(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
      toast.error("Erro ao gerar resumo: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const copiar = async () => {
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

  if (!fichaId) {
    return (
      <div className="text-center py-8">
        <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Selecione uma ficha para gerar o resumo.</p>
      </div>
    );
  }

  // Estado inicial — botão para gerar
  if (!resumoData && !loading && !error) {
    return (
      <div className="space-y-3">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
          <Sparkles className="h-6 w-6 mx-auto mb-2 text-primary" />
          <p className="text-xs font-semibold mb-1">Resumo da Conversa por IA</p>
          <p className="text-[10px] text-muted-foreground mb-3">
            Gere um resumo automático da conversa com o cliente para facilitar o atendimento ou transferência.
          </p>
          <Button size="sm" onClick={gerarResumo} className="w-full">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Gerar Resumo
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Analisando conversa...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
          <AlertCircle className="h-6 w-6 mx-auto mb-2 text-destructive" />
          <p className="text-xs font-medium mb-2">{error}</p>
          <Button size="sm" variant="outline" onClick={gerarResumo} className="w-full">
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  // Resumo gerado
  const formatarData = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-3">
      {resumoData?.periodo && (
        <div className="text-[10px] text-muted-foreground bg-muted/40 rounded p-2">
          📅 {formatarData(resumoData.periodo.inicio)} → {formatarData(resumoData.periodo.fim)}
          {resumoData.total_mensagens != null && (
            <> · {resumoData.total_mensagens} msgs</>
          )}
        </div>
      )}

      <ScrollArea className="h-[360px] rounded-lg border bg-card p-3">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {resumoData!.resumo.split("\n").map((line, i) => {
            if (line.startsWith("## ")) {
              return (
                <h3 key={i} className="text-xs font-semibold mt-3 mb-1 first:mt-0 text-foreground">
                  {line.replace("## ", "")}
                </h3>
              );
            }
            if (line.trim()) {
              return (
                <p key={i} className="text-[11px] text-foreground/90 mb-1 leading-relaxed">
                  {line}
                </p>
              );
            }
            return null;
          })}
        </div>
      </ScrollArea>

      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="flex-1 h-8 text-[11px]" onClick={gerarResumo}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Atualizar
        </Button>
        <Button size="sm" className="flex-1 h-8 text-[11px]" onClick={copiar}>
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copiar
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
