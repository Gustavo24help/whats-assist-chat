import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  DollarSign,
  CheckCircle2,
  XCircle,
  Info,
  AlertTriangle,
  Loader2,
  Building2,
  CreditCard,
  Calendar,
  Star,
} from "lucide-react";
import { format, isToday, parseISO, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransacaoPagamento {
  id: string;
  ficha_id: string;
  prestador_id: string;
  prestador_nome: string;
  prestador_codigo: string | null;
  prestador_cpf: string | null;
  prestador_cnpj: string | null;
  cliente_id: string;
  cliente_nome: string;
  categoria: string | null;
  data_contratacao: string | null;
  data_execucao: string;
  data_pagamento_prevista: string;
  data_pagamento_realizada: string | null;
  valor_a_pagar_prestador: number;
  valor_mao_obra: number;
  valor_material: number;
  taxa_visita: number;
  valor_subtotal: number;
  valor_cliente_final: number;
  valor_lucro_bruto: number;
  margem_operacional_real: number;
  material_pago_24help: boolean;
  forma_pagamento_cliente: string | null;
  status_pagamento_cliente: string;
  status_pagamento_prestador: string;
  pix_prestador: string | null;
  banco_prestador: string | null;
  agencia_prestador: string | null;
  conta_prestador: string | null;
  observacoes: string | null;
  adiantamento_cliente: number;
  adiantamento_prestador: number;
}

const formatMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const avatarColors = [
  "bg-primary",
  "bg-orange-600",
  "bg-purple-600",
  "bg-blue-600",
  "bg-teal-600",
  "bg-rose-600",
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

const Financeiro = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transacoes, setTransacoes] = useState<TransacaoPagamento[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [detalhesSelecionado, setDetalhesSelecionado] = useState<TransacaoPagamento | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  // Avaliações e NPS por prestador
  const [avaliacoes, setAvaliacoes] = useState<Record<string, { nota: number; count: number }>>({});
  const [npsScores, setNpsScores] = useState<Record<string, { nota: number; count: number }>>({});

  const hoje = new Date();

  const fetchPagamentos = useCallback(async () => {
    try {
      setLoading(true);

      // Buscar transações com pagamento previsto para hoje
      const inicioHoje = startOfDay(hoje).toISOString();
      const fimHoje = endOfDay(hoje).toISOString();

      const { data, error } = await supabase
        .from("transacoes_financeiras")
        .select("*")
        .gte("data_pagamento_prevista", inicioHoje)
        .lte("data_pagamento_prevista", fimHoje)
        .order("prestador_nome", { ascending: true });

      if (error) throw error;
      setTransacoes((data as TransacaoPagamento[]) || []);

      // Buscar avaliações e NPS para os prestadores
      if (data && data.length > 0) {
        const prestadorIds = [...new Set(data.map((t: any) => t.prestador_id))];

        const { data: avalData } = await supabase
          .from("avaliacao_prestador")
          .select("prestador_id, nota")
          .in("prestador_id", prestadorIds)
          .not("nota", "is", null);

        if (avalData) {
          const map: Record<string, { nota: number; count: number }> = {};
          avalData.forEach((a: any) => {
            if (!map[a.prestador_id]) map[a.prestador_id] = { nota: 0, count: 0 };
            map[a.prestador_id].nota += a.nota;
            map[a.prestador_id].count += 1;
          });
          setAvaliacoes(map);
        }

        const { data: npsData } = await supabase
          .from("nps_respostas")
          .select("prestador_id, nota")
          .in("prestador_id", prestadorIds)
          .not("nota", "is", null);

        if (npsData) {
          const map: Record<string, { nota: number; count: number }> = {};
          npsData.forEach((n: any) => {
            if (!map[n.prestador_id]) map[n.prestador_id] = { nota: 0, count: 0 };
            map[n.prestador_id].nota += n.nota;
            map[n.prestador_id].count += 1;
          });
          setNpsScores(map);
        }
      }
    } catch (error: any) {
      toast({ title: "Erro ao carregar pagamentos", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPagamentos();
  }, [fetchPagamentos]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pendentes = transacoes.filter((t) => t.status_pagamento_prestador === "pendente");
    if (selectedIds.size === pendentes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendentes.map((t) => t.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const marcarComoPago = async (ids: string[]) => {
    try {
      setMarkingPaid("bulk");
      const agora = new Date().toISOString();

      for (const id of ids) {
        await supabase
          .from("transacoes_financeiras")
          .update({
            status_pagamento_prestador: "pago",
            data_pagamento_realizada: agora,
          } as any)
          .eq("id", id);
      }

      toast({ title: "✅ Pagamento(s) marcado(s) como pago(s)!" });
      setSelectedIds(new Set());
      fetchPagamentos();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setMarkingPaid(null);
    }
  };

  const desmarcarPago = async (ids: string[]) => {
    try {
      setMarkingPaid("bulk");
      for (const id of ids) {
        await supabase
          .from("transacoes_financeiras")
          .update({
            status_pagamento_prestador: "pendente",
            data_pagamento_realizada: null,
          } as any)
          .eq("id", id);
      }
      toast({ title: "Pagamento(s) desmarcado(s)" });
      setSelectedIds(new Set());
      fetchPagamentos();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setMarkingPaid(null);
    }
  };

  const pendentes = transacoes.filter((t) => t.status_pagamento_prestador === "pendente");
  const pagos = transacoes.filter((t) => t.status_pagamento_prestador === "pago");
  const totalValor = transacoes.reduce((s, t) => s + t.valor_a_pagar_prestador, 0);
  const selectedTotal = transacoes
    .filter((t) => selectedIds.has(t.id))
    .reduce((s, t) => s + t.valor_a_pagar_prestador, 0);

  const getAvaliacao = (prestadorId: string) => {
    const a = avaliacoes[prestadorId];
    return a ? (a.nota / a.count).toFixed(1) : null;
  };

  const getNps = (prestadorId: string) => {
    const n = npsScores[prestadorId];
    return n ? Math.round(n.nota / n.count) : null;
  };

  const renderStars = (nota: number) => {
    const full = Math.floor(nota);
    const half = nota - full >= 0.5;
    return "⭐".repeat(full) + (half ? "½" : "");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-foreground">Pagamentos</h1>
              <p className="text-xs text-muted-foreground">
                {format(hoje, "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          <Logo />
        </div>

        {/* Summary Cards */}
        <div className="px-4 pb-3 flex gap-3 overflow-x-auto md:px-6">
          <Card className="min-w-[140px] bg-primary text-primary-foreground p-3 shrink-0">
            <div className="text-xs opacity-80">Pagamentos</div>
            <div className="text-2xl font-bold">{transacoes.length}</div>
            <div className="text-xs opacity-70">
              {pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""}
            </div>
          </Card>

          <Card className="min-w-[140px] bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-3 shrink-0">
            <div className="text-xs text-blue-600 dark:text-blue-400">Valor Total</div>
            <div className="text-xl font-bold text-blue-900 dark:text-blue-300">
              {formatMoeda(totalValor)}
            </div>
          </Card>

          <Card className="min-w-[140px] bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 p-3 shrink-0">
            <div className="text-xs text-green-600 dark:text-green-400">Selecionados</div>
            <div className="text-xl font-bold text-green-900 dark:text-green-300">
              {selectedIds.size}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">
              {formatMoeda(selectedTotal)}
            </div>
          </Card>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 md:px-6 space-y-3 pb-28">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Carregando pagamentos...</span>
          </div>
        ) : transacoes.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum pagamento previsto para hoje</p>
          </div>
        ) : (
          transacoes.map((t) => {
            const isPago = t.status_pagamento_prestador === "pago";
            const clientePagou = t.status_pagamento_cliente === "pago";
            const avaliacao = getAvaliacao(t.prestador_id);
            const nps = getNps(t.prestador_id);

            return (
              <Card
                key={t.id}
                className={`p-4 ${
                  !clientePagou
                    ? "border-l-4 border-l-destructive"
                    : isPago
                      ? "border-l-4 border-l-green-500 opacity-70"
                      : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {!isPago && (
                    <Checkbox
                      checked={selectedIds.has(t.id)}
                      onCheckedChange={() => toggleSelect(t.id)}
                      className="mt-1"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    {/* Prestador + Valor */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`h-10 w-10 rounded-full ${getAvatarColor(t.prestador_id)} flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0`}
                        >
                          {getInitials(t.prestador_nome)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">{t.prestador_nome}</h3>
                          <p className="text-xs text-muted-foreground">{t.prestador_codigo || t.prestador_cpf || "—"}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xl font-bold text-primary">
                          {formatMoeda(t.valor_a_pagar_prestador)}
                        </div>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      <Badge variant="secondary" className="text-xs">
                        {t.ficha_id}
                      </Badge>
                      {t.categoria && (
                        <Badge variant="outline" className="text-xs">
                          {t.categoria}
                        </Badge>
                      )}
                      {clientePagou ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Cliente Pagou
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          <XCircle className="h-3 w-3 mr-1" />
                          Cliente NÃO Pagou
                        </Badge>
                      )}
                      {isPago && (
                        <Badge className="bg-green-600 text-white text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Prestador Pago
                        </Badge>
                      )}
                    </div>

                    {/* Banco / PIX */}
                    {(t.banco_prestador || t.pix_prestador) && (
                      <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2 mb-3 text-xs">
                        {t.banco_prestador && (
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="h-3 w-3 text-blue-600" />
                            <span className="font-semibold">{t.banco_prestador}</span>
                          </div>
                        )}
                        {(t.agencia_prestador || t.conta_prestador) && (
                          <div className="text-muted-foreground pl-5">
                            {t.agencia_prestador && `Ag: ${t.agencia_prestador}`}
                            {t.agencia_prestador && t.conta_prestador && " • "}
                            {t.conta_prestador && `CC: ${t.conta_prestador}`}
                          </div>
                        )}
                        {t.pix_prestador && (
                          <div className="flex items-center gap-2 mt-1 font-medium pl-5">
                            <CreditCard className="h-3 w-3 text-green-600" />
                            PIX: {t.pix_prestador}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Avaliação + NPS */}
                    {(avaliacao || nps !== null) && (
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {avaliacao && (
                          <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-2 border-amber-400 dark:border-amber-600 px-2.5 py-1 rounded-lg">
                            <span className="text-sm">{renderStars(parseFloat(avaliacao))}</span>
                            <span className="text-base font-bold text-amber-800 dark:text-amber-300">
                              {avaliacao}
                            </span>
                          </div>
                        )}
                        {nps !== null && (
                          <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-2 border-emerald-500 dark:border-emerald-600 px-2.5 py-1 rounded-lg">
                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
                              NPS
                            </span>
                            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300 leading-none">
                              {nps}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Datas */}
                    <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                      {t.data_contratacao && (
                        <div>
                          <span className="font-medium">Contratação:</span>{" "}
                          {format(parseISO(t.data_contratacao), "dd/MM HH:mm")}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Execução:</span>{" "}
                        {format(parseISO(t.data_execucao), "dd/MM HH:mm")}
                      </div>
                    </div>

                    {/* Actions */}
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
                        <Info className="h-3.5 w-3.5 mr-1" />
                        Detalhes
                      </Button>
                      {!isPago ? (
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={markingPaid === t.id}
                          onClick={async () => {
                            setMarkingPaid(t.id);
                            await marcarComoPago([t.id]);
                            setMarkingPaid(null);
                          }}
                        >
                          {markingPaid === t.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          )}
                          Pagar
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-muted-foreground"
                          onClick={() => desmarcarPago([t.id])}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Desfazer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </main>

      {/* Bottom Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-[0_-4px_12px_rgba(0,0,0,0.1)] p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedIds.size === pendentes.length && pendentes.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="text-destructive">
              Limpar
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={markingPaid === "bulk"}
              onClick={() => marcarComoPago([...selectedIds])}
            >
              {markingPaid === "bulk" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Marcar Pago
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={markingPaid === "bulk"}
              onClick={() => desmarcarPago([...selectedIds])}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Desmarcar
            </Button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      <Dialog open={detalhesOpen} onOpenChange={setDetalhesOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes Completos</DialogTitle>
          </DialogHeader>
          {detalhesSelecionado && (
            <div className="space-y-3">
              {/* Serviço */}
              <Card className="p-3 bg-blue-50 dark:bg-blue-950/20">
                <h3 className="font-semibold text-sm mb-2">📋 Serviço</h3>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">Ficha:</span>{" "}
                    <span className="font-medium">{detalhesSelecionado.ficha_id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Categoria:</span>{" "}
                    <span className="font-medium">{detalhesSelecionado.categoria || "—"}</span>
                  </div>
                  {detalhesSelecionado.data_contratacao && (
                    <div>
                      <span className="text-muted-foreground">Contratação:</span>{" "}
                      <span className="font-medium">
                        {format(parseISO(detalhesSelecionado.data_contratacao), "dd/MM HH:mm")}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Execução:</span>{" "}
                    <span className="font-medium">
                      {format(parseISO(detalhesSelecionado.data_execucao), "dd/MM HH:mm")}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Prestador */}
              <Card className="p-3 bg-green-50 dark:bg-green-950/20">
                <h3 className="font-semibold text-sm mb-2">🔧 Prestador</h3>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nome:</span>{" "}
                    <span className="font-medium">{detalhesSelecionado.prestador_nome}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Código:</span>{" "}
                    <span className="font-medium">{detalhesSelecionado.prestador_codigo || "—"}</span>
                  </div>
                  {detalhesSelecionado.banco_prestador && (
                    <div>
                      <span className="text-muted-foreground">Banco:</span>{" "}
                      <span className="font-medium">{detalhesSelecionado.banco_prestador}</span>
                    </div>
                  )}
                  {(detalhesSelecionado.agencia_prestador || detalhesSelecionado.conta_prestador) && (
                    <div>
                      <span className="text-muted-foreground">Ag/Conta:</span>{" "}
                      <span className="font-medium">
                        {detalhesSelecionado.agencia_prestador || "—"} / {detalhesSelecionado.conta_prestador || "—"}
                      </span>
                    </div>
                  )}
                  {detalhesSelecionado.pix_prestador && (
                    <div>
                      <span className="text-muted-foreground">PIX:</span>{" "}
                      <span className="font-medium">{detalhesSelecionado.pix_prestador}</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Valores */}
              <Card className="p-3 bg-muted">
                <h3 className="font-semibold text-sm mb-2">💰 Valores</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mão de Obra:</span>
                    <span className="font-medium">{formatMoeda(detalhesSelecionado.valor_mao_obra)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Material:</span>
                    <span className="font-medium">{formatMoeda(detalhesSelecionado.valor_material)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxa Visita:</span>
                    <span className="font-medium">{formatMoeda(detalhesSelecionado.taxa_visita)}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-bold">{formatMoeda(detalhesSelecionado.valor_subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor Cliente Final:</span>
                    <span className="font-bold text-green-700 dark:text-green-400">
                      {formatMoeda(detalhesSelecionado.valor_cliente_final)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lucro Bruto:</span>
                    <span className="font-medium">{formatMoeda(detalhesSelecionado.valor_lucro_bruto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Margem Real:</span>
                    <span className="font-medium">{detalhesSelecionado.margem_operacional_real.toFixed(1)}%</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between text-base">
                    <span className="font-semibold">A Pagar Prestador:</span>
                    <span className="font-bold text-primary">
                      {formatMoeda(detalhesSelecionado.valor_a_pagar_prestador)}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Avaliação */}
              {(() => {
                const av = getAvaliacao(detalhesSelecionado.prestador_id);
                const np = getNps(detalhesSelecionado.prestador_id);
                if (!av && np === null) return null;
                return (
                  <Card className="p-3 bg-yellow-50 dark:bg-yellow-950/20">
                    <h3 className="font-semibold text-sm mb-2 text-center">⭐ Avaliação</h3>
                    <div className="flex justify-center gap-4">
                      {av && (
                        <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-2 border-amber-400 px-2.5 py-1 rounded-lg">
                          <span className="text-sm">{renderStars(parseFloat(av))}</span>
                          <span className="text-base font-bold text-amber-800 dark:text-amber-300">{av}</span>
                        </div>
                      )}
                      {np !== null && (
                        <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-2 border-emerald-500 px-2.5 py-1 rounded-lg">
                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">NPS</span>
                          <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300 leading-none">{np}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })()}

              {/* Observações */}
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

export default Financeiro;
