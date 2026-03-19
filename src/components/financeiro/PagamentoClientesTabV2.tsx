import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { isBusinessDay } from "@/lib/businessDays2026";
import {
  Loader2, ExternalLink, Copy, Clock, History, Search, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CalendarIcon, Eye, Info,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const formatMoeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const EXCLUDED_FICHAS = ["FS4-260127"];
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
  created_at: string;
  notas: string | null;
  pagamento_visto_por_chefe: boolean;
  data_pagamento_realizada: string | null;
}

/** Count business days between two dates (exclusive of start, inclusive of end) */
function businessDaysBetween(from: Date, to: Date): number {
  let count = 0;
  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  
  if (current >= end) return 0;
  
  const d = new Date(current);
  d.setDate(d.getDate() + 1);
  while (d <= end) {
    if (isBusinessDay(d)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export const PagamentoClientesTabV2 = () => {
  const { toast } = useToast();
  const { isChefe } = useAuth();
  const [subTab, setSubTab] = useState("ativos");
  const [loading, setLoading] = useState(true);
  const [fichasPendentes, setFichasPendentes] = useState<FichaCliente[]>([]);
  const [fichasPagasRecentes, setFichasPagasRecentes] = useState<FichaCliente[]>([]);
  const [fichasProblemas, setFichasProblemas] = useState<FichaCliente[]>([]);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  
  // Pagos recentemente (5 dias úteis)
  const [pagosRecentes5d, setPagosRecentes5d] = useState<FichaCliente[]>([]);
  
  // Histórico (todos os pagos)
  const [historico, setHistorico] = useState<FichaCliente[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoPage, setHistoricoPage] = useState(0);
  const [historicoTotal, setHistoricoTotal] = useState(0);
  
  // Reportar problema
  const [problemaDialog, setProblemaDialog] = useState<FichaCliente | null>(null);
  const [problemaTexto, setProblemaTexto] = useState("");
  const [reportando, setReportando] = useState(false);
  
  // Detalhes
  const [detalhesDialog, setDetalhesDialog] = useState<FichaCliente | null>(null);

  // Track if chefe already marked items as seen in this session
  const markedSeenRef = useRef(false);

  const resolveNames = async (items: any[]): Promise<FichaCliente[]> => {
    if (items.length === 0) return [];
    const phones = [...new Set(items.map((f: any) => f.telefone_cliente))];
    const { data: clientes } = await supabase.from("clientes").select("telefone, nome").in("telefone", phones);
    const map = new Map((clientes || []).map((c: any) => [c.telefone, c.nome]));
    return items.map((f: any) => ({
      ...f,
      nome_cliente_resolved: f.nome_cliente || map.get(f.telefone_cliente) || f.telefone_cliente.replace("whatsapp:+55", ""),
      data_pagamento_realizada: f._data_pagamento_realizada || null,
    }));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    // Fetch pending (not paid, Finalizado)
    const { data: pendentes } = await supabase
      .from("fichas_de_servico")
      .select("id, nome_cliente, telefone_cliente, status, valor_total, pagamento_realizado, pagamento_link, pagamento_tipo, updated_at, created_at, notas, pagamento_visto_por_chefe")
      .or("pagamento_realizado.eq.false,pagamento_realizado.is.null")
      .eq("status", "Finalizado" as any)
      .gt("valor_total", 0)
      .gte("updated_at", FINANCEIRO_CUTOFF)
      .order("updated_at", { ascending: false });

    // Fetch all paid
    const { data: pagos } = await supabase
      .from("fichas_de_servico")
      .select("id, nome_cliente, telefone_cliente, status, valor_total, pagamento_realizado, pagamento_link, pagamento_tipo, updated_at, created_at, notas, pagamento_visto_por_chefe")
      .eq("pagamento_realizado", true)
      .gt("valor_total", 0)
      .gte("updated_at", FINANCEIRO_CUTOFF)
      .order("updated_at", { ascending: false });

    const filteredPendentes = (pendentes || []).filter((f: any) => !EXCLUDED_FICHAS.includes(f.id));
    const filteredPagos = (pagos || []).filter((f: any) => !EXCLUDED_FICHAS.includes(f.id));
    
    // For paid items, get data_pagamento_realizada from transacoes
    const pagoIds = filteredPagos.map((f: any) => f.id);
    let transacoesMap = new Map<string, string>();
    if (pagoIds.length > 0) {
      const { data: transacoes } = await supabase
        .from("transacoes_financeiras")
        .select("ficha_id, data_pagamento_realizada")
        .in("ficha_id", pagoIds)
        .not("data_pagamento_realizada", "is", null);
      (transacoes || []).forEach((t: any) => {
        transacoesMap.set(t.ficha_id, t.data_pagamento_realizada);
      });
    }

    const pagosWithDate = filteredPagos.map((f: any) => ({
      ...f,
      _data_pagamento_realizada: transacoesMap.get(f.id) || f.updated_at,
    }));

    const now = new Date();

    // "Pendentes e pagos recentemente" tab: paid within 1 bday OR not seen by chefe
    const recentesParaAba1 = pagosWithDate.filter((f: any) => {
      const payDate = new Date(f._data_pagamento_realizada || f.updated_at);
      const bDays = businessDaysBetween(payDate, now);
      const isRecent = bDays <= 1;
      const notSeen = !f.pagamento_visto_por_chefe;
      return isRecent || notSeen;
    });

    // "Pagos Recentemente" tab: paid within 5 bdays (all, no pendentes)
    const recentesParaAba2 = pagosWithDate.filter((f: any) => {
      const payDate = new Date(f._data_pagamento_realizada || f.updated_at);
      const bDays = businessDaysBetween(payDate, now);
      return bDays <= 5;
    });

    // "Problemas Reportados" tab: notas contain [PROBLEMA PAGAMENTO
    const problemas = filteredPagos.concat(filteredPendentes).filter((f: any) => 
      f.notas?.includes("[PROBLEMA PAGAMENTO")
    );

    const resolvedPendentes = await resolveNames(filteredPendentes);
    const resolvedRecentes1 = await resolveNames(recentesParaAba1);
    const resolvedRecentes2 = await resolveNames(recentesParaAba2);
    const resolvedProblemas = await resolveNames(
      // deduplicate
      [...new Map(problemas.map((f: any) => [f.id, f])).values()]
    );

    setFichasPendentes(resolvedPendentes);
    setFichasPagasRecentes(resolvedRecentes1);
    setPagosRecentes5d(resolvedRecentes2);
    setFichasProblemas(resolvedProblemas);
    setLoading(false);
  }, []);

  const fetchHistorico = useCallback(async () => {
    setHistoricoLoading(true);
    const { data, count } = await supabase
      .from("fichas_de_servico")
      .select("id, nome_cliente, telefone_cliente, status, valor_total, pagamento_realizado, pagamento_link, pagamento_tipo, updated_at, created_at, notas, pagamento_visto_por_chefe", { count: "exact" })
      .eq("pagamento_realizado", true)
      .gt("valor_total", 0)
      .gte("updated_at", FINANCEIRO_CUTOFF)
      .order("updated_at", { ascending: false })
      .range(historicoPage * PAGE_SIZE, (historicoPage + 1) * PAGE_SIZE - 1);

    const filtered = (data || []).filter((f: any) => !EXCLUDED_FICHAS.includes(f.id));
    setHistorico(await resolveNames(filtered));
    setHistoricoTotal(count || 0);
    setHistoricoLoading(false);
  }, [historicoPage]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (subTab === "historico") fetchHistorico(); }, [subTab, fetchHistorico]);

  // When a chefe views the tab, mark unseen items as seen
  useEffect(() => {
    if (!isChefe || markedSeenRef.current || loading) return;
    
    const unseenIds = fichasPagasRecentes
      .filter(f => !f.pagamento_visto_por_chefe)
      .map(f => f.id);
    
    if (unseenIds.length === 0) return;
    
    markedSeenRef.current = true;
    
    const timeout = setTimeout(async () => {
      for (const id of unseenIds) {
        await supabase.from("fichas_de_servico")
          .update({ pagamento_visto_por_chefe: true } as any)
          .eq("id", id);
      }
      setFichasPagasRecentes(prev => prev.map(f => 
        unseenIds.includes(f.id) ? { ...f, pagamento_visto_por_chefe: true } : f
      ));
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [isChefe, fichasPagasRecentes, loading]);

  const reportarProblema = async () => {
    if (!problemaDialog || !problemaTexto.trim()) {
      toast({ title: "Digite a descrição do problema", variant: "destructive" });
      return;
    }
    setReportando(true);
    const agora = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    const notaAtual = problemaDialog.notas || "";
    const novaNota = `${notaAtual}\n[PROBLEMA PAGAMENTO ${agora}] ${problemaTexto.trim()}`.trim();
    
    await supabase.from("fichas_de_servico")
      .update({ notas: novaNota } as any)
      .eq("id", problemaDialog.id);
    
    toast({ title: "⚠️ Problema reportado na ficha" });
    setProblemaDialog(null);
    setProblemaTexto("");
    setReportando(false);
    fetchData(); // Refresh to show in problemas tab
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: text });
  };

  // Filtering
  const applyFilters = (items: FichaCliente[]) => {
    let result = items;
    if (filterDate) {
      const start = new Date(filterDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filterDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter(f => {
        const d = new Date(f.updated_at);
        return d >= start && d <= end;
      });
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(f => f.nome_cliente_resolved.toLowerCase().includes(s) || f.id.toLowerCase().includes(s));
    }
    return result;
  };

  const filteredPendentes = applyFilters(fichasPendentes);
  const filteredRecentes = applyFilters(fichasPagasRecentes);
  const filteredPagos5d = applyFilters(pagosRecentes5d);
  const filteredProblemas = applyFilters(fichasProblemas);
  const allAtivos = [...filteredPendentes, ...filteredRecentes.filter(f => !filteredPendentes.some(p => p.id === f.id))];
  
  const totalPendente = filteredPendentes.reduce((s, f) => s + (f.valor_total || 0), 0);
  const historicoTotalPages = Math.ceil(historicoTotal / PAGE_SIZE);
  const unseenCount = filteredRecentes.filter(f => !f.pagamento_visto_por_chefe).length;

  const formatDateShort = (d: string) => format(new Date(d), "dd/MM HH:mm", { locale: ptBR });

  const extractProblemaText = (notas: string | null): string[] => {
    if (!notas) return [];
    const matches = notas.match(/\[PROBLEMA PAGAMENTO [^\]]*\] [^\n]*/g);
    return matches || [];
  };

  const renderFichaCard = (f: FichaCliente) => {
    const isPago = f.pagamento_realizado;
    const shouldBlink = isPago && !f.pagamento_visto_por_chefe;
    const isAutoConfirmed = f.notas?.includes("automaticamente via Asaas") || false;
    
    return (
      <div
        key={f.id}
        className={cn(
          "rounded-lg border bg-card p-4 transition-all",
          isPago && "border-green-300 dark:border-green-800",
          !isPago && "border-amber-300 dark:border-amber-800",
          shouldBlink && "animate-pulse border-green-500 dark:border-green-500 shadow-md shadow-green-200 dark:shadow-green-900/50"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">{f.nome_cliente_resolved}</h3>
              {isPago ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 text-[10px] shrink-0">
                  <CheckCircle2 className="h-3 w-3 mr-0.5" /> Pago
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-400 dark:text-amber-400 text-[10px] shrink-0">
                  <Clock className="h-3 w-3 mr-0.5" /> Pendente
                </Badge>
              )}
              {isAutoConfirmed && (
                <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-600 dark:text-blue-400 shrink-0">Auto</Badge>
              )}
              {shouldBlink && (
                <Badge className="bg-green-500 text-white text-[10px] shrink-0 animate-bounce">Novo!</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">{f.id}</Badge>
              <span className="text-[10px] text-muted-foreground">{f.status}</span>
              {f.pagamento_tipo && <Badge variant="outline" className="text-[10px]">{f.pagamento_tipo}</Badge>}
              <span className="text-[10px] text-muted-foreground">{formatDateShort(f.updated_at)}</span>
            </div>
            {f.pagamento_link && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                <a href={f.pagamento_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[180px]">Link pagamento</a>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => copyToClipboard(f.pagamento_link!)}><Copy className="h-3 w-3" /></Button>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="text-xl font-bold">{formatMoeda(f.valor_total)}</div>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() => setDetalhesDialog(f)}
              >
                <Info className="h-3.5 w-3.5 mr-1" /> Detalhes
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 text-xs text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950/30"
                onClick={() => { setProblemaDialog(f); setProblemaTexto(""); }}
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Reportar Problema
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-3 overflow-x-auto">
        <div className="min-w-[140px] rounded-lg border bg-card p-3 shrink-0">
          <div className="text-xs text-muted-foreground">Pendentes</div>
          <div className="text-2xl font-bold">{filteredPendentes.length}</div>
        </div>
        <div className="min-w-[180px] rounded-lg border bg-card p-3 shrink-0">
          <div className="text-xs text-muted-foreground">Valor Pendente</div>
          <div className="text-xl font-bold">{formatMoeda(totalPendente)}</div>
        </div>
        <div className="min-w-[140px] rounded-lg border bg-card p-3 shrink-0">
          <div className="text-xs text-muted-foreground">Pagos Recentes</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{filteredRecentes.length}</div>
        </div>
        {filteredProblemas.length > 0 && (
          <div className="min-w-[140px] rounded-lg border border-destructive/30 bg-card p-3 shrink-0">
            <div className="text-xs text-destructive">Problemas</div>
            <div className="text-2xl font-bold text-destructive">{filteredProblemas.length}</div>
          </div>
        )}
      </div>

      {/* Search + Date filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente ou ficha..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !filterDate && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filterDate ? format(filterDate, "dd/MM/yyyy", { locale: ptBR }) : "Todas as datas"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filterDate} onSelect={setFilterDate} initialFocus className="p-3 pointer-events-auto" />
            <div className="border-t p-2">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilterDate(undefined)}>Todas as datas</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="mb-3 flex-wrap h-auto gap-1">
          <TabsTrigger value="ativos" className="gap-1.5 text-xs">
            <Eye className="h-3.5 w-3.5" /> Pendentes e pagos recentemente
            {unseenCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold animate-pulse">
                {unseenCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" /> Somente Pendentes
            {filteredPendentes.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {filteredPendentes.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pagos_recentes" className="gap-1.5 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" /> Pagos Recentemente
          </TabsTrigger>
          <TabsTrigger value="problemas" className="gap-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5" /> Problemas Reportados
            {filteredProblemas.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                {filteredProblemas.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" /> Todos os Pagos
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Pendentes e pagos recentemente */}
        <TabsContent value="ativos">
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : allAtivos.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum pagamento pendente ou recente!</p>
              </div>
            ) : (
              <>
                {filteredRecentes
                  .sort((a, b) => {
                    if (!a.pagamento_visto_por_chefe && b.pagamento_visto_por_chefe) return -1;
                    if (a.pagamento_visto_por_chefe && !b.pagamento_visto_por_chefe) return 1;
                    return 0;
                  })
                  .map(renderFichaCard)}
                {filteredRecentes.length > 0 && filteredPendentes.length > 0 && (
                  <div className="flex items-center gap-3 py-2">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground font-medium">Aguardando Pagamento</span>
                    <Separator className="flex-1" />
                  </div>
                )}
                {filteredPendentes.map(renderFichaCard)}
              </>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Pagos Recentemente (5 dias úteis) */}
        <TabsContent value="pagos_recentes">
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filteredPagos5d.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum pagamento nos últimos 5 dias úteis</div>
            ) : (
              filteredPagos5d.map(f => {
                const isAutoConfirmed = f.notas?.includes("automaticamente via Asaas") || false;
                return (
                  <div key={f.id} className="rounded-lg border border-green-200 dark:border-green-900 bg-card p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm truncate">{f.nome_cliente_resolved}</h3>
                      <p className="text-xs text-muted-foreground">{f.id} • {f.status} • {formatDateShort(f.updated_at)}</p>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div className="font-bold text-sm">{formatMoeda(f.valor_total)}</div>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Pago</Badge>
                      {isAutoConfirmed && (
                        <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-600 dark:text-blue-400">Auto</Badge>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDetalhesDialog(f)}>
                        <Info className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Problemas Reportados */}
        <TabsContent value="problemas">
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filteredProblemas.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum problema reportado</div>
            ) : (
              filteredProblemas.map(f => {
                const problemas = extractProblemaText(f.notas);
                return (
                  <div key={f.id} className="rounded-lg border border-destructive/40 bg-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">{f.nome_cliente_resolved}</h3>
                          <Badge variant="secondary" className="text-[10px]">{f.id}</Badge>
                          {f.pagamento_realizado ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 text-[10px]">Pago</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-400 text-[10px]">Pendente</Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{formatDateShort(f.updated_at)}</span>
                      </div>
                      <div className="text-xl font-bold shrink-0">{formatMoeda(f.valor_total)}</div>
                    </div>
                    <div className="space-y-1">
                      {problemas.map((p, i) => (
                        <div key={i} className="text-xs bg-destructive/10 text-destructive dark:bg-destructive/20 rounded px-2 py-1.5 flex items-start gap-1.5">
                          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDetalhesDialog(f)}>
                        <Info className="h-3.5 w-3.5 mr-1" /> Detalhes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700"
                        onClick={() => { setProblemaDialog(f); setProblemaTexto(""); }}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Novo Problema
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Tab 4: Todos os Pagos (histórico) */}
        <TabsContent value="historico">
          <div className="space-y-2">
            {historicoLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : historico.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum pagamento realizado</div>
            ) : (
              <>
                {historico.map(f => {
                  const isAutoConfirmed = f.notas?.includes("automaticamente via Asaas") || false;
                  return (
                    <div key={f.id} className="rounded-lg border bg-card p-3 flex items-center justify-between opacity-80">
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm truncate">{f.nome_cliente_resolved}</h3>
                        <p className="text-xs text-muted-foreground">{f.id} • {formatDateShort(f.updated_at)}</p>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div className="font-bold text-sm">{formatMoeda(f.valor_total)}</div>
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Pago</Badge>
                        {isAutoConfirmed && (
                          <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-600 dark:text-blue-400">Auto</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
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

      {/* Detalhes Dialog */}
      <Dialog open={!!detalhesDialog} onOpenChange={(open) => { if (!open) setDetalhesDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Detalhes do Pagamento
            </DialogTitle>
          </DialogHeader>
          {detalhesDialog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{detalhesDialog.nome_cliente_resolved}</span>
                <span className="text-muted-foreground">Ficha</span>
                <span className="font-medium">{detalhesDialog.id}</span>
                <span className="text-muted-foreground">Status Ficha</span>
                <span className="font-medium">{detalhesDialog.status}</span>
                <span className="text-muted-foreground">Data Criação</span>
                <span className="font-medium">{format(new Date(detalhesDialog.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                {detalhesDialog.pagamento_tipo && (
                  <>
                    <span className="text-muted-foreground">Forma Pagamento</span>
                    <span className="font-medium">{detalhesDialog.pagamento_tipo}</span>
                  </>
                )}
                <span className="text-muted-foreground">Status Pagamento</span>
                <span className="font-medium">{detalhesDialog.pagamento_realizado ? "✅ Pago" : "⏳ Pendente"}</span>
              </div>
              <Separator />
              <div className="rounded-lg bg-muted/50 border p-3 flex items-center justify-between">
                <span className="font-semibold">Valor Total</span>
                <span className="text-xl font-bold">{formatMoeda(detalhesDialog.valor_total)}</span>
              </div>
              {detalhesDialog.pagamento_link && (
                <div className="flex items-center gap-2 text-xs">
                  <ExternalLink className="h-3 w-3" />
                  <a href={detalhesDialog.pagamento_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                    {detalhesDialog.pagamento_link}
                  </a>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => copyToClipboard(detalhesDialog.pagamento_link!)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {detalhesDialog.notas && (
                <>
                  <Separator />
                  <div>
                    <span className="text-xs text-muted-foreground font-medium">Notas</span>
                    <p className="text-xs mt-1 whitespace-pre-wrap bg-muted/30 rounded p-2">{detalhesDialog.notas}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reportar Problema Dialog */}
      <Dialog open={!!problemaDialog} onOpenChange={(open) => { if (!open) { setProblemaDialog(null); setProblemaTexto(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Reportar Problema
            </DialogTitle>
          </DialogHeader>
          {problemaDialog && (
            <div className="space-y-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Ficha:</span>{" "}
                <span className="font-medium">{problemaDialog.id}</span>
                {" — "}
                <span className="font-medium">{problemaDialog.nome_cliente_resolved}</span>
                {" — "}
                <span className="font-bold">{formatMoeda(problemaDialog.valor_total)}</span>
              </div>
              <Textarea
                placeholder="Descreva o problema com o pagamento..."
                value={problemaTexto}
                onChange={(e) => setProblemaTexto(e.target.value)}
                rows={3}
              />
              <Button
                className="w-full"
                variant="outline"
                disabled={reportando || !problemaTexto.trim()}
                onClick={reportarProblema}
              >
                {reportando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
                Registrar Problema
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
