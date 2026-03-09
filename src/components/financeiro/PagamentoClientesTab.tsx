import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Loader2,
  ExternalLink,
  Copy,
  Clock,
  Ban,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const formatMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const EXCLUDED_FICHAS = ["FS4-260127"];
const RELEVANT_STATUSES = [
  "Orçamento Aprovado / Agendamento" as const,
  "Agendado" as const,
  "Em andamento" as const,
  "Finalizado" as const,
];
const PAGE_SIZE = 20;

export const PagamentoClientesTab = () => {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState("pendentes");
  const [loading, setLoading] = useState(true);
  const [fichas, setFichas] = useState<any[]>([]);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<any>(null);

  // Histórico (pagamento_realizado = true)
  const [historico, setHistorico] = useState<any[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoPage, setHistoricoPage] = useState(0);
  const [historicoTotal, setHistoricoTotal] = useState(0);

  // Cancelados
  const [cancelados, setCancelados] = useState<any[]>([]);
  const [canceladosLoading, setCanceladosLoading] = useState(false);

  const fetchPendentes = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("fichas_de_servico")
        .select("id, nome_ficha, nome_cliente, telefone_cliente, status, valor_total, valor_mao_obra, valor_pecas, prestador_id, pagamento_realizado, pagamento_link, pagamento_tipo, created_at, updated_at")
        .eq("pagamento_realizado", false)
        .in("status", RELEVANT_STATUSES)
        .gt("valor_total", 0)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      const filtered = (data || []).filter(
        (f: any) => !EXCLUDED_FICHAS.includes(f.id)
      );
      setFichas(filtered);
    } catch (e: any) {
      console.error("Erro ao carregar pagamentos clientes:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistorico = useCallback(async () => {
    try {
      setHistoricoLoading(true);
      const { data, error, count } = await supabase
        .from("fichas_de_servico")
        .select("id, nome_ficha, nome_cliente, telefone_cliente, status, valor_total, prestador_id, pagamento_realizado, pagamento_link, updated_at", { count: "exact" })
        .eq("pagamento_realizado", true)
        .gt("valor_total", 0)
        .order("updated_at", { ascending: false })
        .range(historicoPage * PAGE_SIZE, (historicoPage + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      const filtered = (data || []).filter(
        (f: any) => !EXCLUDED_FICHAS.includes(f.id)
      );
      setHistorico(filtered);
      setHistoricoTotal(count || 0);
    } catch (e: any) {
      console.error("Erro ao carregar histórico:", e);
    } finally {
      setHistoricoLoading(false);
    }
  }, [historicoPage]);

  const fetchCancelados = useCallback(async () => {
    try {
      setCanceladosLoading(true);
      // Fichas perdidas que tinham valor > 0
      const { data, error } = await supabase
        .from("fichas_de_servico")
        .select("id, nome_ficha, nome_cliente, telefone_cliente, status, valor_total, prestador_id, pagamento_realizado, motivo_perda, updated_at")
        .eq("status", "Perdido")
        .eq("pagamento_realizado", false)
        .gt("valor_total", 0)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setCancelados((data || []).filter((f: any) => !EXCLUDED_FICHAS.includes(f.id)));
    } catch (e: any) {
      console.error("Erro ao carregar cancelados:", e);
    } finally {
      setCanceladosLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendentes();
  }, [fetchPendentes]);

  useEffect(() => {
    if (subTab === "historico") fetchHistorico();
    if (subTab === "cancelados") fetchCancelados();
  }, [subTab, fetchHistorico, fetchCancelados]);

  const marcarClientePagou = async (ficha: any) => {
    try {
      setMarkingPaid(ficha.id);
      const agora = new Date().toISOString();

      const { error } = await supabase
        .from("fichas_de_servico")
        .update({ pagamento_realizado: true } as any)
        .eq("id", ficha.id);

      if (error) throw error;

      // Also update transacao if exists
      await supabase
        .from("transacoes_financeiras")
        .update({
          status_pagamento_cliente: "pago",
          data_pagamento_realizada: agora,
        } as any)
        .eq("ficha_id", ficha.id);

      // Notify Make.com
      try {
        await supabase.functions.invoke("webhook-update-planilha", {
          body: {
            tipo: "pagamento_cliente",
            ficha_id: ficha.id,
            cliente_nome: ficha.nome_cliente || ficha.telefone_cliente,
            valor_cliente_final: ficha.valor_total,
            status: "pago",
            data_pagamento: agora,
          },
        });
      } catch (webhookErr) {
        console.error("Webhook planilha error (não bloqueante):", webhookErr);
      }

      toast({ title: "✅ Pagamento do cliente confirmado!" });
      fetchPendentes();
      if (subTab === "historico") fetchHistorico();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setMarkingPaid(null);
    }
  };

  const cancelarPagamento = async (ficha: any) => {
    try {
      setCancelando(ficha.id);
      setConfirmCancel(null);

      // Mark ficha as Perdido with motivo
      const { error } = await supabase
        .from("fichas_de_servico")
        .update({
          status: "Perdido",
          motivo_perda: "Pagamento cancelado/não realizado",
        } as any)
        .eq("id", ficha.id);

      if (error) throw error;

      toast({ title: "Pagamento marcado como cancelado" });
      fetchPendentes();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setCancelando(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: text });
  };

  const totalPendente = fichas.reduce((s, f) => s + (f.valor_total || 0), 0);
  const historicoTotalPages = Math.ceil(historicoTotal / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-3 overflow-x-auto">
        <Card className="min-w-[160px] bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 p-3 shrink-0">
          <div className="text-xs text-amber-600 dark:text-amber-400">Pendentes</div>
          <div className="text-2xl font-bold text-amber-900 dark:text-amber-300">{fichas.length}</div>
        </Card>
        <Card className="min-w-[160px] bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-3 shrink-0">
          <div className="text-xs text-blue-600 dark:text-blue-400">Valor Total Pendente</div>
          <div className="text-xl font-bold text-blue-900 dark:text-blue-300">{formatMoeda(totalPendente)}</div>
        </Card>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="mb-3">
          <TabsTrigger value="pendentes" className="gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" /> Pendentes
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" /> Pagos
          </TabsTrigger>
          <TabsTrigger value="cancelados" className="gap-1.5 text-xs">
            <Ban className="h-3.5 w-3.5" /> Cancelados
          </TabsTrigger>
        </TabsList>

        {/* Pendentes */}
        <TabsContent value="pendentes">
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando...</span>
              </div>
            ) : fichas.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
                <p className="text-muted-foreground">Todos os pagamentos de clientes estão em dia!</p>
              </div>
            ) : (
              fichas.map((f) => (
                <Card key={f.id} className="p-4 border-l-4 border-l-amber-500">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm">{f.nome_cliente || f.telefone_cliente}</h3>
                      <p className="text-xs text-muted-foreground">{f.telefone_cliente}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold text-primary">{formatMoeda(f.valor_total)}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    <Badge variant="secondary" className="text-xs">{f.id}</Badge>
                    <Badge variant="outline" className="text-xs">{f.status}</Badge>
                    {f.pagamento_tipo && (
                      <Badge variant="outline" className="text-xs">{f.pagamento_tipo}</Badge>
                    )}
                  </div>

                  {/* Payment link */}
                  {f.pagamento_link && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2 mb-3 text-xs flex items-center gap-2">
                      <ExternalLink className="h-3 w-3 text-blue-600 shrink-0" />
                      <a
                        href={f.pagamento_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate"
                      >
                        Link de pagamento
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={() => copyToClipboard(f.pagamento_link)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={cancelando === f.id}
                      onClick={() => setConfirmCancel(f)}
                    >
                      <Ban className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={markingPaid === f.id}
                      onClick={() => marcarClientePagou(f)}
                    >
                      {markingPaid === f.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                      )}
                      Cliente Pagou
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Histórico */}
        <TabsContent value="historico">
          <div className="space-y-3">
            {historicoLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : historico.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum pagamento realizado ainda
              </div>
            ) : (
              <>
                {historico.map((f) => (
                  <Card key={f.id} className="p-3 opacity-80">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm truncate">{f.nome_cliente || f.telefone_cliente}</h3>
                        <p className="text-xs text-muted-foreground">
                          {f.id} • {f.status}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-sm">{formatMoeda(f.valor_total)}</div>
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                          Pago
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
                {historicoTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">{historicoTotal} registros</span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={historicoPage === 0} onClick={() => setHistoricoPage((p) => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">{historicoPage + 1} / {historicoTotalPages}</span>
                      <Button variant="outline" size="sm" disabled={historicoPage >= historicoTotalPages - 1} onClick={() => setHistoricoPage((p) => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* Cancelados */}
        <TabsContent value="cancelados">
          <div className="space-y-3">
            {canceladosLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : cancelados.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum pagamento cancelado
              </div>
            ) : (
              cancelados.map((f) => (
                <Card key={f.id} className="p-3 opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm truncate">{f.nome_cliente || f.telefone_cliente}</h3>
                      <p className="text-xs text-muted-foreground">
                        {f.id} • {f.motivo_perda || "Cancelado"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm line-through text-muted-foreground">{formatMoeda(f.valor_total)}</div>
                      <Badge variant="destructive" className="text-[10px]">Cancelado</Badge>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Confirm Cancel Dialog */}
      <AlertDialog open={!!confirmCancel} onOpenChange={() => setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              A ficha {confirmCancel?.id} será marcada como "Perdido" e o pagamento será considerado cancelado. Essa ação pode ser revertida alterando o status da ficha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => confirmCancel && cancelarPagamento(confirmCancel)}
            >
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
