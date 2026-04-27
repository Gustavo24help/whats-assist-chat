import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileText, Search, Link as LinkIcon, X, CalendarDays, Wrench, ClipboardList, MapPin, CheckCircle2, Clock, History, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isYesterday, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface PrestadorInfoPanelProps {
  prestadorTelefone: string;
  prestadorCpf?: string | null;
  prestadorNome: string;
}

interface FichaItem {
  id: string;
  nome_ficha: string | null;
  descricao: string | null;
  status: string | null;
}

interface ServicoItem {
  id: string;
  nome_ficha: string | null;
  descricao: string | null;
  status: string | null;
  endereco: string | null;
  bairro: string | null;
  horario_agendamento: string | null;
  horario_visita_tecnica: string | null;
  data_retorno: string | null;
  hora_inicio_prestador_agendamento: string | null;
  hora_fim_prestador_agendamento: string | null;
  hora_inicio_prestador_retorno: string | null;
  hora_fim_prestador_retorno: string | null;
  valor_total: number | null;
  valor_mao_obra: number | null;
  valor_pecas: number | null;
  material_pago_24help: boolean | null;
  updated_at: string | null;
}

interface OrcamentoItem {
  id: string;
  ficha_nome: string;
  valor_total: number;
  valor_mao_obra: number | null;
  valor_pecas: number | null;
  data_criacao: string;
  observacoes: string | null;
  ficha_status?: string | null;
  ficha_prestador_id?: string | null;
}

type EventoTipo = "agendamento" | "visita" | "retorno";
interface EventoCalendario {
  ficha_id: string;
  nome_ficha: string | null;
  descricao: string | null;
  endereco: string | null;
  bairro: string | null;
  data: Date;
  hora_inicio: string | null;
  hora_fim: string | null;
  tipo: EventoTipo;
  status: string | null;
}

const tipoConfig: Record<EventoTipo, { label: string; cls: string; dot: string }> = {
  agendamento: { label: "Agendamento", cls: "border-l-blue-500 bg-blue-500/5", dot: "bg-blue-500" },
  visita: { label: "Visita Técnica", cls: "border-l-amber-500 bg-amber-500/5", dot: "bg-amber-500" },
  retorno: { label: "Retorno", cls: "border-l-violet-500 bg-violet-500/5", dot: "bg-violet-500" },
};

const formatBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const formatDayLabel = (d: Date) => {
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  if (isYesterday(d)) return "Ontem";
  return format(d, "EEE, dd 'de' MMM", { locale: ptBR });
};

