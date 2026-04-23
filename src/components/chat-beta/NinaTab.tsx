import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Copy, Check, AlertCircle, RefreshCw, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NinaTabProps {
  fichaId: string | null;
  coaching: {
    perfil: string;
    conversaoMeta: number;
    proximoPassoLabel: string;
    sugestaoMensagem: string;
    prioridade: "maxima" | "normal";
  } | null;
}

interface ResumoData {
  resumo: string;
  periodo?: { inicio: string; fim: string };
  total_mensagens?: number;
}

export const NinaTab = ({ fichaId, coaching }: NinaTabProps) => {
  const [loading, setLoading] = useState(false);
  const [resumoData, setResumoData] = useState<ResumoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedResumo, setCopiedResumo] = useState(false);
  const [copiedSugestao, setCopiedSugestao] = useState(false);

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

  const copiarResumo = async () => {
    if (!resumoData?.resumo) return;
    try {
      await navigator.clipboard.writeText(resumoData.resumo);
      setCopiedResumo(true);
      toast.success("Resumo copiado!");
      setTimeout(() => setCopiedResumo(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const copiarSugestao = async () => {
    if (!coaching?.sugestaoMensagem) return;
    try {
      await navigator.clipboard.writeText(coaching.sugestaoMensagem);
      setCopiedSugestao(true);
      toast.success("Sugestão copiada!");
      setTimeout(() => setCopiedSugestao(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

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
      {/* Identificação Nina */}
      <div className="flex items-center gap-2 px-1">
        <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Nina</p>
          <p className="text-[9px] text-muted-foreground leading-tight">IA interna da 24help</p>
        </div>
      </div>

      {/* ── BLOCO: Sugestão de mensagem (coaching) ── */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/40 px-2.5 py-1.5 flex items-center gap-1.5">
          <Lightbulb className="h-3 w-3 text-primary" />
          <p className="text-[11px] font-semibold">Sugestão de mensagem</p>
        </div>
        <div className="p-2.5">
          {coaching ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  {coaching.perfil}
                </Badge>
                <span className="text-[9px] text-muted-foreground">
                  Meta {(coaching.conversaoMeta * 100).toFixed(0)}% · {coaching.proximoPassoLabel}
                </span>
                {coaching.prioridade === "maxima" && (
                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                    🔴 PRIORIDADE
                  </Badge>
                )}
              </div>
              <div className="bg-muted/40 rounded p-2">
                <p className="text-[11px] text-foreground italic leading-relaxed">
                  &ldquo;{coaching.sugestaoMensagem}&rdquo;
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-[10px] w-full" onClick={copiarSugestao}>
                {copiedSugestao ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar sugestão
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center py-3">
              <Lightbulb className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">Sem sugestões no momento</p>
            </div>
          )}
        </div>
      </div>

      {/* ── BLOCO: Resumir conversa ── */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/40 px-2.5 py-1.5 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-primary" />
          <p className="text-[11px] font-semibold">Resumir conversa</p>
        </div>
        <div className="p-2.5">
          {!fichaId ? (
            <p className="text-[10px] text-muted-foreground text-center py-2">
              Selecione uma ficha para gerar o resumo.
            </p>
          ) : !resumoData && !loading && !error ? (
            <Button size="sm" onClick={gerarResumo} className="w-full h-8 text-[11px]">
              <Sparkles className="h-3 w-3 mr-1.5" />
              Gerar resumo
            </Button>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-4 gap-1.5">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-[10px] text-muted-foreground">Analisando conversa...</p>
            </div>
          ) : error ? (
            <div className="text-center py-2">
              <AlertCircle className="h-5 w-5 mx-auto mb-1.5 text-destructive" />
              <p className="text-[10px] mb-2">{error}</p>
              <Button size="sm" variant="outline" onClick={gerarResumo} className="h-7 text-[10px] w-full">
                <RefreshCw className="h-3 w-3 mr-1" />
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {resumoData?.periodo && (
                <div className="text-[9px] text-muted-foreground bg-muted/40 rounded px-1.5 py-1">
                  📅 {formatarData(resumoData.periodo.inicio)} → {formatarData(resumoData.periodo.fim)}
                  {resumoData.total_mensagens != null && <> · {resumoData.total_mensagens} msgs</>}
                </div>
              )}
              <ScrollArea className="h-[280px] rounded border bg-card p-2">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {resumoData!.resumo.split("\n").map((line, i) => {
                    if (line.startsWith("## ")) {
                      return (
                        <h3 key={i} className="text-xs font-semibold mt-2 mb-1 first:mt-0 text-foreground">
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
                <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px]" onClick={gerarResumo}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Atualizar
                </Button>
                <Button size="sm" className="flex-1 h-7 text-[10px]" onClick={copiarResumo}>
                  {copiedResumo ? (
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
          )}
        </div>
      </div>
    </div>
  );
};
