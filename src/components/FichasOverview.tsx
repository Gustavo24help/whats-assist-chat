import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, Search, Check, X, SlidersHorizontal } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FichaCard } from "./FichaCard";
import { FichasDashboard } from "./FichasDashboard";
import { OrcamentoTempoKPIs } from "./OrcamentoTempoKPIs";
import { VisitaConversaoKPIs } from "./VisitaConversaoKPIs";
import { NPSMetricsKPIs } from "./NPSMetricsKPIs";
import { AvaliacaoPrestadorMetricsKPIs } from "./AvaliacaoPrestadorMetricsKPIs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type FichaDeServico = Database["public"]["Tables"]["fichas_de_servico"]["Row"];

interface FichaWithData extends FichaDeServico {
  cliente_nome?: string;
  prestador_nome?: string;
  orcamentos_count?: number;
}

const STATUS_OPTIONS = [
  "Todos",
  "Não foi adiante",
  "Ficha Criada",
  "Contato Inicial",
  "Dúvida Prestador",
  "Orçamento Enviado",
  "Negociação",
  "Visita Técnica",
  "Orçamento Aprovado / Agendamento",
  "Orçamento Não Aprovado",
  "Agendado",
  "Em andamento",
  "Finalizado",
  "Garantia",
  "Perdido",
];

const PERIODO_OPTIONS = [
  { value: "todos", label: "Todo período" },
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7dias", label: "Últimos 7 dias" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "mes", label: "Este mês" },
  { value: "mes_passado", label: "Mês passado" },
  { value: "personalizado", label: "Personalizado" },
];

