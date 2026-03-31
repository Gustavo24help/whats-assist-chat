import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { isBusinessDay } from "@/lib/businessDays2026";
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
  Ban,
} from "lucide-react";
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

function calcularDataPagamento(dataBase: Date): string {
  const data = new Date(dataBase);
  let diasAdicionados = 0;
  while (diasAdicionados < 2) {
    data.setDate(data.getDate() + 1);
    if (isBusinessDay(data)) {
      diasAdicionados++;
    }
  }
  return data.toISOString();
}

const formatMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const EXCLUDED_FICHAS = ["FS4-260127"];
const HISTORICO_PAGE_SIZE = 20;

// Only show fichas from the last 45 days to avoid showing old already-paid records
const CUTOFF_DATE = new Date();
CUTOFF_DATE.setDate(CUTOFF_DATE.getDate() - 45);
const CUTOFF_ISO = CUTOFF_DATE.toISOString();

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n?.[0] || "").join("").toUpperCase();
}

const avatarColors = [
  "bg-primary", "bg-orange-600", "bg-purple-600", "bg-blue-600", "bg-teal-600", "bg-rose-600",
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

interface FichaComPrestador {
  id: string;
  nome_ficha: string;
  nome_cliente_resolved: string;
  telefone_cliente: string;
  status: string;
  valor_total: number;
  valor_mao_obra: number;
  valor_pecas: number;
  prestador_id: string;
  prestador_nome: string;
  prestador_cpf: string;
  chave_pix: string | null;
  nome_pix: string | null;
  updated_at: string;
  pago_prestador: boolean;
  data_pagamento_prestador: string | null;
}

export const PagamentoPrestadoresTab = () => {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState("pendentes");

  const [loading, setLoading] = useState(true);
  const [pendentes, setPendentes] = useState<FichaComPrestador[]>([]);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [detalhesSelecionado, setDetalhesSelecionado] = useState<FichaComPrestador | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<FichaComPrestador | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);

  const [historico, setHistorico] = useState<FichaComPrestador[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoPage, setHistoricoPage] = useState(0);
  const [historicoTotal, setHistoricoTotal] = useState(0);

  const buildFichasList = useCallback(async (
    pagoFilter: boolean,
    page?: number,
  ): Promise<{ items: FichaComPrestador[]; total: number }> => {
    let query = supabase
      .from("fichas_de_servico")
      .select("id, nome_ficha, nome_cliente, telefone_cliente, status, valor_total, valor_mao_obra, valor_pecas, prestador_id, updated_at", { count: "exact" })
      .eq("status", "Finalizado" as any)
      .gt("valor_total", 0)
      .not("prestador_id", "is", null)
      .gte("updated_at", CUTOFF_ISO)
      .order("updated_at", { ascending: false });

    if (page !== undefined) {
      query = query.range(page * HISTORICO_PAGE_SIZE, (page + 1) * HISTORICO_PAGE_SIZE - 1);
    }

    const { data: fichasData, error: fichasError, count } = await query;
    if (fichasError) throw fichasError;

    const fichas = (fichasData || []).filter((f: any) => !EXCLUDED_FICHAS.includes(f.id));
    if (fichas.length === 0) return { items: [], total: count || 0 };

    // Get unique prestador IDs and phone numbers
    const prestadorIds = [...new Set(fichas.map((f: any) => f.prestador_id))];
    const phones = [...new Set(fichas.map((f: any) => f.telefone_cliente))];

    // Fetch prestadores and clientes in parallel
    const [prestadoresRes, clientesRes, transacoesRes] = await Promise.all([
      supabase.from("prestadores").select("cpf, nome, chave_pix, nome_pix").in("cpf", prestadorIds),
      supabase.from("clientes").select("telefone, nome").in("telefone", phones),
      supabase.from("transacoes_financeiras").select("ficha_id, status_pagamento_prestador, data_pagamento_realizada").in("ficha_id", fichas.map((f: any) => f.id)),
    ]);

    const prestadorMap = new Map((prestadoresRes.data || []).map((p: any) => [p.cpf, p]));
    const clienteMap = new Map((clientesRes.data || []).map((c: any) => [c.telefone, c.nome]));
    const transMap = new Map((transacoesRes.data || []).map((t: any) => [t.ficha_id, t]));

    const items: FichaComPrestador[] = fichas.map((f: any) => {
      const prest = prestadorMap.get(f.prestador_id);
      const trans = transMap.get(f.id);
      return {
        id: f.id,
        nome_ficha: f.nome_ficha || f.id,
        nome_cliente_resolved: f.nome_cliente || clienteMap.get(f.telefone_cliente) || f.telefone_cliente.replace("whatsapp:+55", ""),
        telefone_cliente: f.telefone_cliente,
        status: f.status,
        valor_total: f.valor_total || 0,
        valor_mao_obra: f.valor_mao_obra || 0,
        valor_pecas: f.valor_pecas || 0,
        prestador_id: f.prestador_id,
        prestador_nome: prest?.nome || f.prestador_id,
        prestador_cpf: f.prestador_id,
        chave_pix: prest?.chave_pix || null,
        nome_pix: prest?.nome_pix || null,
        updated_at: f.updated_at,
        pago_prestador: trans?.status_pagamento_prestador === "pago",
        data_pagamento_prestador: trans?.data_pagamento_realizada || null,
      };
    });

    const filtered = items.filter((i) => i.pago_prestador === pagoFilter);
    return { items: filtered, total: count || 0 };
  }, []);

  const fetchPendentes = useCallback(async () => {
    try {
      setLoading(true);
      const { items } = await buildFichasList(false);
      setPendentes(items);
    } catch (e: any) {
      console.error("Erro ao carregar pagamentos prestadores:", e);
    } finally {
      setLoading(false);
    }
  }, [buildFichasList]);

  const fetchHistorico = useCallback(async () => {
    try {
      setHistoricoLoading(true);
      const { items, total } = await buildFichasList(true, historicoPage);
      setHistorico(items);
      setHistoricoTotal(total);
    } catch (e: any) {
      console.error("Erro ao carregar histórico:", e);
    } finally {
      setHistoricoLoading(false);
    }
  }, [buildFichasList, historicoPage]);

  useEffect(() => {
    fetchPendentes();
  }, [fetchPendentes]);

  useEffect(() => {
    if (subTab === "historico") fetchHistorico();
  }, [subTab, fetchHistorico]);

  const marcarPrestadorPago = async (ficha: FichaComPrestador) => {
    try {
      setMarkingPaid(ficha.id);
      const agora = new Date().toISOString();

      // Buscar data real de finalização do histórico
      const { data: histFinalizado } = await supabase
        .from("ficha_status_historico")
        .select("data_inicio")
        .eq("ficha_id", ficha.id)
        .eq("status_novo", "Finalizado" as any)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const dataExecucaoReal = histFinalizado?.data_inicio || ficha.updated_at || agora;
      const dataPagPrevista = calcularDataPagamento(new Date(dataExecucaoReal));

      const { data: existing } = await supabase
        .from("transacoes_financeiras")
        .select("id")
        .eq("ficha_id", ficha.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("transacoes_financeiras")
          .update({
            status_pagamento_prestador: "pago",
            data_pagamento_realizada: agora,
          } as any)
          .eq("id", existing.id);
      } else {
        await supabase
          .from("transacoes_financeiras")
          .insert({
            ficha_id: ficha.id,
            prestador_id: ficha.prestador_cpf,
            prestador_nome: ficha.prestador_nome,
            prestador_cpf: ficha.prestador_cpf,
            cliente_id: ficha.telefone_cliente,
            cliente_nome: ficha.nome_cliente_resolved,
            valor_mao_obra: ficha.valor_mao_obra,
            valor_material: ficha.valor_pecas,
            valor_cliente_final: ficha.valor_total,
            valor_a_pagar_prestador: ficha.valor_mao_obra,
            valor_subtotal: ficha.valor_total,
            valor_lucro_bruto: ficha.valor_total - ficha.valor_mao_obra,
            pix_prestador: ficha.chave_pix,
            status_pagamento_prestador: "pago",
            status_pagamento_cliente: ficha.valor_total > 0 ? "pendente" : "pago",
            data_pagamento_prevista: dataPagPrevista,
            data_pagamento_realizada: agora,
          } as any);
      }

      // Notify Make.com (non-blocking)
      try {
        await supabase.functions.invoke("webhook-update-planilha", {
          body: {
            tipo: "pagamento_prestador",
            ficha_id: ficha.id,
            prestador_nome: ficha.prestador_nome,
            prestador_cpf: ficha.prestador_cpf,
            valor_a_pagar_prestador: ficha.valor_mao_obra,
            pix_prestador: ficha.chave_pix,
            status: "pago",
            data_pagamento: agora,
          },
        });
      } catch (webhookErr) {
        console.error("Webhook planilha error (não bloqueante):", webhookErr);
      }

      toast({ title: "✅ Pagamento ao prestador confirmado!" });
      // Remove from list immediately
      setPendentes(prev => prev.filter(f => f.id !== ficha.id));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setMarkingPaid(null);
    }
  };

  const cancelarPagamento = async (ficha: FichaComPrestador) => {
    try {
      setCancelando(ficha.id);
      setConfirmCancel(null);

      await supabase
        .from("fichas_de_servico")
        .update({
          status: "Perdido",
          motivo_perda: "Pagamento prestador cancelado",
        } as any)
        .eq("id", ficha.id);

      toast({ title: "Pagamento marcado como cancelado" });
      setPendentes(prev => prev.filter(f => f.id !== ficha.id));
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

  const totalPendente = pendentes.reduce((s, f) => s + (f.valor_mao_obra || 0), 0);
  const historicoTotalPages = Math.ceil(historicoTotal / HISTORICO_PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-3 overflow-x-auto">
        <Card className="min-w-[160px] bg-primary text-primary-foreground p-3 shrink-0">
          <div className="text-xs opacity-80">Pendentes (últimos 45 dias)</div>
          <div className="text-2xl font-bold">{pendentes.length}</div>
        </Card>
        <Card className="min-w-[160px] bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-3 shrink-0">
          <div className="text-xs text-blue-600 dark:text-blue-400">Total a Pagar</div>
          <div className="text-xl font-bold text-blue-900 dark:text-blue-300">{formatMoeda(totalPendente)}</div>
        </Card>
      </div>

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
            ) : pendentes.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum pagamento pendente a prestadores!</p>
              </div>
            ) : (
              pendentes.map((f) => (
                <Card key={f.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-10 w-10 rounded-full ${getAvatarColor(f.prestador_cpf)} flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0`}
                    >
                      {getInitials(f.prestador_nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">{f.prestador_nome}</h3>
                          <p className="text-xs text-muted-foreground">{f.prestador_cpf}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xl font-bold text-primary">{formatMoeda(f.valor_mao_obra)}</div>
                          <div className="text-[10px] text-muted-foreground">Mão de obra</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-3">
                        <Badge variant="secondary" className="text-xs">{f.id}</Badge>
                        <Badge variant="outline" className="text-xs">Cliente: {f.nome_cliente_resolved}</Badge>
                        <Badge variant="outline" className="text-xs">Total: {formatMoeda(f.valor_total)}</Badge>
                      </div>

                      {/* PIX info */}
                      {f.chave_pix && (
                        <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-2 mb-3 flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-green-600 shrink-0" />
                          <span className="text-sm font-medium text-green-800 dark:text-green-300 truncate">
                            PIX: {f.chave_pix} {f.nome_pix ? `(${f.nome_pix})` : ""}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 shrink-0 text-green-700 hover:text-green-800"
                            onClick={() => copyToClipboard(f.chave_pix!)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                          </Button>
                        </div>
                      )}

                      {!f.chave_pix && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2 mb-3 text-xs text-amber-700 dark:text-amber-400">
                          ⚠️ PIX não cadastrado para este prestador
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setDetalhesSelecionado(f);
                            setDetalhesOpen(true);
                          }}
                        >
                          <Info className="h-3.5 w-3.5 mr-1" /> Detalhes
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/30"
                          disabled={cancelando === f.id}
                          onClick={() => setConfirmCancel(f)}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          disabled={markingPaid === f.id}
                          onClick={() => marcarPrestadorPago(f)}
                        >
                          {markingPaid === f.id ? (
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
                {historico.map((f) => (
                  <Card key={f.id} className="p-3 opacity-80">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-full ${getAvatarColor(f.prestador_cpf)} flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0`}
                      >
                        {getInitials(f.prestador_nome)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <h3 className="font-medium text-sm truncate">{f.prestador_nome}</h3>
                            <p className="text-xs text-muted-foreground">{f.id} • {f.nome_cliente_resolved}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-sm">{formatMoeda(f.valor_mao_obra)}</div>
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                              Pago
                            </Badge>
                          </div>
                        </div>
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
      </Tabs>

      {/* Detalhes Dialog */}
      <Dialog open={detalhesOpen} onOpenChange={setDetalhesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Pagamento</DialogTitle>
          </DialogHeader>
          {detalhesSelecionado && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ficha</span>
                <span className="font-medium">{detalhesSelecionado.id}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{detalhesSelecionado.nome_cliente_resolved}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prestador</span>
                <span className="font-medium">{detalhesSelecionado.prestador_nome}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor Total</span>
                <span className="font-bold">{formatMoeda(detalhesSelecionado.valor_total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mão de Obra</span>
                <span className="font-bold text-primary">{formatMoeda(detalhesSelecionado.valor_mao_obra)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Peças</span>
                <span>{formatMoeda(detalhesSelecionado.valor_pecas)}</span>
              </div>
              <Separator />
              {detalhesSelecionado.chave_pix && (
                <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Chave PIX</div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-green-800 dark:text-green-300">
                      {detalhesSelecionado.chave_pix}
                    </span>
                    <Button variant="ghost" size="sm" className="h-6" onClick={() => copyToClipboard(detalhesSelecionado.chave_pix!)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  {detalhesSelecionado.nome_pix && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Titular: {detalhesSelecionado.nome_pix}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Cancel Dialog */}
      <AlertDialog open={!!confirmCancel} onOpenChange={() => setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pagamento ao prestador?</AlertDialogTitle>
            <AlertDialogDescription>
              A ficha {confirmCancel?.id} será marcada como "Perdido". O prestador {confirmCancel?.prestador_nome} não será pago por este serviço.
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
