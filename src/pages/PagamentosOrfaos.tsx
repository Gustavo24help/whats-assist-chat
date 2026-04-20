import { useEffect, useState, useCallback } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Search, Link as LinkIcon, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrfaoRow {
  id: string;
  created_at: string;
  detalhe: string | null;
  payment_id: string | null;
  status: string;
}

/**
 * Extrai valor e customer do texto "detalhe" (formato gerado pelo webhook).
 * Ex: "Payment pay_abc123 sem ficha. Trail: ... | customer=cus_x | link=Y | value=150.00"
 */
function parseDetalhe(detalhe: string | null): { valor?: string; customer?: string; link?: string; trail?: string } {
  if (!detalhe) return {};
  const val = detalhe.match(/value=([\d.]+)/);
  const cus = detalhe.match(/customer=([^\s|]+)/);
  const lnk = detalhe.match(/link=([^\s|]+)/);
  const trl = detalhe.match(/Trail:\s*([^|]+)/);
  return {
    valor: val?.[1],
    customer: cus?.[1] && cus[1] !== "undefined" ? cus[1] : undefined,
    link: lnk?.[1] && lnk[1] !== "undefined" ? lnk[1] : undefined,
    trail: trl?.[1]?.trim(),
  };
}

const PagamentosOrfaos = () => {
  const [orfaos, setOrfaos] = useState<OrfaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [vincularOpen, setVincularOpen] = useState<string | null>(null);
  const [fichaIdInput, setFichaIdInput] = useState("");
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("automation_audit")
      .select("id, created_at, detalhe, payment_id, status")
      .eq("etapa", "webhook_pagamento")
      .eq("status", "unidentified")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      toast.error("Erro ao carregar pagamentos órfãos: " + error.message);
    } else {
      setOrfaos(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const vincularFicha = async (orfaoId: string, paymentId: string | null) => {
    if (!fichaIdInput.trim()) {
      toast.error("Informe o ID da ficha");
      return;
    }
    if (!paymentId) {
      toast.error("Payment ID ausente no registro");
      return;
    }

    setProcessando(true);
    try {
      // 1) Verifica se a ficha existe
      const { data: ficha, error: fichaErr } = await supabase
        .from("fichas_de_servico")
        .select("id, pagamento_realizado, status, nome_cliente, valor_total, notas")
        .eq("id", fichaIdInput.trim())
        .maybeSingle();

      if (fichaErr) throw fichaErr;
      if (!ficha) {
        toast.error(`Ficha ${fichaIdInput.trim()} não encontrada`);
        setProcessando(false);
        return;
      }

      if (ficha.pagamento_realizado) {
        toast.warning(`Ficha ${ficha.id} já estava marcada como paga. Apenas arquivando o órfão.`);
      } else {
        const agora = new Date();
        const logEntry = `[${agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}] ✅ Pagamento vinculado MANUALMENTE a partir do painel de órfãos — Payment ID: ${paymentId}`;
        const novasNotas = ficha.notas ? `${ficha.notas}\n${logEntry}` : logEntry;

        const statusParaGarantia = ["Finalizado", "Em andamento", "Agendado"];
        const novoStatus = statusParaGarantia.includes(ficha.status as string) ? "Garantia" : ficha.status;

        const { error: updErr } = await supabase
          .from("fichas_de_servico")
          .update({
            pagamento_realizado: true,
            notas: novasNotas,
            status: novoStatus as any,
          })
          .eq("id", ficha.id);

        if (updErr) throw updErr;

        // Atualiza contas_receber se existir
        await supabase
          .from("contas_receber")
          .update({
            status: "pago",
            data_pagamento: agora.toISOString().split("T")[0],
            asaas_id: paymentId,
            asaas_status: "MANUAL_LINK",
          })
          .eq("ficha_id", ficha.id);

        // Atualiza transação financeira se existir
        await supabase
          .from("transacoes_financeiras")
          .update({
            status_pagamento_cliente: "pago",
            data_pagamento_realizada: agora.toISOString(),
          })
          .eq("ficha_id", ficha.id);
      }

      // 2) Marca o audit órfão como "success" (resolvido manualmente)
      await supabase.from("automation_audit").insert({
        ficha_id: ficha.id,
        etapa: "webhook_pagamento_manual_link",
        status: "success",
        detalhe: `Vinculação manual do payment ${paymentId} à ficha ${ficha.id} via painel de órfãos`,
        payment_id: paymentId,
      });

      toast.success(`Pagamento vinculado à ficha ${ficha.id}`);
      setVincularOpen(null);
      setFichaIdInput("");
      await carregar();
    } catch (e: any) {
      toast.error("Erro ao vincular: " + (e?.message || "desconhecido"));
    } finally {
      setProcessando(false);
    }
  };

  const arquivar = async (orfaoId: string, paymentId: string | null) => {
    if (!confirm("Arquivar este órfão? Use quando o pagamento já foi resolvido fora do sistema ou é um falso positivo.")) return;
    const { error } = await supabase.from("automation_audit").insert({
      ficha_id: "ARQUIVADO",
      etapa: "webhook_pagamento_manual_link",
      status: "success",
      detalhe: `Órfão ${orfaoId} arquivado manualmente sem vincular ficha`,
      payment_id: paymentId,
    });
    if (error) {
      toast.error("Erro ao arquivar: " + error.message);
    } else {
      toast.success("Arquivado");
      await carregar();
    }
  };

  return (
    <PageLayout>
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Pagamentos Órfãos
            </h1>
            <p className="text-xs text-muted-foreground">
              Pagamentos Asaas recebidos sem vínculo automático a uma ficha
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Logo />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 md:px-6 py-4 pb-6 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando...
          </div>
        )}

        {!loading && orfaos.length === 0 && (
          <Card className="p-8 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-2" />
            <p className="text-sm font-medium">Nenhum pagamento órfão pendente.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Todos os pagamentos recebidos foram vinculados automaticamente a uma ficha.
            </p>
          </Card>
        )}

        {!loading && orfaos.map((o) => {
          const parsed = parseDetalhe(o.detalhe);
          const isOpen = vincularOpen === o.id;
          return (
            <Card key={o.id} className="p-4 space-y-3 border-l-4 border-l-amber-400">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {o.payment_id || "sem payment_id"}
                    </Badge>
                    {parsed.valor && (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">
                        R$ {Number(parsed.valor).toFixed(2)}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(o.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {parsed.customer && (
                    <div className="text-xs text-muted-foreground">
                      <strong>Customer Asaas:</strong> {parsed.customer}
                    </div>
                  )}
                  {parsed.link && (
                    <div className="text-xs text-muted-foreground truncate max-w-xl">
                      <strong>Link:</strong> {parsed.link}
                    </div>
                  )}
                  {parsed.trail && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer select-none">Ver trail de identificação</summary>
                      <pre className="mt-1 whitespace-pre-wrap bg-muted/50 p-2 rounded text-[10px]">{parsed.trail}</pre>
                    </details>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      setVincularOpen(isOpen ? null : o.id);
                      setFichaIdInput("");
                    }}
                  >
                    <LinkIcon className="h-3.5 w-3.5 mr-1" />
                    {isOpen ? "Cancelar" : "Vincular à ficha"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => arquivar(o.id, o.payment_id)}>
                    Arquivar
                  </Button>
                </div>
              </div>

              {isOpen && (
                <div className="flex gap-2 items-center pt-2 border-t">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="ID da ficha (ex: FS1-250101 ou similar)"
                    value={fichaIdInput}
                    onChange={(e) => setFichaIdInput(e.target.value)}
                    className="h-9 text-sm"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    disabled={processando || !fichaIdInput.trim()}
                    onClick={() => vincularFicha(o.id, o.payment_id)}
                  >
                    {processando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar"}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </main>
    </PageLayout>
  );
};

export default PagamentosOrfaos;
