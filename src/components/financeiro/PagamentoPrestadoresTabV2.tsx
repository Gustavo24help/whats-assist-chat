import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, Loader2, Copy, CreditCard, ChevronLeft, ChevronRight,
  History, DollarSign, Info, Ban, Search, Star, Building2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const formatMoeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const EXCLUDED_FICHAS = ["FS4-260127"];
const FINANCEIRO_CUTOFF = "2026-03-13T23:00:00.000Z";
const PAGE_SIZE = 20;

function calcFinanceiro(ficha: any) {
  const maoObra = ficha.valor_mao_obra || 0;
  const pecas = ficha.valor_pecas || 0;
  const taxaVisita = 0;
  const adiantCliente = 0;
  const adiantPrestador = 0;
  const subtotal = maoObra + pecas + taxaVisita;
  const margemPct = 23;
  const totalOS = ficha.valor_total || 0;
  const taxa24help = totalOS > 0 ? totalOS - subtotal : subtotal * (margemPct / 100);
  const liquidoPrestador = maoObra + taxaVisita;
  const desconto = 0;
  const lucroBruto = totalOS - liquidoPrestador - pecas;
  const rentab = totalOS > 0 ? (lucroBruto / totalOS) * 100 : 0;

  return {
    maoObra, pecas, taxaVisita, adiantCliente, adiantPrestador,
    taxa24help: Math.max(taxa24help, 0), totalOS, liquidoPrestador,
    desconto, lucroBruto: Math.max(lucroBruto, 0), rentab: Math.max(rentab, 0),
  };
}

interface FichaFinanceira {
  id: string;
  nome_cliente_resolved: string;
  telefone_cliente: string;
  status: string;
  valor_total: number;
  valor_mao_obra: number;
  valor_pecas: number;
  prestador_id: string | null;
  prestador_nome: string;
  prestador_cpf: string;
  chave_pix: string | null;
  nome_pix: string | null;
  banco: string | null;
  pagamento_realizado: boolean;
  pagamento_link: string | null;
  updated_at: string;
  created_at: string;
  pago_prestador: boolean;
  nps_nota: number | null;
  financeiro: ReturnType<typeof calcFinanceiro>;
}

