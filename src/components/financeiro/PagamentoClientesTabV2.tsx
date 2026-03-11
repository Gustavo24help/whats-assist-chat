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
      <div className="flex gap-3 overflow-x-auto">
        <Card className="min-w-[160px] bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 p-3 shrink-0">
          <div className="text-xs text-amber-600 dark:text-amber-400">Pendentes</div>
          <div className="text-2xl font-bold text-amber-900 dark:text-amber-300">{filteredFichas.length}</div>
        </Card>
        <Card className="min-w-[160px] bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-3 shrink-0">
          <div className="text-xs text-blue-600 dark:text-blue-400">Valor Total Pendente</div>
          <div className="text-xl font-bold text-blue-900 dark:text-blue-300">{formatMoeda(totalPendente)}</div>
        </Card>
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
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filteredFichas.length === 0 ? (
              <div className="text-center py-12"><CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" /><p className="text-muted-foreground">Todos os pagamentos em dia!</p></div>
            ) : (
              filteredFichas.map(f => (
                <Card key={f.id} className="p-4 border-l-4 border-l-amber-500">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm">{f.nome_cliente_resolved}</h3>
                      <p className="text-xs text-muted-foreground">{f.telefone_cliente.replace("whatsapp:+55", "")}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold text-primary">{formatMoeda(f.valor_total)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    <Badge variant="secondary" className="text-xs">{f.id}</Badge>
                    {f.pagamento_tipo && <Badge variant="outline" className="text-xs">{f.pagamento_tipo}</Badge>}
                  </div>
                  {f.pagamento_link && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2 mb-3 text-xs flex items-center gap-2">
                      <ExternalLink className="h-3 w-3 text-blue-600 shrink-0" />
                      <a href={f.pagamento_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">Link</a>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => copyToClipboard(f.pagamento_link!)}><Copy className="h-3 w-3" /></Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={cancelando === f.id} onClick={() => setConfirmCancel(f)}>
                      <Ban className="h-4 w-4 mr-1" /> Cancelar
                    </Button>
                    <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" disabled={markingPaid === f.id} onClick={() => marcarPagou(f)}>
                      {markingPaid === f.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                      Cliente Pagou
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="historico">
          <div className="space-y-3">
            {historicoLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : historico.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum pagamento realizado</div>
            ) : (
              <>
                {historico.map(f => (
                  <Card key={f.id} className="p-3 opacity-80">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm truncate">{f.nome_cliente_resolved}</h3>
                        <p className="text-xs text-muted-foreground">{f.id}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-sm">{formatMoeda(f.valor_total)}</div>
                        <Badge className="bg-green-100 text-green-700 text-[10px]">Pago</Badge>
                      </div>
                    </div>
                  </Card>
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
