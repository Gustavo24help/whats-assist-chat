import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isBusinessDay } from "@/lib/businessDays2026";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2, Loader2, Copy, CreditCard, ChevronLeft, ChevronRight,
  History, DollarSign, Info, Ban, Search, Star, Building2, X, CalendarIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const formatMoeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const EXCLUDED_FICHAS = ["FS4-260127"];
const PAGE_SIZE = 20;

function addBusinessDays(date: Date | string, n: number): Date {
  const d = new Date(date);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) added++;
  }
  return d;
}

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
  const materialPago24help = ficha.material_pago_24help === true;
  // Se material pago pela empresa, prestador recebe só MO; senão MO + peças
  const liquidoPrestador = materialPago24help ? maoObra + taxaVisita : maoObra + pecas + taxaVisita;
  const desconto = 0;
  const lucroBruto = totalOS - liquidoPrestador - (materialPago24help ? pecas : 0);
  const rentab = totalOS > 0 ? (lucroBruto / totalOS) * 100 : 0;

  return {
    maoObra, pecas, taxaVisita, adiantCliente, adiantPrestador,
    taxa24help: Math.max(taxa24help, 0), totalOS, liquidoPrestador,
    desconto, lucroBruto: Math.max(lucroBruto, 0), rentab: Math.max(rentab, 0),
    materialPago24help,
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
  data_pagamento_prevista: Date;
  data_pagamento_realizada: Date | null;
  observacao_financeira: string | null;
  observacao_financeira_por: string | null;
  observacao_operador_nome: string | null;
  tipo_troca: string | null;
  justificativa_troca: string | null;
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
  const [pagamentoConfirm, setPagamentoConfirm] = useState<FichaFinanceira | null>(null);
  const [dataPagamentoCustom, setDataPagamentoCustom] = useState<Date | undefined>(undefined);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [historico, setHistorico] = useState<FichaFinanceira[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoPage, setHistoricoPage] = useState(0);
  const [historicoTotal, setHistoricoTotal] = useState(0);
  const [popupsEnabled, setPopupsEnabled] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchPaying, setBatchPaying] = useState(false);
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [filterDateFim, setFilterDateFim] = useState<Date | undefined>(undefined);
  const [showAllDates, setShowAllDates] = useState(true);
  const [filterMode, setFilterMode] = useState<"single" | "range">("single");
  const [obsPopup, setObsPopup] = useState<FichaFinanceira | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pagarTodosSelecionados = async () => {
    const selected = filteredPendentes.filter(f => selectedIds.has(f.id));
    if (selected.length === 0) return;
    setBatchPaying(true);
    for (const ficha of selected) {
      await marcarPago(ficha);
    }
    setSelectedIds(new Set());
    setBatchPaying(false);
    toast({ title: `✅ ${selected.length} pagamento${selected.length > 1 ? "s" : ""} confirmado${selected.length > 1 ? "s" : ""}!` });
  };

  const buildList = useCallback(async (pagoFilter: boolean) => {
    // Query all Finalizado fichas with valor > 0 and a prestador assigned
    let query = supabase
      .from("fichas_de_servico")
      .select("id, nome_ficha, nome_cliente, telefone_cliente, status, valor_total, valor_mao_obra, valor_pecas, prestador_id, pagamento_realizado, pagamento_link, updated_at, created_at, observacao_financeira, observacao_financeira_por, material_pago_24help", { count: "exact" })
      .eq("status", "Finalizado" as any)
      .gt("valor_total", 0)
      .not("prestador_id", "is", null)
      .order("created_at", { ascending: false });

    const { data: fichasData, error, count } = await query;
    if (error) throw error;

    const fichas = (fichasData || []).filter((f: any) => {
      if (EXCLUDED_FICHAS.includes(f.id)) return false;
      return true;
    });
    if (fichas.length === 0) return { items: [] as FichaFinanceira[], total: count || 0 };

    const prestadorIds = [...new Set(fichas.map((f: any) => f.prestador_id))];
    const phones = [...new Set(fichas.map((f: any) => f.telefone_cliente))];
    const fichaIds = fichas.map((f: any) => f.id);
    const obsOperadorIds = [...new Set(fichas.map((f: any) => f.observacao_financeira_por).filter(Boolean))];

    // Fetch finalization dates from status history for fallback payment date calculation
    const finalizacaoRes = await supabase
      .from("ficha_status_historico")
      .select("ficha_id, data_inicio")
      .in("ficha_id", fichaIds)
      .eq("status_novo", "Finalizado" as any)
      .order("created_at", { ascending: true });
    
    // Map: ficha_id → first (earliest) finalization date
    const finalizacaoMap = new Map<string, string>();
    for (const h of (finalizacaoRes.data || [])) {
      if (!finalizacaoMap.has(h.ficha_id)) {
        finalizacaoMap.set(h.ficha_id, h.data_inicio);
      }
    }

    const [prestRes, clienteRes, transRes, npsRes, profilesRes] = await Promise.all([
      supabase.from("prestadores").select("cpf, nome, chave_pix, nome_pix, banco").in("cpf", prestadorIds),
      supabase.from("clientes").select("telefone, nome").in("telefone", phones),
      supabase.from("transacoes_financeiras").select("ficha_id, status_pagamento_prestador, data_pagamento_prevista, data_pagamento_realizada, tipo_troca, justificativa_troca").in("ficha_id", fichaIds),
      supabase.from("nps_respostas").select("ficha_id, nota").in("ficha_id", fichaIds),
      obsOperadorIds.length > 0
        ? supabase.from("profiles").select("id, full_name").in("id", obsOperadorIds)
        : Promise.resolve({ data: [] }),
    ]);

    const prestMap = new Map((prestRes.data || []).map((p: any) => [p.cpf, p]));
    const clienteMap = new Map((clienteRes.data || []).map((c: any) => [c.telefone, c.nome]));
    const transMap = new Map((transRes.data || []).map((t: any) => [t.ficha_id, t]));
    const npsMap = new Map((npsRes.data || []).map((n: any) => [n.ficha_id, n.nota]));
    const profilesMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.full_name]));

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
        data_pagamento_prevista: trans?.data_pagamento_prevista ? new Date(trans.data_pagamento_prevista) : addBusinessDays(finalizacaoMap.get(f.id) || f.updated_at || f.created_at, 2),
        data_pagamento_realizada: trans?.data_pagamento_realizada ? new Date(trans.data_pagamento_realizada) : null,
        observacao_financeira: f.observacao_financeira || null,
        observacao_financeira_por: f.observacao_financeira_por || null,
        observacao_operador_nome: f.observacao_financeira_por ? (profilesMap.get(f.observacao_financeira_por) || null) : null,
        tipo_troca: trans?.tipo_troca || null,
        justificativa_troca: trans?.justificativa_troca || null,
      };
    });

    // Separate by pago_prestador status
    const filtered = items.filter((i) => i.pago_prestador === pagoFilter);
    return { items: filtered, total: filtered.length || count || 0 };
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
      const { items, total } = await buildList(true);
      setHistorico(items);
      setHistoricoTotal(total);
    } catch (e) { console.error(e); }
    finally { setHistoricoLoading(false); }
  }, [buildList]);

  useEffect(() => { fetchPendentes(); }, [fetchPendentes]);
  useEffect(() => { if (subTab === "historico") fetchHistorico(); }, [subTab, fetchHistorico]);
  useEffect(() => {
    setHistoricoPage(0);
  }, [search, showAllDates, filterMode, filterDate, filterDateFim]);

  const marcarPago = async (ficha: FichaFinanceira, customDate?: Date) => {
    try {
      setMarkingPaid(ficha.id);
      const agora = customDate ? customDate.toISOString() : new Date().toISOString();

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
          data_pagamento_prevista: ficha.data_pagamento_prevista.toISOString(),
          data_pagamento_realizada: agora,
        } as any);
      }

      await supabase.from("fichas_de_servico")
        .update({ webhook_pendente: true } as any)
        .eq("id", ficha.id);

      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        await fetch(`https://${projectId}.supabase.co/functions/v1/webhook-update-planilha`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ficha_id: ficha.id,
            acao: "pagamento_prestador",
            prestador_nome: ficha.prestador_nome,
            prestador_cpf: ficha.prestador_cpf,
            status_pagamento_prestador: "pago",
            data_pagamento_realizada: agora,
            valor_a_pagar_prestador: ficha.financeiro.liquidoPrestador,
            valor_total: ficha.valor_total,
            cliente_nome: ficha.nome_cliente_resolved,
          }),
        });
      } catch (webhookErr) {
        console.error("[marcarPago] Erro ao chamar webhook-update-planilha:", webhookErr);
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

  const handlePayClick = (ficha: FichaFinanceira) => {
    if (popupsEnabled) {
      setPagamentoConfirm(ficha);
    } else {
      marcarPago(ficha);
    }
  };

  const dateFilteredPendentes = (() => {
    if (showAllDates) return pendentes;
    if (filterMode === "single" && filterDate) {
      const start = new Date(filterDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filterDate);
      end.setHours(23, 59, 59, 999);
      return pendentes.filter(f => f.data_pagamento_prevista >= start && f.data_pagamento_prevista <= end);
    }
    if (filterMode === "range") {
      return pendentes.filter(f => {
        if (filterDate) {
          const start = new Date(filterDate);
          start.setHours(0, 0, 0, 0);
          if (f.data_pagamento_prevista < start) return false;
        }
        if (filterDateFim) {
          const end = new Date(filterDateFim);
          end.setHours(23, 59, 59, 999);
          if (f.data_pagamento_prevista > end) return false;
        }
        return filterDate || filterDateFim;
      });
    }
    return pendentes;
  })();

  const applyDateFilter = (items: FichaFinanceira[], dateField: "data_pagamento_prevista" | "data_pagamento_realizada") => {
    if (showAllDates) return items;
    if (filterMode === "single" && filterDate) {
      const start = new Date(filterDate); start.setHours(0, 0, 0, 0);
      const end = new Date(filterDate); end.setHours(23, 59, 59, 999);
      return items.filter(f => {
        const d = dateField === "data_pagamento_realizada" ? f.data_pagamento_realizada : f.data_pagamento_prevista;
        if (!d) return false;
        return d >= start && d <= end;
      });
    }
    if (filterMode === "range") {
      return items.filter(f => {
        const d = dateField === "data_pagamento_realizada" ? f.data_pagamento_realizada : f.data_pagamento_prevista;
        if (!d) return false;
        if (filterDate) { const s = new Date(filterDate); s.setHours(0, 0, 0, 0); if (d < s) return false; }
        if (filterDateFim) { const e = new Date(filterDateFim); e.setHours(23, 59, 59, 999); if (d > e) return false; }
        return filterDate || filterDateFim;
      });
    }
    return items;
  };

  const filteredPendentes = search
    ? dateFilteredPendentes.filter(f =>
      f.prestador_nome.toLowerCase().includes(search.toLowerCase()) ||
      f.nome_cliente_resolved.toLowerCase().includes(search.toLowerCase()) ||
      f.id.toLowerCase().includes(search.toLowerCase())
    )
    : dateFilteredPendentes;

  const dateFilteredHistorico = applyDateFilter(historico, "data_pagamento_realizada");
  const filteredHistorico = search
    ? dateFilteredHistorico.filter(f =>
      f.prestador_nome.toLowerCase().includes(search.toLowerCase()) ||
      f.nome_cliente_resolved.toLowerCase().includes(search.toLowerCase()) ||
      f.id.toLowerCase().includes(search.toLowerCase())
    )
    : dateFilteredHistorico;
  const paginatedHistorico = filteredHistorico.slice(historicoPage * PAGE_SIZE, (historicoPage + 1) * PAGE_SIZE);

  const totalAPagar = filteredPendentes.reduce((s, f) => s + f.financeiro.liquidoPrestador, 0);
  const totalPago = filteredHistorico.reduce((s, f) => s + f.financeiro.liquidoPrestador, 0);
  const historicoTotalPages = Math.ceil(filteredHistorico.length / PAGE_SIZE);

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (parts[0]?.[0] || "?").toUpperCase();
  };

  const formatDateShort = (d: Date | string) => format(new Date(d), "dd/MM", { locale: ptBR });
  const formatDateFull = (d: Date | string) => format(new Date(d), "dd/MM/yyyy", { locale: ptBR });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-3 overflow-x-auto">
        <div className="min-w-[140px] rounded-lg border bg-card p-3 shrink-0">
          <div className="text-xs text-muted-foreground">{subTab === "pendentes" ? "Pendentes" : "Pagos"}</div>
          <div className="text-2xl font-bold">{subTab === "pendentes" ? filteredPendentes.length : filteredHistorico.length}</div>
        </div>
        <div className="min-w-[180px] rounded-lg border bg-card p-3 shrink-0">
          <div className="text-xs text-muted-foreground">{subTab === "pendentes" ? "Total a Pagar" : "Total Pago"}</div>
          <div className="text-xl font-bold">{formatMoeda(subTab === "pendentes" ? totalAPagar : totalPago)}</div>
        </div>
      </div>

      {/* Search + Date Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar prestador, cliente, ficha..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showAllDates ? "default" : "outline"}
            size="sm"
            className="h-9 text-xs"
            onClick={() => { setShowAllDates(true); setFilterDate(undefined); setFilterDateFim(undefined); }}
          >
            Todas
          </Button>
          <Button
            variant={!showAllDates && filterMode === "single" ? "default" : "outline"}
            size="sm"
            className="h-9 text-xs"
            onClick={() => { setShowAllDates(false); setFilterMode("single"); setFilterDateFim(undefined); }}
          >
            Data fixa
          </Button>
          <Button
            variant={!showAllDates && filterMode === "range" ? "default" : "outline"}
            size="sm"
            className="h-9 text-xs"
            onClick={() => { setShowAllDates(false); setFilterMode("range"); }}
          >
            Período
          </Button>
        </div>

        {!showAllDates && filterMode === "single" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal h-9 text-xs", !filterDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {filterDate ? format(filterDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={filterDate} onSelect={setFilterDate} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        )}

        {!showAllDates && filterMode === "range" && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal h-9 text-xs", !filterDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {filterDate ? format(filterDate, "dd/MM/yyyy", { locale: ptBR }) : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filterDate} onSelect={setFilterDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal h-9 text-xs", !filterDateFim && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {filterDateFim ? format(filterDateFim, "dd/MM/yyyy", { locale: ptBR }) : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filterDateFim} onSelect={setFilterDateFim} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>

      {/* Pop-ups toggle + batch bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Switch checked={popupsEnabled} onCheckedChange={setPopupsEnabled} />
          <span className="text-sm text-muted-foreground">Pop-ups de confirmação</span>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2 px-3 shadow-sm">
            <span className="text-sm font-medium">{selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}</span>
            <Button size="sm" onClick={pagarTodosSelecionados} disabled={batchPaying} className="gap-1.5">
              {batchPaying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" />}
              Pagar Todos
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Desmarcar
            </Button>
          </div>
        )}
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
                <div key={f.id} className={`rounded-lg border bg-card p-4 flex items-center gap-4 ${selectedIds.has(f.id) ? "ring-2 ring-primary" : ""}`}>
                  <Checkbox checked={selectedIds.has(f.id)} onCheckedChange={() => toggleSelect(f.id)} className="shrink-0" />
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
                    {getInitials(f.prestador_nome)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{f.prestador_nome}</h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">{f.id}</Badge>
                      <span className="text-xs text-muted-foreground truncate">Cliente: {f.nome_cliente_resolved}</span>
                      {f.pagamento_realizado ? (
                        <Badge variant="outline" className="text-[10px] border-green-300 text-green-700">Cliente Pagou</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Pagamento do Cliente Pendente</Badge>
                      )}
                      {f.nps_nota !== null && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 text-yellow-500" /> {f.nps_nota}
                        </span>
                      )}
                      {f.observacao_financeira && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setObsPopup(f); }}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full hover:bg-amber-200 transition-colors max-w-[220px] truncate"
                        >
                          ⚠ {f.observacao_financeira.substring(0, 60)}{f.observacao_financeira.length > 60 ? "…" : ""}
                        </button>
                      )}
                      {f.tipo_troca === "prestador_trocado" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toast({ title: "Prestador Trocado", description: f.justificativa_troca || "Sem justificativa" }); }}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full hover:bg-orange-200 transition-colors"
                        >
                          🔀 Prestador Trocado
                        </button>
                      )}
                      {f.tipo_troca === "prestador_substituto" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toast({ title: "Prestador Substituto", description: f.justificativa_troca || "Sem justificativa" }); }}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full hover:bg-blue-200 transition-colors"
                        >
                          🔄 Prestador Substituto
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      <span>Pgto prev.: {formatDateShort(f.data_pagamento_prevista)}</span>
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
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold">{formatMoeda(f.financeiro.liquidoPrestador)}</div>
                    <div className="text-[10px] text-muted-foreground">Líquido</div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="h-9 px-3" onClick={() => { setDetalhesSel(f); setDetalhesOpen(true); }}>
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30 h-9 px-3" disabled={cancelando === f.id} onClick={() => setConfirmCancel(f)}>
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" className="h-9 px-4" disabled={markingPaid === f.id} onClick={() => handlePayClick(f)}>
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
            ) : filteredHistorico.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum pagamento realizado</div>
            ) : (
              <>
                {paginatedHistorico.map(f => (
                  <div key={f.id} className="rounded-lg border bg-card p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
                      {getInitials(f.prestador_nome)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{f.prestador_nome}</h3>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">{f.id}</Badge>
                        <span className="text-xs text-muted-foreground truncate">Cliente: {f.nome_cliente_resolved}</span>
                        {f.pagamento_realizado ? (
                          <Badge variant="outline" className="text-[10px] border-green-300 text-green-700">Cliente Pagou</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Pagamento do Cliente Pendente</Badge>
                        )}
                        {f.nps_nota !== null && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Star className="h-3 w-3 text-yellow-500" /> {f.nps_nota}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span>Pago em: {f.data_pagamento_realizada ? formatDateShort(f.data_pagamento_realizada) : "—"}</span>
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
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold">{formatMoeda(f.financeiro.liquidoPrestador)}</div>
                      <div className="text-[10px] text-muted-foreground">Líquido</div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" className="h-9 px-3" onClick={() => { setDetalhesSel(f); setDetalhesOpen(true); }}>
                        <Info className="h-3.5 w-3.5" />
                      </Button>
                      <Badge variant="secondary" className="text-xs h-9 px-3 flex items-center">Pago</Badge>
                    </div>
                  </div>
                ))}
                {historicoTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">{filteredHistorico.length} registros</span>
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
                <div className="text-muted-foreground">Data Contratação</div>
                <div className="font-medium">{formatDateFull(detalhesSel.created_at)}</div>
                <div className="text-muted-foreground">Data Pagamento Prevista</div>
                <div className="font-medium">{formatDateFull(detalhesSel.data_pagamento_prevista)}</div>
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

      {/* Payment Confirmation Dialog */}
      <Dialog open={!!pagamentoConfirm} onOpenChange={(open) => { if (!open) { setPagamentoConfirm(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Confirmar Pagamento
            </DialogTitle>
          </DialogHeader>
          {pagamentoConfirm && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                  {getInitials(pagamentoConfirm.prestador_nome)}
                </div>
                <div>
                  <div className="font-bold text-base">{pagamentoConfirm.prestador_nome}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-[10px]">{pagamentoConfirm.id}</Badge>
                    <span className="text-xs text-muted-foreground">Pgto: {formatDateShort(pagamentoConfirm.data_pagamento_prevista)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Dados PIX</h4>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                  {pagamentoConfirm.nome_pix && (
                    <>
                      <span className="text-muted-foreground">Nome PIX</span>
                      <span className="font-medium">{pagamentoConfirm.nome_pix}</span>
                    </>
                  )}
                  {pagamentoConfirm.chave_pix && (
                    <>
                      <span className="text-muted-foreground">Chave PIX</span>
                      <span className="font-medium flex items-center gap-1.5">
                        <span className="truncate max-w-[200px]">{pagamentoConfirm.chave_pix}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => copyToClipboard(pagamentoConfirm.chave_pix!)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </>
                  )}
                  {pagamentoConfirm.banco && (
                    <>
                      <span className="text-muted-foreground">Banco</span>
                      <span className="font-medium flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {pagamentoConfirm.banco}
                      </span>
                    </>
                  )}
                  {!pagamentoConfirm.chave_pix && !pagamentoConfirm.nome_pix && !pagamentoConfirm.banco && (
                    <span className="col-span-2 text-muted-foreground italic">Nenhum dado PIX cadastrado</span>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Data do Pagamento</h4>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dataPagamentoCustom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataPagamentoCustom
                        ? format(dataPagamentoCustom, "dd/MM/yyyy", { locale: ptBR })
                        : format(new Date(), "dd/MM/yyyy", { locale: ptBR }) + " (hoje)"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataPagamentoCustom}
                      onSelect={setDataPagamentoCustom}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {dataPagamentoCustom && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => setDataPagamentoCustom(undefined)}
                  >
                    Usar data de hoje
                  </Button>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Composição dos Valores</h4>
                <div className="grid grid-cols-2 gap-y-1.5">
                  <span className="text-muted-foreground">Mão de Obra</span>
                  <span className="text-right">{formatMoeda(pagamentoConfirm.financeiro.maoObra)}</span>
                  <span className="text-muted-foreground">Peças</span>
                  <span className="text-right">{formatMoeda(pagamentoConfirm.financeiro.pecas)}</span>
                  <span className="text-muted-foreground">Taxa 24help (23%)</span>
                  <span className="text-right">{formatMoeda(pagamentoConfirm.financeiro.taxa24help)}</span>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-y-1.5">
                  <span className="text-muted-foreground font-semibold">Total da OS</span>
                  <span className="text-right font-semibold">{formatMoeda(pagamentoConfirm.financeiro.totalOS)}</span>
                </div>
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3 flex items-center justify-between">
                  <span className="font-semibold text-green-800 dark:text-green-300">Líquido Prestador</span>
                  <span className="text-xl font-bold text-green-700 dark:text-green-400">{formatMoeda(pagamentoConfirm.financeiro.liquidoPrestador)}</span>
                </div>
              </div>

              <Button
                className="w-full h-11 text-base"
                disabled={markingPaid === pagamentoConfirm.id}
                onClick={() => { marcarPago(pagamentoConfirm, dataPagamentoCustom); setPagamentoConfirm(null); setDataPagamentoCustom(undefined); }}
              >
                {markingPaid === pagamentoConfirm.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Confirmar Pagamento
              </Button>
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

      {/* Observação Financeira popup */}
      <Dialog open={!!obsPopup} onOpenChange={() => setObsPopup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Observação Financeira — {obsPopup?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm whitespace-pre-wrap">{obsPopup?.observacao_financeira}</p>
            {obsPopup && (() => {
              const margin = obsPopup.valor_total > 0
                ? ((obsPopup.valor_total - (obsPopup.valor_mao_obra + obsPopup.valor_pecas)) / obsPopup.valor_total) * 100
                : 0;
              const isNegative = margin < 0;
              return isNegative ? (
                <div className="text-sm font-semibold text-destructive">
                  Margem: {margin.toFixed(1)}%
                </div>
              ) : null;
            })()}
            <Separator />
            <p className="text-xs text-muted-foreground">
              Registrado por: {obsPopup?.observacao_operador_nome || "Operador não identificado"}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
