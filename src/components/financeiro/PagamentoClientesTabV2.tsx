import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, Loader2, ExternalLink, Copy, Clock, Ban, History, ChevronLeft, ChevronRight, Search,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const formatMoeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const EXCLUDED_FICHAS = ["FS4-260127"];
// Cutoff: only show fichas updated after financial reset (2026-03-13)
const FINANCEIRO_CUTOFF = "2026-03-13T23:00:00.000Z";
const PAGE_SIZE = 20;

interface FichaCliente {
  id: string;
  nome_cliente_resolved: string;
  telefone_cliente: string;
  status: string;
  valor_total: number;
  pagamento_realizado: boolean;
  pagamento_link: string | null;
  pagamento_tipo: string | null;
  updated_at: string;
}

export const PagamentoClientesTabV2 = () => {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState("pendentes");
  const [loading, setLoading] = useState(true);
  const [fichas, setFichas] = useState<FichaCliente[]>([]);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<FichaCliente | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [historico, setHistorico] = useState<FichaCliente[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoPage, setHistoricoPage] = useState(0);
  const [historicoTotal, setHistoricoTotal] = useState(0);

  const resolveNames = async (items: any[]): Promise<FichaCliente[]> => {
    if (items.length === 0) return [];
    const phones = [...new Set(items.map((f: any) => f.telefone_cliente))];
    const { data: clientes } = await supabase.from("clientes").select("telefone, nome").in("telefone", phones);
    const map = new Map((clientes || []).map((c: any) => [c.telefone, c.nome]));
    return items.map((f: any) => ({
      ...f,
      nome_cliente_resolved: f.nome_cliente || map.get(f.telefone_cliente) || f.telefone_cliente.replace("whatsapp:+55", ""),
    }));
  };

  const fetchPendentes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fichas_de_servico")
      .select("id, nome_cliente, telefone_cliente, status, valor_total, pagamento_realizado, pagamento_link, pagamento_tipo, updated_at")
      .eq("pagamento_realizado", false)
      .eq("status", "Finalizado" as any)
      .gt("valor_total", 0)
      .gte("updated_at", FINANCEIRO_CUTOFF)
      .order("updated_at", { ascending: false });
    if (!error) {
      const filtered = (data || []).filter((f: any) => !EXCLUDED_FICHAS.includes(f.id));
      setFichas(await resolveNames(filtered));
    }
    setLoading(false);
  }, []);

  const fetchHistorico = useCallback(async () => {
    setHistoricoLoading(true);
    const { data, error, count } = await supabase
      .from("fichas_de_servico")
      .select("id, nome_cliente, telefone_cliente, status, valor_total, pagamento_realizado, pagamento_link, pagamento_tipo, updated_at", { count: "exact" })
      .eq("pagamento_realizado", true)
      .gt("valor_total", 0)
      .gte("updated_at", FINANCEIRO_CUTOFF)
      .order("updated_at", { ascending: false })
      .range(historicoPage * PAGE_SIZE, (historicoPage + 1) * PAGE_SIZE - 1);
    if (!error) {
      const filtered = (data || []).filter((f: any) => !EXCLUDED_FICHAS.includes(f.id));
      setHistorico(await resolveNames(filtered));
      setHistoricoTotal(count || 0);
    }
    setHistoricoLoading(false);
  }, [historicoPage]);

  useEffect(() => { fetchPendentes(); }, [fetchPendentes]);
  useEffect(() => { if (subTab === "historico") fetchHistorico(); }, [subTab, fetchHistorico]);

  const marcarPagou = async (ficha: FichaCliente) => {
    setMarkingPaid(ficha.id);
    const agora = new Date().toISOString();
    const { error } = await supabase.from("fichas_de_servico").update({ pagamento_realizado: true } as any).eq("id", ficha.id);
    if (!error) {
      await supabase.from("transacoes_financeiras")
        .update({ status_pagamento_cliente: "pago", data_pagamento_realizada: agora } as any)
        .eq("ficha_id", ficha.id);
      toast({ title: "✅ Pagamento do cliente confirmado!" });
      setFichas(prev => prev.filter(f => f.id !== ficha.id));
    }
    setMarkingPaid(null);
  };

  const cancelar = async (ficha: FichaCliente) => {
    setCancelando(ficha.id);
    setConfirmCancel(null);
    await supabase.from("fichas_de_servico")
      .update({ status: "Perdido", motivo_perda: "Pagamento cancelado/não realizado" } as any)
      .eq("id", ficha.id);
    toast({ title: "Pagamento cancelado" });
    setFichas(prev => prev.filter(f => f.id !== ficha.id));
    setCancelando(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: text });
  };

  const filteredFichas = search
    ? fichas.filter(f => f.nome_cliente_resolved.toLowerCase().includes(search.toLowerCase()) || f.id.toLowerCase().includes(search.toLowerCase()))
    : fichas;

  const totalPendente = filteredFichas.reduce((s, f) => s + (f.valor_total || 0), 0);
  const historicoTotalPages = Math.ceil(historicoTotal / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Summary - clean design */}
      <div className="flex gap-3 overflow-x-auto">
        <div className="min-w-[140px] rounded-lg border bg-card p-3 shrink-0">
          <div className="text-xs text-muted-foreground">Pendentes</div>
          <div className="text-2xl font-bold">{filteredFichas.length}</div>
        </div>
        <div className="min-w-[180px] rounded-lg border bg-card p-3 shrink-0">
          <div className="text-xs text-muted-foreground">Valor Total Pendente</div>
          <div className="text-xl font-bold">{formatMoeda(totalPendente)}</div>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar cliente ou ficha..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="mb-3">
          <TabsTrigger value="pendentes" className="gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" /> Pendentes</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 text-xs"><History className="h-3.5 w-3.5" /> Pagos</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filteredFichas.length === 0 ? (
              <div className="text-center py-12"><CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" /><p className="text-muted-foreground">Todos os pagamentos em dia!</p></div>
            ) : (
              filteredFichas.map(f => (
                <div key={f.id} className="rounded-lg border bg-card p-4 flex items-center gap-4">
                  {/* Left: Client info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{f.nome_cliente_resolved}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px]">{f.id}</Badge>
                      {f.pagamento_tipo && <Badge variant="outline" className="text-[10px]">{f.pagamento_tipo}</Badge>}
                    </div>
                    {f.pagamento_link && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        <a href={f.pagamento_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[180px]">Link pagamento</a>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => copyToClipboard(f.pagamento_link!)}><Copy className="h-3 w-3" /></Button>
                      </div>
                    )}
                  </div>

                  {/* Center: Value */}
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold">{formatMoeda(f.valor_total)}</div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 h-9 px-3" disabled={cancelando === f.id} onClick={() => setConfirmCancel(f)}>
                      <Ban className="h-4 w-4" />
                    </Button>
                    <Button size="sm" className="h-9 px-4" disabled={markingPaid === f.id} onClick={() => marcarPagou(f)}>
                      {markingPaid === f.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                      Cliente Pagou
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
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm truncate">{f.nome_cliente_resolved}</h3>
                      <p className="text-xs text-muted-foreground">{f.id}</p>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div className="font-bold text-sm">{formatMoeda(f.valor_total)}</div>
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

      <AlertDialog open={!!confirmCancel} onOpenChange={() => setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pagamento?</AlertDialogTitle>
            <AlertDialogDescription>A ficha {confirmCancel?.id} será marcada como Perdido.</AlertDialogDescription>
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