export const FichasOverview = () => {
  const [fichas, setFichas] = useState<FichaWithData[]>([]);
  const [prestadores, setPrestadores] = useState<Array<{ cpf: string; nome: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [conversasAbertas, setConversasAbertas] = useState(0);

  // Filtros
  const [searchNome, setSearchNome] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const [selectedPrestador, setSelectedPrestador] = useState("Todos");
  const [selectedPeriodo, setSelectedPeriodo] = useState("todos");
  const [selectedPagamento, setSelectedPagamento] = useState("Todos");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [openPrestador, setOpenPrestador] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchData();
    fetchConversasAbertas();
  }, []);

  const fetchConversasAbertas = async () => {
    const agora = new Date();
    const limite24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
    
    const { count } = await supabase
      .from("clientes")
      .select("*", { count: "exact", head: true })
      .gt("ultima_interacao", limite24h.toISOString());
    
    setConversasAbertas(count || 0);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: fichasData } = await supabase
        .from("fichas_de_servico")
        .select("*")
        .order("created_at", { ascending: false });

      if (!fichasData) {
        setLoading(false);
        return;
      }

      const telefones = [...new Set(fichasData.map((f) => f.telefone_cliente))];
      const { data: clientesData } = await supabase
        .from("clientes")
        .select("telefone, nome")
        .in("telefone", telefones);

      const clientesMap = new Map(clientesData?.map((c) => [c.telefone, c.nome]));

      const cpfs = [...new Set(fichasData.map((f) => f.prestador_id).filter(Boolean))];
      const { data: prestadoresData } = await supabase
        .from("prestadores")
        .select("cpf, nome")
        .in("cpf", cpfs);

      const prestadoresMap = new Map(prestadoresData?.map((p) => [p.cpf, p.nome]));
      setPrestadores(prestadoresData || []);

      const fichaIds = fichasData.map((f) => f.id);
      const { data: orcamentosData } = await supabase
        .from("orcamentos")
        .select("ficha_nome")
        .in("ficha_nome", fichaIds);

      const orcamentosCountMap = new Map<string, number>();
      orcamentosData?.forEach((orc) => {
        const count = orcamentosCountMap.get(orc.ficha_nome) || 0;
        orcamentosCountMap.set(orc.ficha_nome, count + 1);
      });

      const fichasComDados: FichaWithData[] = fichasData.map((ficha) => ({
        ...ficha,
        cliente_nome: clientesMap.get(ficha.telefone_cliente) || "Desconhecido",
        prestador_nome: ficha.prestador_id ? prestadoresMap.get(ficha.prestador_id) : undefined,
        orcamentos_count: orcamentosCountMap.get(ficha.id) || 0,
      }));

      setFichas(fichasComDados);
    } catch (error) {
      console.error("Erro ao buscar fichas:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular range de datas baseado no período selecionado
  const getDateRange = useCallback(() => {
    const hoje = new Date();
    
    switch (selectedPeriodo) {
      case "hoje":
        return { from: startOfDay(hoje), to: endOfDay(hoje) };
      case "ontem":
        const ontem = subDays(hoje, 1);
        return { from: startOfDay(ontem), to: endOfDay(ontem) };
      case "7dias":
        return { from: startOfDay(subDays(hoje, 7)), to: endOfDay(hoje) };
      case "30dias":
        return { from: startOfDay(subDays(hoje, 30)), to: endOfDay(hoje) };
      case "mes":
        return { from: startOfMonth(hoje), to: endOfMonth(hoje) };
      case "mes_passado":
        const mesPassado = subMonths(hoje, 1);
        return { from: startOfMonth(mesPassado), to: endOfMonth(mesPassado) };
      case "personalizado":
        return dateRange;
      default:
        return { from: undefined, to: undefined };
    }
  }, [selectedPeriodo, dateRange]);

  // Filtrar fichas por período primeiro (para o dashboard)
  const fichasPorPeriodo = useMemo(() => {
    const range = getDateRange();
    
    if (!range.from && !range.to) return fichas;
    
    return fichas.filter((ficha) => {
      if (!ficha.created_at) return false;
      const fichaDate = new Date(ficha.created_at);
      
      if (range.from && fichaDate < range.from) return false;
      if (range.to && fichaDate > range.to) return false;
      
      return true;
    });
  }, [fichas, getDateRange]);

  // Aplicar todos os filtros
  const fichasFiltradas = useMemo(() => {
    return fichasPorPeriodo.filter((ficha) => {
      if (searchNome && !ficha.nome_ficha?.toLowerCase().includes(searchNome.toLowerCase())) {
        return false;
      }

      if (selectedStatus !== "Todos" && ficha.status !== selectedStatus) {
        return false;
      }

      if (selectedPrestador !== "Todos" && ficha.prestador_id !== selectedPrestador) {
        return false;
      }

      // Pagos: fichas com pagamento_realizado = true
      if (selectedPagamento === "pagos" && ficha.pagamento_realizado !== true) {
        return false;
      }
      // Pendentes: apenas fichas que TÊM link de pagamento salvo e NÃO foram pagas
      if (selectedPagamento === "pendentes") {
        if (!ficha.pagamento_link || ficha.pagamento_realizado === true) {
          return false;
        }
      }

      return true;
    });
  }, [fichasPorPeriodo, searchNome, selectedStatus, selectedPrestador, selectedPagamento]);

  const limparFiltros = () => {
    setSearchNome("");
    setSelectedStatus("Todos");
    setSelectedPrestador("Todos");
    setSelectedPeriodo("todos");
    setSelectedPagamento("Todos");
    setDateRange({ from: undefined, to: undefined });
  };

  const hasActiveFilters = searchNome || selectedStatus !== "Todos" || selectedPrestador !== "Todos" || selectedPagamento !== "Todos";

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status);
  };

  const handlePagamentoFilter = (filter: string) => {
    setSelectedPagamento(filter);
  };

  return (
    <ScrollArea className="h-full">
      <div className="bg-gradient-to-b from-muted/30 to-background min-h-full">
        {/* Header com filtro de período */}
        <div className="bg-background/80 backdrop-blur-sm border-b p-4 md:p-6 space-y-6">
          {/* Título e Período */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Visão Geral
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Acompanhe todas as fichas de serviço em um só lugar
            </p>
          </div>
          
          {/* Filtro de Período */}
          <div className="flex items-center gap-2 flex-wrap">
            {PERIODO_OPTIONS.slice(0, 6).map((periodo) => (
              <Button
                key={periodo.value}
                variant={selectedPeriodo === periodo.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriodo(periodo.value)}
                className="text-xs"
              >
                {periodo.label}
              </Button>
            ))}
            
            {/* Período Personalizado */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={selectedPeriodo === "personalizado" ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                >
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {selectedPeriodo === "personalizado" && dateRange.from
                    ? `${format(dateRange.from, "dd/MM")} - ${dateRange.to ? format(dateRange.to, "dd/MM") : "..."}`
                    : "Personalizado"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    setDateRange({ from: range?.from, to: range?.to });
                    setSelectedPeriodo("personalizado");
                  }}
                  locale={ptBR}
                  className="pointer-events-auto"
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Dashboard de Métricas */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <FichasDashboard
              fichas={fichasPorPeriodo}
              conversasAbertas={conversasAbertas}
              onStatusFilter={handleStatusFilter}
              onPagamentoFilter={handlePagamentoFilter}
              selectedStatus={selectedStatus}
              selectedPagamento={selectedPagamento}
            />
            
            {/* KPIs de Tempo de Resposta dos Orçamentos */}
            <div className="mt-6">
              <OrcamentoTempoKPIs
                periodoFrom={getDateRange().from}
                periodoTo={getDateRange().to}
              />
            </div>
            
            {/* KPIs de Conversão de Visitas Técnicas */}
            <div className="mt-6">
              <VisitaConversaoKPIs
                periodoFrom={getDateRange().from}
                periodoTo={getDateRange().to}
              />
            </div>
            
            {/* Métricas Avaliação de Prestadores */}
            <div className="mt-6">
              <AvaliacaoPrestadorMetricsKPIs
                periodoFrom={getDateRange().from}
                periodoTo={getDateRange().to}
              />
            </div>

            {/* Métricas NPS */}
            <div className="mt-6">
              <NPSMetricsKPIs
                periodoFrom={getDateRange().from}
                periodoTo={getDateRange().to}
              />
            </div>
          </>
        )}
      </div>

      {/* Filtros Detalhados */}
      <div className="bg-background border-b px-4 md:px-6 py-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome da ficha..."
              value={searchNome}
              onChange={(e) => setSearchNome(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Toggle Filtros */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && "bg-muted")}
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 justify-center">
                !
              </Badge>
            )}
          </Button>

          {/* Limpar Filtros */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={limparFiltros}>
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}

          {/* Contador */}
          <div className="ml-auto text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{fichasFiltradas.length}</span>
            {" "}fichas encontradas
          </div>
        </div>

        {/* Filtros Expandidos */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 pt-3 border-t">
            {/* Filtro Status */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Prestador */}
            <Popover open={openPrestador} onOpenChange={setOpenPrestador}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openPrestador}
                  className="w-full justify-between"
                >
                  {selectedPrestador === "Todos"
                    ? "Todos os Prestadores"
                    : prestadores.find((p) => p.cpf === selectedPrestador)?.nome || "Selecione..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar prestador..." />
                  <CommandList>
                    <CommandEmpty>Nenhum prestador encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="Todos"
                        onSelect={() => {
                          setSelectedPrestador("Todos");
                          setOpenPrestador(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedPrestador === "Todos" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        Todos os Prestadores
                      </CommandItem>
                      {prestadores.map((prest) => (
                        <CommandItem
                          key={prest.cpf}
                          value={prest.nome}
                          onSelect={() => {
                            setSelectedPrestador(prest.cpf);
                            setOpenPrestador(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedPrestador === prest.cpf ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {prest.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Filtro Pagamento */}
            <Select value={selectedPagamento} onValueChange={setSelectedPagamento}>
              <SelectTrigger>
                <SelectValue placeholder="Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="pagos">Pagos</SelectItem>
                <SelectItem value="pendentes">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

        {/* Lista de Fichas */}
        <div className="p-4 md:p-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-xl" />
              ))}
            </div>
          ) : fichasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-foreground">Nenhuma ficha encontrada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tente ajustar os filtros ou período selecionado
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" className="mt-4" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {fichasFiltradas.map((ficha) => (
                <FichaCard key={ficha.id} ficha={ficha} />
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
};
