import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Loader2,
  Copy,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  History,
  DollarSign,
  Info,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const formatMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const EXCLUDED_FICHAS = ["FS4-260127"];
const HISTORICO_PAGE_SIZE = 20;

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

const avatarColors = [
  "bg-primary", "bg-orange-600", "bg-purple-600", "bg-blue-600", "bg-teal-600", "bg-rose-600",
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export const PagamentoPrestadoresTab = () => {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState("pendentes");

  // Pendentes
  const [loading, setLoading] = useState(true);
  const [transacoes, setTransacoes] = useState<any[]>([]);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [detalhesSelecionado, setDetalhesSelecionado] = useState<any>(null);

  // Histórico
  const [historico, setHistorico] = useState<any[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoPage, setHistoricoPage] = useState(0);
  const [historicoTotal, setHistoricoTotal] = useState(0);

  const fetchPendentes = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("transacoes_financeiras")
        .select("*")
        .eq("status_pagamento_prestador", "pendente")
        .order("data_pagamento_prevista", { ascending: true });

      if (error) throw error;
      const filtered = (data || []).filter(
        (t: any) => !EXCLUDED_FICHAS.includes(t.ficha_id)
      );
      setTransacoes(filtered);
    } catch (e: any) {
      console.error("Erro ao carregar pagamentos prestadores:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistorico = useCallback(async () => {
    try {
      setHistoricoLoading(true);
      const { data, error, count } = await supabase
        .from("transacoes_financeiras")
        .select("*", { count: "exact" })
        .eq("status_pagamento_prestador", "pago")
        .order("data_pagamento_realizada", { ascending: false })
        .range(
          historicoPage * HISTORICO_PAGE_SIZE,
          (historicoPage + 1) * HISTORICO_PAGE_SIZE - 1
        );

      if (error) throw error;
      const filtered = (data || []).filter(
        (t: any) => !EXCLUDED_FICHAS.includes(t.ficha_id)
      );
      setHistorico(filtered);
      setHistoricoTotal(count || 0);
    } catch (e: any) {
      console.error("Erro ao carregar histórico:", e);
    } finally {
      setHistoricoLoading(false);
    }
  }, [historicoPage]);

  useEffect(() => {
    fetchPendentes();
  }, [fetchPendentes]);

  useEffect(() => {
    if (subTab === "historico") fetchHistorico();
  }, [subTab, fetchHistorico]);

  const marcarPrestadorPago = async (transacao: any) => {
    try {
      setMarkingPaid(transacao.id);
      const agora = new Date().toISOString();

      await supabase
        .from("transacoes_financeiras")
        .update({
          status_pagamento_prestador: "pago",
          data_pagamento_realizada: agora,
        } as any)
        .eq("id", transacao.id);

      // Notify Make.com to update spreadsheet
      try {
        await supabase.functions.invoke("webhook-update-planilha", {
          body: {
            tipo: "pagamento_prestador",
            ficha_id: transacao.ficha_id,
            transacao_id: transacao.id,
            prestador_nome: transacao.prestador_nome,
            prestador_cpf: transacao.prestador_cpf,
            valor_a_pagar_prestador: transacao.valor_a_pagar_prestador,
            pix_prestador: transacao.pix_prestador,
            status: "pago",
            data_pagamento: agora,
          },
        });
      } catch (webhookErr) {
        console.error("Webhook planilha error (não bloqueante):", webhookErr);
      }

      toast({ title: "✅ Pagamento ao prestador confirmado!" });
      fetchPendentes();
      if (subTab === "historico") fetchHistorico();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setMarkingPaid(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: text });
  };

  const totalPendente = transacoes.reduce((s, t) => s + (t.valor_a_pagar_prestador || 0), 0);
  const historicoTotalPages = Math.ceil(historicoTotal / HISTORICO_PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-3 overflow-x-auto">
        <Card className="min-w-[160px] bg-primary text-primary-foreground p-3 shrink-0">
          <div className="text-xs opacity-80">Pendentes</div>
          <div className="text-2xl font-bold">{transacoes.length}</div>
        </Card>
        <Card className="min-w-[160px] bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-3 shrink-0">
          <div className="text-xs text-blue-600 dark:text-blue-400">Total a Pagar</div>
          <div className="text-xl font-bold text-blue-900 dark:text-blue-300">{formatMoeda(totalPendente)}</div>
        </Card>
      </div>

      {/* Sub-tabs */}
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="mb-3">
          <TabsTrigger value="pendentes" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Pendentes
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">
            <History className="h-3.5 w-3.5" /> Histórico
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
            ) : transacoes.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum pagamento pendente a prestadores!</p>
              </div>
            ) : (
              transacoes.map((t) => (
                <Card key={t.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-10 w-10 rounded-full ${getAvatarColor(t.prestador_id)} flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0`}
                    >
                      {getInitials(t.prestador_nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">{t.prestador_nome}</h3>
                          <p className="text-xs text-muted-foreground">{t.prestador_cpf || "—"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xl font-bold text-primary">{formatMoeda(t.valor_a_pagar_prestador)}</div>
                          <div className="text-[10px] text-muted-foreground">Líquido prestador</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-3">
                        <Badge variant="secondary" className="text-xs">{t.ficha_id}</Badge>
                        {t.categoria && <Badge variant="outline" className="text-xs">{t.categoria}</Badge>}
                        {t.data_pagamento_prevista && (
                          <Badge variant="outline" className="text-xs gap-1">
                            Previsto: {format(parseISO(t.data_pagamento_prevista), "dd/MM")}
                          </Badge>
                        )}
                        <Badge
                          className={
                            t.status_pagamento_cliente === "pago"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs"
                          }
                        >
                          {t.status_pagamento_cliente === "pago" ? "Cliente pagou" : "Cliente pendente"}
                        </Badge>
                      </div>

                      {/* PIX info */}
                      {t.pix_prestador && (
                        <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-2 mb-3 flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-green-600 shrink-0" />
                          <span className="text-sm font-medium text-green-800 dark:text-green-300 truncate">
                            PIX: {t.pix_prestador}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 shrink-0 text-green-700 hover:text-green-800"
                            onClick={() => copyToClipboard(t.pix_prestador)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                          </Button>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setDetalhesSelecionado(t);
                            setDetalhesOpen(true);
                          }}
                        >
                          <Info className="h-3.5 w-3.5 mr-1" /> Detalhes
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          disabled={markingPaid === t.id}
                          onClick={() => marcarPrestadorPago(t)}
                        >
                          {markingPaid === t.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                          )}
                          Pagar
                        </Button>
                      </div>
                    </div>
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
                {historico.map((t) => (
                  <Card key={t.id} className="p-3 opacity-80">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-full ${getAvatarColor(t.prestador_id)} flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0`}
                      >
                        {getInitials(t.prestador_nome)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <h3 className="font-medium text-sm truncate">{t.prestador_nome}</h3>
                            <p className="text-xs text-muted-foreground">
                              {t.ficha_id} • Pago em {t.data_pagamento_realizada ? format(parseISO(t.data_pagamento_realizada), "dd/MM/yy") : "—"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-sm">{formatMoeda(t.valor_a_pagar_prestador)}</div>
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                              Pago
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}

                {/* Pagination */}
                {historicoTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">{historicoTotal} registros</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={historicoPage === 0}
                        onClick={() => setHistoricoPage((p) => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        {historicoPage + 1} / {historicoTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={historicoPage >= historicoTotalPages - 1}
                        onClick={() => setHistoricoPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Details Modal */}
      <Dialog open={detalhesOpen} onOpenChange={setDetalhesOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Pagamento</DialogTitle>
          </DialogHeader>
          {detalhesSelecionado && (
            <div className="space-y-3">
              <Card className="p-3 bg-muted">
                <h3 className="font-semibold text-sm mb-2">🔧 Prestador</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{detalhesSelecionado.prestador_nome}</span></div>
                  <div><span className="text-muted-foreground">CPF:</span> <span className="font-medium">{detalhesSelecionado.prestador_cpf || "—"}</span></div>
                  {detalhesSelecionado.pix_prestador && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">PIX:</span>
                      <span className="font-medium">{detalhesSelecionado.pix_prestador}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(detalhesSelecionado.pix_prestador)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-3 bg-blue-50 dark:bg-blue-950/20">
                <h3 className="font-semibold text-sm mb-2">📋 Serviço</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Ficha:</span> <span className="font-medium">{detalhesSelecionado.ficha_id}</span></div>
                  <div><span className="text-muted-foreground">Categoria:</span> <span className="font-medium">{detalhesSelecionado.categoria || "—"}</span></div>
                  <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{detalhesSelecionado.cliente_nome}</span></div>
                  <div><span className="text-muted-foreground">Execução:</span> <span className="font-medium">{format(parseISO(detalhesSelecionado.data_execucao), "dd/MM/yy HH:mm")}</span></div>
                </div>
              </Card>

              <Card className="p-3">
                <h3 className="font-semibold text-sm mb-2">💰 Valores</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Mão de Obra:</span><span>{formatMoeda(detalhesSelecionado.valor_mao_obra)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Material:</span><span>{formatMoeda(detalhesSelecionado.valor_material)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Taxa Visita:</span><span>{formatMoeda(detalhesSelecionado.taxa_visita)}</span></div>
                  <Separator className="my-1" />
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor Cliente:</span><span className="font-bold">{formatMoeda(detalhesSelecionado.valor_cliente_final)}</span></div>
                  <div className="flex justify-between text-base">
                    <span className="font-semibold">Líquido Prestador:</span>
                    <span className="font-bold text-primary">{formatMoeda(detalhesSelecionado.valor_a_pagar_prestador)}</span>
                  </div>
                </div>
              </Card>

              {detalhesSelecionado.observacoes && (
                <Card className="p-3">
                  <h3 className="font-semibold text-sm mb-1">📝 Observações</h3>
                  <p className="text-sm text-muted-foreground">{detalhesSelecionado.observacoes}</p>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