export const PrestadorInfoPanel = ({
  prestadorTelefone,
  prestadorCpf,
  prestadorNome,
}: PrestadorInfoPanelProps) => {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState("ficha");

  // ===== Ficha vinculada =====
  const [fichaVinculada, setFichaVinculada] = useState<FichaItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<FichaItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // ===== Calendário =====
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(false);

  // ===== Orçamentos =====
  const [orcamentos, setOrcamentos] = useState<OrcamentoItem[]>([]);
  const [loadingOrc, setLoadingOrc] = useState(false);

  // ===== Histórico de serviços =====
  const [servicos, setServicos] = useState<ServicoItem[]>([]);
  const [pagamentoMap, setPagamentoMap] = useState<Map<string, boolean>>(new Map());
  const [loadingServ, setLoadingServ] = useState(false);

  // ----- Load ficha vinculada -----
  const loadFichaVinculada = async () => {
    const { data } = await supabase
      .from("conversa_ficha_vinculo")
      .select("ficha_id")
      .eq("prestador_telefone", prestadorTelefone)
      .eq("ativo", true)
      .order("vinculado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.ficha_id) {
      const { data: ficha } = await supabase
        .from("fichas_de_servico")
        .select("id, nome_ficha, descricao, status")
        .eq("id", data.ficha_id)
        .maybeSingle();
      setFichaVinculada(ficha || null);
    } else {
      setFichaVinculada(null);
    }
  };

  useEffect(() => { loadFichaVinculada(); }, [prestadorTelefone]);

  // ----- Search fichas -----
  useEffect(() => {
    if (!searchOpen) return;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      let query = supabase
        .from("fichas_de_servico")
        .select("id, nome_ficha, descricao, status")
        .order("created_at", { ascending: false })
        .limit(30);
      if (searchTerm.trim()) {
        query = query.or(`id.ilike.%${searchTerm}%,nome_ficha.ilike.%${searchTerm}%,descricao.ilike.%${searchTerm}%`);
      }
      const { data } = await query;
      setSearchResults(data || []);
      setSearchLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, searchOpen]);

  const vincularFicha = async (fichaId: string) => {
    await supabase
      .from("conversa_ficha_vinculo")
      .update({ ativo: false })
      .eq("prestador_telefone", prestadorTelefone)
      .eq("ativo", true);

    const { error } = await supabase.from("conversa_ficha_vinculo").insert({
      ficha_id: fichaId,
      prestador_telefone: prestadorTelefone,
      vinculado_por: userProfile?.fullName || "Operador",
    });

    if (error) {
      toast.error("Erro ao vincular ficha");
      return;
    }
    toast.success(`Ficha ${fichaId} vinculada`);
    setSearchOpen(false);
    setSearchTerm("");
    await loadFichaVinculada();
  };

  const desvincular = async () => {
    await supabase
      .from("conversa_ficha_vinculo")
      .update({ ativo: false })
      .eq("prestador_telefone", prestadorTelefone)
      .eq("ativo", true);
    setFichaVinculada(null);
    toast.success("Ficha desvinculada");
  };

  // ----- Load eventos calendário (apenas com prestadorCpf) -----
  useEffect(() => {
    if (!prestadorCpf) {
      setEventos([]);
      return;
    }
    const fetchEventos = async () => {
      setLoadingEventos(true);
      const { data } = await supabase
        .from("fichas_de_servico")
        .select("id, nome_ficha, descricao, status, endereco, bairro, horario_agendamento, horario_visita_tecnica, data_retorno, hora_inicio_prestador_agendamento, hora_fim_prestador_agendamento, hora_inicio_prestador_retorno, hora_fim_prestador_retorno")
        .eq("prestador_id", prestadorCpf)
        .not("status", "in", '("Perdido")');

      const ev: EventoCalendario[] = [];
      (data || []).forEach((f: any) => {
        if (f.horario_agendamento) {
          ev.push({
            ficha_id: f.id, nome_ficha: f.nome_ficha, descricao: f.descricao,
            endereco: f.endereco, bairro: f.bairro,
            data: new Date(f.horario_agendamento),
            hora_inicio: f.hora_inicio_prestador_agendamento,
            hora_fim: f.hora_fim_prestador_agendamento,
            tipo: "agendamento", status: f.status,
          });
        }
        if (f.horario_visita_tecnica) {
          ev.push({
            ficha_id: f.id, nome_ficha: f.nome_ficha, descricao: f.descricao,
            endereco: f.endereco, bairro: f.bairro,
            data: new Date(f.horario_visita_tecnica),
            hora_inicio: null, hora_fim: null,
            tipo: "visita", status: f.status,
          });
        }
        if (f.data_retorno) {
          ev.push({
            ficha_id: f.id, nome_ficha: f.nome_ficha, descricao: f.descricao,
            endereco: f.endereco, bairro: f.bairro,
            data: new Date(f.data_retorno),
            hora_inicio: f.hora_inicio_prestador_retorno,
            hora_fim: f.hora_fim_prestador_retorno,
            tipo: "retorno", status: f.status,
          });
        }
      });
      ev.sort((a, b) => a.data.getTime() - b.data.getTime());
      setEventos(ev);
      setLoadingEventos(false);
    };
    fetchEventos();
  }, [prestadorCpf]);

  // Group eventos by day, focus on upcoming and recent past
  const eventosAgrupados = useMemo(() => {
    const hoje = startOfDay(new Date());
    // Show events from 7 days ago onwards
    const limite = new Date(hoje); limite.setDate(limite.getDate() - 7);
    const groups: Record<string, EventoCalendario[]> = {};
    eventos.filter(e => e.data >= limite).forEach(e => {
      const key = format(e.data, "yyyy-MM-dd");
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateStr, items]) => ({ dateStr, date: parseISO(dateStr), items }));
  }, [eventos]);

  // ----- Load orçamentos -----
  useEffect(() => {
    if (!prestadorCpf) {
      setOrcamentos([]);
      return;
    }
    const fetch = async () => {
      setLoadingOrc(true);
      const { data: orcs } = await supabase
        .from("orcamentos")
        .select("id, ficha_nome, valor_total, valor_mao_obra, valor_pecas, data_criacao, observacoes")
        .eq("prestador_cpf", prestadorCpf)
        .order("data_criacao", { ascending: false })
        .limit(100);

      // enrich with ficha status to compute aprovado/rejeitado
      const fichaIds = Array.from(new Set((orcs || []).map(o => o.ficha_nome).filter(Boolean)));
      let fichaMap = new Map<string, { status: string | null; prestador_id: string | null }>();
      if (fichaIds.length > 0) {
        const { data: fichas } = await supabase
          .from("fichas_de_servico")
          .select("id, status, prestador_id")
          .in("id", fichaIds);
        (fichas || []).forEach(f => fichaMap.set(f.id, { status: f.status, prestador_id: f.prestador_id }));
      }
      const enriched: OrcamentoItem[] = (orcs || []).map(o => {
        const f = fichaMap.get(o.ficha_nome);
        return { ...o, ficha_status: f?.status || null, ficha_prestador_id: f?.prestador_id || null };
      });
      setOrcamentos(enriched);
      setLoadingOrc(false);
    };
    fetch();
  }, [prestadorCpf]);

  // ----- Load serviços e pagamentos -----
  useEffect(() => {
    if (!prestadorCpf) {
      setServicos([]);
      setPagamentoMap(new Map());
      return;
    }
    const fetch = async () => {
      setLoadingServ(true);
      const { data } = await supabase
        .from("fichas_de_servico")
        .select("id, nome_ficha, descricao, status, endereco, bairro, horario_agendamento, horario_visita_tecnica, data_retorno, hora_inicio_prestador_agendamento, hora_fim_prestador_agendamento, hora_inicio_prestador_retorno, hora_fim_prestador_retorno, valor_total, valor_mao_obra, valor_pecas, material_pago_24help, updated_at")
        .eq("prestador_id", prestadorCpf)
        .in("status", ["Agendado", "Em andamento", "Visita Técnica", "Finalizado"])
        .order("updated_at", { ascending: false })
        .limit(100);

      const list = (data as ServicoItem[]) || [];
      setServicos(list);

      const ids = list.map(s => s.id);
      if (ids.length > 0) {
        const { data: trans } = await supabase
          .from("transacoes_financeiras")
          .select("ficha_id, status_pagamento_prestador")
          .in("ficha_id", ids);
        const map = new Map<string, boolean>();
        (trans || []).forEach((t: any) => {
          if (t.status_pagamento_prestador === "pago") map.set(t.ficha_id, true);
          else if (!map.has(t.ficha_id)) map.set(t.ficha_id, false);
        });
        setPagamentoMap(map);
      }
      setLoadingServ(false);
    };
    fetch();
  }, [prestadorCpf]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b p-3 shrink-0">
        <h3 className="text-sm font-semibold truncate">{prestadorNome}</h3>
        {prestadorCpf && <p className="text-xs text-muted-foreground">CPF: {prestadorCpf}</p>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-4 mx-3 mt-2 shrink-0 h-9">
          <TabsTrigger value="ficha" className="text-xs gap-1">
            <FileText className="h-3.5 w-3.5" /> Ficha
          </TabsTrigger>
          <TabsTrigger value="calendario" className="text-xs gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> Agenda
          </TabsTrigger>
          <TabsTrigger value="orcamentos" className="text-xs gap-1">
            <ClipboardList className="h-3.5 w-3.5" /> Orçam.
          </TabsTrigger>
          <TabsTrigger value="historico" className="text-xs gap-1">
            <History className="h-3.5 w-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* ============ FICHA ============ */}
        <TabsContent value="ficha" className="flex-1 overflow-hidden m-0 mt-2">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-3">
              {fichaVinculada ? (
                <div className="border rounded-lg p-3 bg-primary/5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Badge variant="outline" className="gap-1 text-xs mb-1">
                        <FileText className="h-3 w-3" /> Vinculada
                      </Badge>
                      <p className="font-mono text-sm font-semibold truncate">{fichaVinculada.id}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={desvincular}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {fichaVinculada.nome_ficha && (
                    <p className="text-xs text-muted-foreground">{fichaVinculada.nome_ficha}</p>
                  )}
                  {fichaVinculada.descricao && (
                    <p className="text-xs whitespace-pre-wrap">{fichaVinculada.descricao}</p>
                  )}
                  {fichaVinculada.status && (
                    <Badge variant="secondary" className="text-[10px]">{fichaVinculada.status}</Badge>
                  )}
                </div>
              ) : (
                <div className="border border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground">
                  Nenhuma ficha vinculada à conversa.
                </div>
              )}

              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full gap-1">
                    <LinkIcon className="h-3.5 w-3.5" />
                    {fichaVinculada ? "Trocar ficha vinculada" : "Vincular ficha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2" align="start">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      autoFocus
                      placeholder="Buscar por ID, nome ou descrição..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <ScrollArea className="max-h-64">
                    {searchLoading ? (
                      <div className="flex justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : searchResults.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">Nenhuma ficha encontrada</p>
                    ) : (
                      <div className="space-y-0.5">
                        {searchResults.map(f => (
                          <button
                            key={f.id}
                            onClick={() => vincularFicha(f.id)}
                            className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium">{f.id}</span>
                              {f.status && <Badge variant="outline" className="text-[9px] py-0 h-4">{f.status}</Badge>}
                            </div>
                            {(f.nome_ficha || f.descricao) && (
                              <p className="text-muted-foreground truncate">
                                {f.nome_ficha || f.descricao}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ============ CALENDÁRIO ============ */}
        <TabsContent value="calendario" className="flex-1 overflow-hidden m-0 mt-2">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-3">
              {/* Legenda */}
              <div className="flex flex-wrap gap-2 text-[10px]">
                {Object.entries(tipoConfig).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1">
                    <span className={cn("h-2 w-2 rounded-full", v.dot)} />
                    <span className="text-muted-foreground">{v.label}</span>
                  </div>
                ))}
              </div>

              {!prestadorCpf ? (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  Prestador sem CPF cadastrado.
                </p>
              ) : loadingEventos ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : eventosAgrupados.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  Nenhum agendamento próximo.
                </p>
              ) : (
                eventosAgrupados.map(({ dateStr, date, items }) => (
                  <div key={dateStr} className="space-y-1.5">
                    <div className="flex items-center gap-2 sticky top-0 bg-background py-1">
                      <span className="text-xs font-semibold capitalize">{formatDayLabel(date)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(date, "dd/MM/yyyy")}
                      </span>
                    </div>
                    {items.map((e, idx) => {
                      const cfg = tipoConfig[e.tipo];
                      const horario = e.hora_inicio
                        ? `${e.hora_inicio.slice(0, 5)}${e.hora_fim ? ` - ${e.hora_fim.slice(0, 5)}` : ""}`
                        : format(e.data, "HH:mm");
                      return (
                        <div
                          key={`${e.ficha_id}-${e.tipo}-${idx}`}
                          className={cn("border-l-4 rounded p-2 text-xs space-y-1", cfg.cls)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{cfg.label}</span>
                            <span className="text-muted-foreground">{horario}</span>
                          </div>
                          <p className="font-mono text-[11px] text-muted-foreground">{e.ficha_id}</p>
                          {(e.nome_ficha || e.descricao) && (
                            <p className="line-clamp-2">{e.nome_ficha || e.descricao}</p>
                          )}
                          {(e.endereco || e.bairro) && (
                            <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
                              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                              <span className="line-clamp-1">
                                {[e.endereco, e.bairro].filter(Boolean).join(" - ")}
                              </span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ============ ORÇAMENTOS ============ */}
        <TabsContent value="orcamentos" className="flex-1 overflow-hidden m-0 mt-2">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {!prestadorCpf ? (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  Prestador sem CPF cadastrado.
                </p>
              ) : loadingOrc ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : orcamentos.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  Nenhum orçamento enviado.
                </p>
              ) : (
                orcamentos.map(o => {
                  const isAprovado = o.ficha_prestador_id === prestadorCpf;
                  const isRejeitado = o.ficha_prestador_id && o.ficha_prestador_id !== prestadorCpf;
                  return (
                    <div key={o.id} className="border rounded-lg p-2 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-medium">{o.ficha_nome}</span>
                        {isAprovado ? (
                          <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/20 border-green-500/30 text-[9px] py-0 h-4 gap-0.5">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Aprovado
                          </Badge>
                        ) : isRejeitado ? (
                          <Badge variant="secondary" className="text-[9px] py-0 h-4">Não escolhido</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] py-0 h-4 gap-0.5">
                            <Clock className="h-2.5 w-2.5" /> Pendente
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[10px]">
                        <div>
                          <p className="text-muted-foreground">Mão de obra</p>
                          <p className="font-medium">{formatBRL(o.valor_mao_obra)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Peças</p>
                          <p className="font-medium">{formatBRL(o.valor_pecas)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-semibold">{formatBRL(o.valor_total)}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(o.data_criacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {o.observacoes && (
                        <p className="text-[10px] text-muted-foreground italic line-clamp-2">{o.observacoes}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ============ HISTÓRICO ============ */}
        <TabsContent value="historico" className="flex-1 overflow-hidden m-0 mt-2">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {!prestadorCpf ? (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  Prestador sem CPF cadastrado.
                </p>
              ) : loadingServ ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : servicos.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  Nenhum serviço registrado.
                </p>
              ) : (
                servicos.map(s => {
                  const pago = pagamentoMap.get(s.id);
                  const pecasReais = s.material_pago_24help ? 0 : (s.valor_pecas || 0);
                  const isFinalizado = s.status === "Finalizado";
                  return (
                    <div key={s.id} className="border rounded-lg p-2 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-medium">{s.id}</span>
                        <Badge variant="outline" className="text-[9px] py-0 h-4">{s.status}</Badge>
                      </div>
                      {(s.nome_ficha || s.descricao) && (
                        <p className="line-clamp-2 text-[11px]">{s.nome_ficha || s.descricao}</p>
                      )}
                      <div className="grid grid-cols-3 gap-1 text-[10px]">
                        <div>
                          <p className="text-muted-foreground">M. obra</p>
                          <p className="font-medium">{formatBRL(s.valor_mao_obra)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Peças{s.material_pago_24help ? " (24h)" : ""}
                          </p>
                          <p className="font-medium">{formatBRL(s.valor_pecas)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-semibold">{formatBRL(s.valor_total)}</p>
                        </div>
                      </div>
                      {isFinalizado && (
                        <div className="flex items-center justify-between pt-1 border-t">
                          <span className="text-[10px] text-muted-foreground">
                            Pagamento ao prestador
                          </span>
                          {pago ? (
                            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/20 border-green-500/30 text-[9px] py-0 h-4 gap-0.5">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Pago
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] py-0 h-4 gap-0.5 border-amber-500/30 text-amber-700 dark:text-amber-400">
                              <Clock className="h-2.5 w-2.5" /> Pendente
                            </Badge>
                          )}
                        </div>
                      )}
                      {(s.bairro || s.endereco) && (
                        <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
                          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-1">
                            {[s.endereco, s.bairro].filter(Boolean).join(" - ")}
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