export const PagamentoPrestadoresTabV2 = () => {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState("pendentes");
  const [loading, setLoading] = useState(true);
  const [pendentes, setPendentes] = useState<FichaFinanceira[]>([]);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [detalhesSel, setDetalhesSel] = useState<FichaFinanceira | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<FichaFinanceira | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [historico, setHistorico] = useState<FichaFinanceira[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoPage, setHistoricoPage] = useState(0);
  const [historicoTotal, setHistoricoTotal] = useState(0);

  const buildList = useCallback(async (pagoFilter: boolean, page?: number) => {
    let query = supabase
      .from("fichas_de_servico")
      .select("id, nome_ficha, nome_cliente, telefone_cliente, status, valor_total, valor_mao_obra, valor_pecas, prestador_id, pagamento_realizado, pagamento_link, updated_at, created_at", { count: "exact" })
      .eq("status", "Finalizado" as any)
      .gt("valor_total", 0)
      .not("prestador_id", "is", null)
      .order("updated_at", { ascending: false });

    if (page !== undefined) {
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    }

    const { data: fichasData, error, count } = await query;
    if (error) throw error;

    const fichas = (fichasData || []).filter((f: any) => !EXCLUDED_FICHAS.includes(f.id));
    if (fichas.length === 0) return { items: [], total: count || 0 };

    const prestadorIds = [...new Set(fichas.map((f: any) => f.prestador_id))];
    const phones = [...new Set(fichas.map((f: any) => f.telefone_cliente))];
    const fichaIds = fichas.map((f: any) => f.id);

    const [prestRes, clienteRes, transRes, npsRes] = await Promise.all([
      supabase.from("prestadores").select("cpf, nome, chave_pix, nome_pix, banco").in("cpf", prestadorIds),
      supabase.from("clientes").select("telefone, nome").in("telefone", phones),
      supabase.from("transacoes_financeiras").select("ficha_id, status_pagamento_prestador").in("ficha_id", fichaIds),
      supabase.from("nps_respostas").select("ficha_id, nota").in("ficha_id", fichaIds),
    ]);

    const prestMap = new Map((prestRes.data || []).map((p: any) => [p.cpf, p]));
    const clienteMap = new Map((clienteRes.data || []).map((c: any) => [c.telefone, c.nome]));
    const transMap = new Map((transRes.data || []).map((t: any) => [t.ficha_id, t]));
    const npsMap = new Map((npsRes.data || []).map((n: any) => [n.ficha_id, n.nota]));

    const items: FichaFinanceira[] = fichas.map((f: any) => {
      const prest = prestMap.get(f.prestador_id);
      const trans = transMap.get(f.id);
      const fin = calcFinanceiro(f);
      return {
        id: f.id,
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
        banco: prest?.banco || null,
        pagamento_realizado: f.pagamento_realizado,
        pagamento_link: f.pagamento_link,
        updated_at: f.updated_at,
        created_at: f.created_at,
        pago_prestador: trans?.status_pagamento_prestador === "pago",
        nps_nota: npsMap.get(f.id) ?? null,
        financeiro: fin,
      };
    });

    const filtered = items.filter((i) => i.pago_prestador === pagoFilter);
    return { items: filtered, total: count || 0 };
  }, []);

  const fetchPendentes = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await buildList(false);
      setPendentes(items);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [buildList]);

  const fetchHistorico = useCallback(async () => {
    setHistoricoLoading(true);
    try {
      const { items, total } = await buildList(true, historicoPage);
      setHistorico(items);
      setHistoricoTotal(total);
    } catch (e) { console.error(e); }
    finally { setHistoricoLoading(false); }
  }, [buildList, historicoPage]);

  useEffect(() => { fetchPendentes(); }, [fetchPendentes]);
  useEffect(() => { if (subTab === "historico") fetchHistorico(); }, [subTab, fetchHistorico]);

  const marcarPago = async (ficha: FichaFinanceira) => {
    try {
      setMarkingPaid(ficha.id);
      const agora = new Date().toISOString();

      const { data: existing } = await supabase
        .from("transacoes_financeiras")
        .select("id")
        .eq("ficha_id", ficha.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("transacoes_financeiras")
          .update({ status_pagamento_prestador: "pago", data_pagamento_realizada: agora } as any)
          .eq("id", existing.id);
      } else {
        await supabase.from("transacoes_financeiras").insert({
          ficha_id: ficha.id,
          prestador_id: ficha.prestador_cpf,
          prestador_nome: ficha.prestador_nome,
          prestador_cpf: ficha.prestador_cpf,
          cliente_id: ficha.telefone_cliente,
          cliente_nome: ficha.nome_cliente_resolved,
          valor_mao_obra: ficha.valor_mao_obra,
          valor_material: ficha.valor_pecas,
          valor_cliente_final: ficha.valor_total,
          valor_a_pagar_prestador: ficha.financeiro.liquidoPrestador,
          valor_subtotal: ficha.valor_total,
          valor_lucro_bruto: ficha.financeiro.lucroBruto,
          pix_prestador: ficha.chave_pix,
          banco_prestador: ficha.banco,
          status_pagamento_prestador: "pago",
          status_pagamento_cliente: ficha.pagamento_realizado ? "pago" : "pendente",
          data_pagamento_prevista: agora,
          data_pagamento_realizada: agora,
        } as any);
      }

      toast({ title: "✅ Pagamento ao prestador confirmado!" });
      setPendentes(prev => prev.filter(f => f.id !== ficha.id));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setMarkingPaid(null);
    }
  };

  const cancelar = async (ficha: FichaFinanceira) => {
    setCancelando(ficha.id);
    setConfirmCancel(null);
    await supabase.from("fichas_de_servico")
      .update({ status: "Perdido", motivo_perda: "Pagamento prestador cancelado" } as any)
      .eq("id", ficha.id);
    toast({ title: "Pagamento cancelado" });
    setPendentes(prev => prev.filter(f => f.id !== ficha.id));
    setCancelando(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: text });
  };

  const filteredPendentes = search
    ? pendentes.filter(f =>
      f.prestador_nome.toLowerCase().includes(search.toLowerCase()) ||
      f.nome_cliente_resolved.toLowerCase().includes(search.toLowerCase()) ||
      f.id.toLowerCase().includes(search.toLowerCase())
    )
    : pendentes;

  const totalAPagar = filteredPendentes.reduce((s, f) => s + f.financeiro.liquidoPrestador, 0);
  const historicoTotalPages = Math.ceil(historicoTotal / PAGE_SIZE);

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (parts[0]?.[0] || "?").toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* Summary - clean */}
      <div className="flex gap-3 overflow-x-auto">
        <div className="min-w-[140px] rounded-lg border bg-card p-3 shrink-0">
          <div className="text-xs text-muted-foreground">Pendentes</div>
          <div className="text-2xl font-bold">{filteredPendentes.length}</div>
        </div>
        <div className="min-w-[180px] rounded-lg border bg-card p-3 shrink-0">
          <div className="text-xs text-muted-foreground">Total a Pagar</div>
          <div className="text-xl font-bold">{formatMoeda(totalAPagar)}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar prestador, cliente, ficha..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="mb-3">
          <TabsTrigger value="pendentes" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Pendentes</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5"><History className="h-3.5 w-3.5" /> Pagos</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filteredPendentes.length === 0 ? (
              <div className="text-center py-12"><CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" /><p className="text-muted-foreground">Nenhum pagamento pendente!</p></div>
            ) : (
              filteredPendentes.map((f) => (
                <div key={f.id} className="rounded-lg border bg-card p-4 flex items-center gap-4">
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
                    {getInitials(f.prestador_nome)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{f.prestador_nome}</h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">{f.id}</Badge>
                      <span className="text-xs text-muted-foreground truncate">Cliente: {f.nome_cliente_resolved}</span>
                      {f.pagamento_realizado ? (
                        <Badge variant="outline" className="text-[10px] border-green-300 text-green-700">Cliente Pagou</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Cliente Pendente</Badge>
                      )}
                      {f.nps_nota !== null && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 text-yellow-500" /> {f.nps_nota}
                        </span>
                      )}
                    </div>
                    {/* PIX + Banco */}
                    {(f.chave_pix || f.banco) && (
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        {f.chave_pix && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                            <CreditCard className="h-3 w-3 shrink-0" />
                            PIX: {f.chave_pix}
                            <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => copyToClipboard(f.chave_pix!)}>
                              <Copy className="h-2.5 w-2.5" />
                            </Button>
                          </span>
                        )}
                        {f.banco && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3 w-3 shrink-0" /> {f.banco}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Value */}
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold">{formatMoeda(f.financeiro.liquidoPrestador)}</div>
                    <div className="text-[10px] text-muted-foreground">Líquido</div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="h-9 px-3" onClick={() => { setDetalhesSel(f); setDetalhesOpen(true); }}>
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30 h-9 px-3" disabled={cancelando === f.id} onClick={() => setConfirmCancel(f)}>
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" className="h-9 px-4" disabled={markingPaid === f.id} onClick={() => marcarPago(f)}>
                      {markingPaid === f.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                      Pagar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="historico">
          <div className="space-y-2">
            {historicoLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : historico.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum pagamento realizado</div>
            ) : (
              <>
                {historico.map(f => (
                  <div key={f.id} className="rounded-lg border bg-card p-3 flex items-center justify-between opacity-80">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                        {getInitials(f.prestador_nome)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm truncate">{f.prestador_nome}</h3>
                        <p className="text-xs text-muted-foreground">{f.id} • {f.nome_cliente_resolved}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div className="font-bold text-sm">{formatMoeda(f.financeiro.liquidoPrestador)}</div>
                      <Badge variant="secondary" className="text-[10px]">Pago</Badge>
                    </div>
                  </div>
                ))}
                {historicoTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">{historicoTotal} registros</span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={historicoPage === 0} onClick={() => setHistoricoPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <span className="text-sm">{historicoPage + 1} / {historicoTotalPages}</span>
                      <Button variant="outline" size="sm" disabled={historicoPage >= historicoTotalPages - 1} onClick={() => setHistoricoPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detalhesOpen} onOpenChange={setDetalhesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes — {detalhesSel?.id}</DialogTitle>
          </DialogHeader>
          {detalhesSel && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Cliente</div>
                <div className="font-medium">{detalhesSel.nome_cliente_resolved}</div>
                <div className="text-muted-foreground">Prestador</div>
                <div className="font-medium">{detalhesSel.prestador_nome}</div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Mão de Obra</div>
                <div>{formatMoeda(detalhesSel.financeiro.maoObra)}</div>
                <div className="text-muted-foreground">Peças</div>
                <div>{formatMoeda(detalhesSel.financeiro.pecas)}</div>
                <div className="text-muted-foreground">Taxa 24help (23%)</div>
                <div>{formatMoeda(detalhesSel.financeiro.taxa24help)}</div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground font-semibold">Total da OS</div>
                <div className="font-bold text-lg">{formatMoeda(detalhesSel.financeiro.totalOS)}</div>
                <div className="text-muted-foreground font-semibold">Líquido Prestador</div>
                <div className="font-bold">{formatMoeda(detalhesSel.financeiro.liquidoPrestador)}</div>
                <div className="text-muted-foreground">Lucro Bruto</div>
                <div className="font-semibold">{formatMoeda(detalhesSel.financeiro.lucroBruto)}</div>
                <div className="text-muted-foreground">Rentabilidade</div>
                <div>{detalhesSel.financeiro.rentab.toFixed(1)}%</div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Cliente Pagou?</div>
                <div>{detalhesSel.pagamento_realizado ? "✅ Sim" : "❌ Não"}</div>
                {detalhesSel.nps_nota !== null && (
                  <>
                    <div className="text-muted-foreground">NPS</div>
                    <div className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-yellow-500" /> {detalhesSel.nps_nota}</div>
                  </>
                )}
                {detalhesSel.banco && (
                  <>
                    <div className="text-muted-foreground">Banco</div>
                    <div>{detalhesSel.banco}</div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog open={!!confirmCancel} onOpenChange={() => setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              A ficha {confirmCancel?.id} será marcada como Perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmCancel && cancelar(confirmCancel)}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
