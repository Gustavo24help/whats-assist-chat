import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { format, getDay, getHours, startOfMonth, endOfMonth, subMonths, startOfYear, startOfWeek, endOfWeek, startOfDay, endOfDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { PageLayout } from "@/components/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Users, 
  Wrench, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle,
  MapPin,
  Tag,
  Calendar as CalendarIcon,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowLeft,
  CalendarDays,
  BarChart3,
  AlertTriangle,
  Sparkles,
  ChevronsUpDown
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { useNavigate } from "react-router-dom";

interface Prestador {
  cpf: string;
  nome: string;
  categoria: string | null;
  telefone: string;
  created_at: string | null;
}

interface FichaServico {
  id: string;
  prestador_id: string | null;
  status: string | null;
  valor_total: number | null;
  valor_mao_obra: number | null;
  valor_pecas: number | null;
  horario_agendamento: string | null;
  bairro: string | null;
  categoria_id: number | null;
  created_at: string | null;
}

interface Orcamento {
  id: string;
  prestador_cpf: string;
  ficha_nome: string;
  status: string | null;
  valor_total: number | null;
  data_criacao: string | null;
  categoria: string | null;
}

interface FichaParaOrcamento {
  id: string;
  created_at: string | null;
  prestador_id: string | null;
}

interface PrestadorMetrics {
  cpf: string;
  nome: string;
  categoria: string | null;
  totalFichas: number;
  totalFinalizados: number;
  ticketMedio: number;
  valorTotalMaoObra: number;
  valorTotalPecas: number;
  valorTotal: number;
  totalOS: number;
  lucroBruto: number;
  rentabilidade: number;
  liquidoPrestador: number;
  orcamentosAceitos: number;
  orcamentosRejeitados: number;
  orcamentosPendentes: number;
  orcamentosEnviados: number;
  mediaTempoResposta: number | null;
  bairrosMaisAtendidos: { bairro: string; count: number }[];
  categoriasMaisAtendidas: { categoria: string; count: number }[];
  diasDaSemana: { dia: string; count: number }[];
  periodoDoDia: { manha: number; tarde: number };
  isNovo: boolean;
}

type PeriodoFiltro = "todo_periodo" | "hoje" | "esta_semana" | "mes_atual" | "este_ano" | "customizado";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// Collapsible section wrapper
const CollapsibleSection = ({ 
  title, 
  icon, 
  children, 
  defaultOpen = true,
  badge,
}: { 
  title: string; 
  icon: React.ReactNode; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {icon}
                {title}
                {badge}
              </div>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

const PrestadoresReportPage = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [fichas, setFichas] = useState<FichaServico[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [fichasParaOrcamentos, setFichasParaOrcamentos] = useState<Record<string, FichaParaOrcamento>>({});
  const [loading, setLoading] = useState(true);
  const [selectedPrestador, setSelectedPrestador] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoFiltro>("mes_atual");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    fetchData();
  }, []);

  const getDataRangeFiltro = (): { from: Date; to: Date } | null => {
    const hoje = new Date();
    switch (periodoFiltro) {
      case "hoje":
        return { from: startOfDay(hoje), to: endOfDay(hoje) };
      case "esta_semana":
        return { from: startOfWeek(hoje, { locale: ptBR }), to: endOfWeek(hoje, { locale: ptBR }) };
      case "mes_atual":
        return { from: startOfMonth(hoje), to: endOfMonth(hoje) };
      case "este_ano":
        return { from: startOfYear(hoje), to: hoje };
      case "customizado":
        if (dateRange?.from && dateRange?.to) {
          return { from: dateRange.from, to: dateRange.to };
        }
        return null;
      case "todo_periodo":
      default:
        return null;
    }
  };

  // Minimum quotes threshold based on period length
  const getMinOrcamentosThreshold = (): number => {
    const range = getDataRangeFiltro();
    if (!range) return 2; // todo_periodo
    const days = differenceInDays(range.to, range.from) + 1;
    if (days <= 1) return 0; // today - don't show worst list
    if (days <= 7) return 1;
    if (days <= 31) return 2;
    return 3;
  };

  // Should we show the "worst providers" section at all?
  const shouldShowWorstList = (): boolean => {
    const range = getDataRangeFiltro();
    if (!range) return true;
    const days = differenceInDays(range.to, range.from) + 1;
    return days > 1; // Don't show for "Hoje"
  };

  const fetchAllPaginated = async <T,>(
    queryBuilder: () => ReturnType<ReturnType<typeof supabase.from>['select']>
  ): Promise<T[]> => {
    let allData: T[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await (queryBuilder() as any).range(from, from + pageSize - 1);
      if (error) { console.error("Fetch paginated error:", error); break; }
      if (!data || data.length === 0) break;
      allData.push(...(data as T[]));
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return allData;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: prestadoresData } = await supabase
        .from("prestadores")
        .select("cpf, nome, categoria, telefone, created_at")
        .eq("ativo", true)
        .order("nome");

      const fichasData = await fetchAllPaginated<FichaServico>(
        () => supabase
          .from("fichas_de_servico")
          .select("id, prestador_id, status, valor_total, valor_mao_obra, valor_pecas, horario_agendamento, bairro, categoria_id, created_at")
          .not("prestador_id", "is", null)
      );

      const orcamentosData = await fetchAllPaginated<Orcamento>(
        () => supabase
          .from("orcamentos")
          .select("id, prestador_cpf, ficha_nome, status, valor_total, data_criacao, categoria")
      );

      if (orcamentosData.length > 0) {
        const fichaIds = [...new Set(orcamentosData.map(o => o.ficha_nome))];
        // Fetch in chunks of 500 to avoid URL length limits
        const fichasMap: Record<string, FichaParaOrcamento> = {};
        for (let i = 0; i < fichaIds.length; i += 500) {
          const chunk = fichaIds.slice(i, i + 500);
          const { data: fichasOrcamentosData } = await supabase
            .from("fichas_de_servico")
            .select("id, created_at, prestador_id")
            .in("id", chunk);
          fichasOrcamentosData?.forEach(f => {
            fichasMap[f.id] = f;
          });
        }
        setFichasParaOrcamentos(fichasMap);
      }

      setPrestadores(prestadoresData || []);
      setFichas(fichasData);
      setOrcamentos(orcamentosData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const fichasFiltradas = useMemo(() => {
    const range = getDataRangeFiltro();
    if (!range) return fichas;
    
    return fichas.filter(f => {
      const data = f.created_at;
      if (!data) return false;
      const dataFicha = new Date(data);
      return dataFicha >= range.from && dataFicha <= range.to;
    });
  }, [fichas, periodoFiltro, dateRange]);

  const orcamentosFiltrados = useMemo(() => {
    const range = getDataRangeFiltro();
    if (!range) return orcamentos;
    
    return orcamentos.filter(o => {
      if (!o.data_criacao) return false;
      const dataOrc = new Date(o.data_criacao);
      return dataOrc >= range.from && dataOrc <= range.to;
    });
  }, [orcamentos, periodoFiltro, dateRange]);

  // New providers: registered within last 30 days
  const novosPrestadores = useMemo(() => {
    const hoje = new Date();
    return new Set(
      prestadores
        .filter(p => p.created_at && differenceInDays(hoje, new Date(p.created_at)) <= 30)
        .map(p => p.cpf)
    );
  }, [prestadores]);

  const calcularMetricasPrestador = (cpf: string): PrestadorMetrics | null => {
    const prestador = prestadores.find(p => p.cpf === cpf);
    if (!prestador) return null;

    const fichasDoPrestador = fichasFiltradas.filter(f => f.prestador_id === cpf);
    const fichasFinalizadas = fichasDoPrestador.filter(f => f.status === "Finalizado");
    
    const orcamentosDoPrestador = orcamentosFiltrados.filter(o => o.prestador_cpf === cpf);
    
    const orcamentosAceitos = orcamentosDoPrestador.filter(o => {
      if (o.status !== "aprovado") return false;
      const ficha = fichasParaOrcamentos[o.ficha_nome];
      return ficha?.prestador_id === o.prestador_cpf;
    }).length;
    
    const orcamentosRejeitados = orcamentosDoPrestador.filter(o => {
      if (o.status === "rejeitado") return true;
      if (o.status === "aprovado") {
        const ficha = fichasParaOrcamentos[o.ficha_nome];
        if (!ficha) return false;
        return ficha.prestador_id !== o.prestador_cpf;
      }
      return false;
    }).length;
    
    const orcamentosPendentes = orcamentosDoPrestador.filter(o => o.status === "pendente").length;

    const valorTotalMaoObra = fichasFinalizadas.reduce((acc, f) => acc + (f.valor_mao_obra || 0), 0);
    const valorTotalPecas = fichasFinalizadas.reduce((acc, f) => acc + (f.valor_pecas || 0), 0);
    const liquidoPrestador = valorTotalMaoObra + valorTotalPecas;
    const totalOS = fichasFinalizadas.reduce((acc, f) => acc + (f.valor_total || 0), 0);
    const lucroBruto = totalOS - liquidoPrestador;
    const rentabilidade = totalOS > 0 ? (lucroBruto / totalOS) * 100 : 0;
    const valorTotal = totalOS;
    const fichasComValor = fichasFinalizadas.filter(f => (f.valor_total || 0) > 0);
    const ticketMedio = fichasComValor.length > 0 ? totalOS / fichasComValor.length : 0;

    let temposResposta: number[] = [];
    orcamentosDoPrestador.forEach(orc => {
      const ficha = fichasParaOrcamentos[orc.ficha_nome];
      if (ficha?.created_at && orc.data_criacao) {
        const diff = new Date(orc.data_criacao).getTime() - new Date(ficha.created_at).getTime();
        if (diff > 0) {
          temposResposta.push(diff / (1000 * 60));
        }
      }
    });
    const mediaTempoResposta = temposResposta.length > 0 
      ? temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length 
      : null;

    const bairrosCount: Record<string, number> = {};
    fichasFinalizadas.forEach(f => {
      if (f.bairro) {
        bairrosCount[f.bairro] = (bairrosCount[f.bairro] || 0) + 1;
      }
    });
    const bairrosMaisAtendidos = Object.entries(bairrosCount)
      .map(([bairro, count]) => ({ bairro, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const categoriasCount: Record<string, number> = {};
    orcamentosDoPrestador.forEach(o => {
      if (o.categoria) {
        categoriasCount[o.categoria] = (categoriasCount[o.categoria] || 0) + 1;
      }
    });
    const categoriasMaisAtendidas = Object.entries(categoriasCount)
      .map(([categoria, count]) => ({ categoria, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const diasCount: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let servicosManha = 0;
    let servicosTarde = 0;

    fichasFinalizadas.forEach(f => {
      if (f.horario_agendamento) {
        const data = new Date(f.horario_agendamento);
        const diaSemana = getDay(data);
        diasCount[diaSemana] = (diasCount[diaSemana] || 0) + 1;
        
        const hora = getHours(data);
        if (hora >= 6 && hora < 12) {
          servicosManha++;
        } else {
          servicosTarde++;
        }
      }
    });

    const diasDaSemana = Object.entries(diasCount)
      .map(([dia, count]) => ({ dia: DIAS_SEMANA[parseInt(dia)], count }));

    return {
      cpf,
      nome: prestador.nome,
      categoria: prestador.categoria,
      totalFichas: fichasDoPrestador.length,
      totalFinalizados: fichasFinalizadas.length,
      ticketMedio,
      valorTotalMaoObra,
      valorTotalPecas,
      valorTotal,
      totalOS,
      lucroBruto,
      rentabilidade,
      liquidoPrestador,
      orcamentosAceitos,
      orcamentosRejeitados,
      orcamentosPendentes,
      orcamentosEnviados: orcamentosDoPrestador.length,
      mediaTempoResposta,
      bairrosMaisAtendidos,
      categoriasMaisAtendidas,
      diasDaSemana,
      periodoDoDia: { manha: servicosManha, tarde: servicosTarde },
      isNovo: novosPrestadores.has(cpf),
    };
  };

  const metricsData = useMemo(() => {
    return prestadores
      .map(p => calcularMetricasPrestador(p.cpf))
      .filter((m): m is PrestadorMetrics => m !== null)
      .sort((a, b) => b.totalFinalizados - a.totalFinalizados);
  }, [prestadores, fichasFiltradas, orcamentosFiltrados, fichasParaOrcamentos, novosPrestadores]);

  // Ranking by orcamentos enviados (descending)
  const rankingByOrcamentos = useMemo(() => {
    return [...metricsData].sort((a, b) => b.orcamentosEnviados - a.orcamentosEnviados);
  }, [metricsData]);

  // Chart data for ranking
  const rankingChartData = useMemo(() => {
    return rankingByOrcamentos
      .filter(m => m.orcamentosEnviados > 0 || m.orcamentosAceitos > 0)
      .map(m => ({
        nome: m.nome.length > 12 ? m.nome.substring(0, 12) + "…" : m.nome,
        nomeCompleto: m.nome,
        enviados: m.orcamentosEnviados,
        aceitos: m.orcamentosAceitos,
        isNovo: m.isNovo,
      }));
  }, [rankingByOrcamentos]);

  // Worst providers: active, not new, with < threshold quotes sent
  const pioresPrestadores = useMemo(() => {
    const threshold = getMinOrcamentosThreshold();
    return metricsData.filter(m => !m.isNovo && m.orcamentosEnviados < threshold);
  }, [metricsData, periodoFiltro, dateRange]);

  // New providers list
  const prestadoresNovos = useMemo(() => {
    return metricsData.filter(m => m.isNovo);
  }, [metricsData]);

  const selectedMetrics = useMemo(() => {
    if (!selectedPrestador) return null;
    return metricsData.find(m => m.cpf === selectedPrestador) || null;
  }, [selectedPrestador, metricsData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatTempoResposta = (minutos: number | null) => {
    if (minutos === null) return "N/A";
    const horas = Math.floor(minutos / 60);
    const mins = Math.round(minutos % 60);
    if (horas > 24) {
      const dias = Math.floor(horas / 24);
      const horasRestantes = horas % 24;
      return `${dias}d ${horasRestantes}h`;
    }
    if (horas > 0) {
      return `${horas}h ${mins}min`;
    }
    return `${mins}min`;
  };

  const toggleRowExpansion = (cpf: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(cpf)) {
      newExpanded.delete(cpf);
    } else {
      newExpanded.add(cpf);
    }
    setExpandedRows(newExpanded);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-medium mb-1">{data.nomeCompleto}{data.isNovo ? " 🆕" : ""}</p>
        <p className="text-primary">Enviados: {data.enviados}</p>
        <p className="text-emerald-600">Aceitos: {data.aceitos}</p>
      </div>
    );
  };

  return (
    <PageLayout>
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Relatório de Prestadores</h1>
                <p className="text-muted-foreground text-sm">Performance individual de cada prestador</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={periodoFiltro} onValueChange={(v) => setPeriodoFiltro(v as PeriodoFiltro)}>
                <SelectTrigger className="w-48">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Selecionar período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo_periodo">Período Total</SelectItem>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="esta_semana">Esta Semana</SelectItem>
                  <SelectItem value="mes_atual">Este Mês</SelectItem>
                  <SelectItem value="este_ano">Este Ano</SelectItem>
                  <SelectItem value="customizado">Período Customizado</SelectItem>
                </SelectContent>
              </Select>
              
              {periodoFiltro === "customizado" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-64">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                            {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        )
                      ) : (
                        "Selecionar datas"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6 overflow-auto">
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 1. Ranking Bar Chart */}
              <CollapsibleSection
                title="Ranking de Orçamentos por Prestador"
                icon={<BarChart3 className="h-5 w-5 text-primary" />}
                badge={
                  <Badge variant="secondary" className="ml-2">
                    {rankingChartData.length} prestadores
                  </Badge>
                }
              >
                {rankingChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(400, rankingChartData.length * 36)}>
                    <BarChart data={rankingChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis 
                        type="category" 
                        dataKey="nome" 
                        width={120} 
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="enviados" name="Enviados" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="aceitos" name="Aceitos" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Nenhum orçamento no período selecionado</p>
                )}
              </CollapsibleSection>

              {/* 2. Worst Providers */}
              {shouldShowWorstList() && (
                <CollapsibleSection
                  title="Prestadores com Baixa Atividade"
                  icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
                  defaultOpen={true}
                  badge={
                    <Badge variant="destructive" className="ml-2">
                      {pioresPrestadores.length}
                    </Badge>
                  }
                >
                  {pioresPrestadores.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground mb-3">
                        Prestadores ativos com menos de {getMinOrcamentosThreshold()} orçamento(s) enviado(s) no período. 
                        Prestadores novos (cadastrados há menos de 30 dias) não são considerados.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {pioresPrestadores.map(m => (
                          <div key={m.cpf} className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                            <div>
                              <p className="font-medium text-sm">{m.nome}</p>
                              {m.categoria && (
                                <p className="text-xs text-muted-foreground">{m.categoria}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold">{m.orcamentosEnviados} orç.</p>
                              <p className="text-xs text-muted-foreground">{m.totalFinalizados} finaliz.</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      Todos os prestadores estão acima do mínimo de {getMinOrcamentosThreshold()} orçamento(s) neste período. 👍
                    </p>
                  )}
                </CollapsibleSection>
              )}

              {/* 3. New Providers */}
              {prestadoresNovos.length > 0 && (
                <CollapsibleSection
                  title="Prestadores Novos"
                  icon={<Sparkles className="h-5 w-5 text-amber-500" />}
                  defaultOpen={true}
                  badge={
                    <Badge className="ml-2 bg-amber-500/20 text-amber-700 border-amber-500/30">
                      {prestadoresNovos.length}
                    </Badge>
                  }
                >
                  <p className="text-sm text-muted-foreground mb-3">
                    Cadastrados nos últimos 30 dias. Não são considerados na lista de baixa atividade.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {prestadoresNovos.map(m => {
                      const prestador = prestadores.find(p => p.cpf === m.cpf);
                      const diasCadastro = prestador?.created_at 
                        ? differenceInDays(new Date(), new Date(prestador.created_at))
                        : null;
                      return (
                        <div key={m.cpf} className="flex items-center justify-between p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{m.nome}</p>
                              <Badge className="text-[10px] bg-amber-500 text-white">NOVO</Badge>
                            </div>
                            {m.categoria && (
                              <p className="text-xs text-muted-foreground">{m.categoria}</p>
                            )}
                            {diasCadastro !== null && (
                              <p className="text-xs text-muted-foreground">Há {diasCadastro} dia(s)</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{m.orcamentosEnviados} orç.</p>
                            <p className="text-xs text-muted-foreground">{m.orcamentosAceitos} aceitos</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              )}

              {/* Seletor de Prestador */}
              <CollapsibleSection
                title="Detalhes do Prestador"
                icon={<Users className="h-5 w-5 text-primary" />}
              >
                <Select value={selectedPrestador || ""} onValueChange={setSelectedPrestador}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Selecione um prestador para ver detalhes" />
                  </SelectTrigger>
                  <SelectContent>
                    {prestadores.map(p => (
                      <SelectItem key={p.cpf} value={p.cpf}>
                        {p.nome} {p.categoria && `(${p.categoria})`}
                        {novosPrestadores.has(p.cpf) ? " 🆕" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedMetrics && (
                  <div className="mt-6 space-y-6">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                             <Wrench className="h-4 w-4" />
                             Finalizados
                           </div>
                           <p className="text-2xl font-bold mt-1">{selectedMetrics.totalFinalizados}</p>
                           <p className="text-xs text-muted-foreground">{selectedMetrics.totalFichas} total</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <DollarSign className="h-4 w-4" />
                            Ticket Médio
                          </div>
                          <p className="text-2xl font-bold mt-1">{formatCurrency(selectedMetrics.ticketMedio)}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Clock className="h-4 w-4" />
                            Tempo Resposta
                          </div>
                          <p className="text-2xl font-bold mt-1">{formatTempoResposta(selectedMetrics.mediaTempoResposta)}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <DollarSign className="h-4 w-4" />
                            Mão de Obra
                          </div>
                          <p className="text-2xl font-bold mt-1">{formatCurrency(selectedMetrics.valorTotalMaoObra)}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Tag className="h-4 w-4" />
                            Peças
                          </div>
                          <p className="text-2xl font-bold mt-1">{formatCurrency(selectedMetrics.valorTotalPecas)}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <DollarSign className="h-4 w-4" />
                            Total
                          </div>
                          <p className="text-2xl font-bold mt-1">{formatCurrency(selectedMetrics.valorTotal)}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Orçamentos */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-primary" />
                            <span className="text-muted-foreground">Orçamentos Aceitos</span>
                          </div>
                          <p className="text-3xl font-bold mt-2">{selectedMetrics.orcamentosAceitos}</p>
                          <p className="text-xs text-muted-foreground mt-1">Prestador foi escolhido</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-destructive" />
                            <span className="text-muted-foreground">Orçamentos Não Aprovados</span>
                          </div>
                          <p className="text-3xl font-bold mt-2">{selectedMetrics.orcamentosRejeitados}</p>
                          <p className="text-xs text-muted-foreground mt-1">Rejeitados ou outro prestador escolhido</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-500" />
                            <span className="text-muted-foreground">Orçamentos Pendentes</span>
                          </div>
                          <p className="text-3xl font-bold mt-2">{selectedMetrics.orcamentosPendentes}</p>
                          <p className="text-xs text-muted-foreground mt-1">Aguardando decisão</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Gráficos */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <CalendarIcon className="h-4 w-4" />
                            Serviços por Dia da Semana
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={selectedMetrics.diasDaSemana}>
                              <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Sun className="h-4 w-4" />
                            Período do Dia
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-center gap-8 py-4">
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-2 p-4 bg-amber-500/20 rounded-full">
                                <Sun className="h-8 w-8 text-amber-500" />
                              </div>
                              <span className="text-3xl font-bold mt-2">{selectedMetrics.periodoDoDia.manha}</span>
                              <span className="text-sm text-muted-foreground">Manhã (6h-12h)</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-2 p-4 bg-destructive/20 rounded-full">
                                <Moon className="h-8 w-8 text-destructive" />
                              </div>
                              <span className="text-3xl font-bold mt-2">{selectedMetrics.periodoDoDia.tarde}</span>
                              <span className="text-sm text-muted-foreground">Tarde (12h-18h)</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {selectedMetrics.bairrosMaisAtendidos.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <MapPin className="h-4 w-4" />
                              Top Bairros Atendidos
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {selectedMetrics.bairrosMaisAtendidos.map((b, i) => (
                                <div key={b.bairro} className="flex items-center gap-3">
                                  <Badge variant="outline" className="w-6 h-6 flex items-center justify-center text-xs">
                                    {i + 1}
                                  </Badge>
                                  <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-sm font-medium">{b.bairro}</span>
                                      <span className="text-sm text-muted-foreground">{b.count} serviços</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-primary rounded-full"
                                        style={{ 
                                          width: `${(b.count / selectedMetrics.bairrosMaisAtendidos[0].count) * 100}%` 
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {selectedMetrics.categoriasMaisAtendidas.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Tag className="h-4 w-4" />
                              Top Categorias de Serviço
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {selectedMetrics.categoriasMaisAtendidas.map((c, i) => (
                                <div key={c.categoria} className="flex items-center gap-3">
                                  <Badge variant="outline" className="w-6 h-6 flex items-center justify-center text-xs">
                                    {i + 1}
                                  </Badge>
                                  <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-sm font-medium">{c.categoria}</span>
                                      <span className="text-sm text-muted-foreground">{c.count} orçamentos</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-destructive rounded-full"
                                        style={{ 
                                          width: `${(c.count / selectedMetrics.categoriasMaisAtendidas[0].count) * 100}%` 
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                )}
              </CollapsibleSection>

              {/* Tabela de Ranking */}
              <CollapsibleSection
                title="Tabela Ranking de Prestadores"
                icon={<Users className="h-5 w-5" />}
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Prestador</TableHead>
                        <TableHead className="text-center">Total Fichas</TableHead>
                        <TableHead className="text-center">Finalizados</TableHead>
                        <TableHead className="text-right">Ticket Médio</TableHead>
                        <TableHead className="text-center">Tempo Resp.</TableHead>
                        <TableHead className="text-right">MO + Peças</TableHead>
                        <TableHead className="text-center">Orç. Enviados</TableHead>
                        <TableHead className="text-center">Orç. Aceitos</TableHead>
                        <TableHead className="text-center">Não Aprov.</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metricsData.map((m, index) => (
                        <>
                          <TableRow 
                            key={m.cpf} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleRowExpansion(m.cpf)}
                          >
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{m.nome}</span>
                                {m.categoria && (
                                  <Badge variant="outline" className="text-xs">
                                    {m.categoria}
                                  </Badge>
                                )}
                                {m.isNovo && (
                                  <Badge className="text-[10px] bg-amber-500 text-white">NOVO</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{m.totalFichas}</TableCell>
                            <TableCell className="text-center">{m.totalFinalizados}</TableCell>
                            <TableCell className="text-right">{formatCurrency(m.ticketMedio)}</TableCell>
                            <TableCell className="text-center">{formatTempoResposta(m.mediaTempoResposta)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(m.valorTotal)}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">
                                {m.orcamentosEnviados}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-primary/20 text-primary">
                                {m.orcamentosAceitos}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-muted text-muted-foreground">
                                {m.orcamentosRejeitados}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {expandedRows.has(m.cpf) ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                          </TableRow>
                          {expandedRows.has(m.cpf) && (
                            <TableRow key={`${m.cpf}-expanded`}>
                              <TableCell colSpan={12} className="bg-muted/30 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-2">
                                      <CalendarIcon className="h-4 w-4" />
                                      Dias Mais Ativos
                                    </h4>
                                    <div className="flex flex-wrap gap-1">
                                      {m.diasDaSemana
                                        .filter(d => d.count > 0)
                                        .sort((a, b) => b.count - a.count)
                                        .slice(0, 3)
                                        .map(d => (
                                          <Badge key={d.dia} variant="secondary">
                                            {d.dia}: {d.count}
                                          </Badge>
                                        ))}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-2">
                                      <Sun className="h-4 w-4" />
                                      Período Preferido
                                    </h4>
                                    <div className="flex gap-2">
                                      <Badge variant={m.periodoDoDia.manha >= m.periodoDoDia.tarde ? "default" : "secondary"}>
                                        Manhã: {m.periodoDoDia.manha}
                                      </Badge>
                                      <Badge variant={m.periodoDoDia.tarde > m.periodoDoDia.manha ? "default" : "secondary"}>
                                        Tarde: {m.periodoDoDia.tarde}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-2">
                                      <MapPin className="h-4 w-4" />
                                      Top Bairros
                                    </h4>
                                    <div className="flex flex-wrap gap-1">
                                      {m.bairrosMaisAtendidos.slice(0, 3).map(b => (
                                        <Badge key={b.bairro} variant="outline">
                                          {b.bairro}: {b.count}
                                        </Badge>
                                      ))}
                                      {m.bairrosMaisAtendidos.length === 0 && (
                                        <span className="text-sm text-muted-foreground">Sem dados</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleSection>
            </>
          )}
        </main>

        <footer className="py-4 px-6 border-t bg-background/50 text-center">
          <p className="text-sm text-muted-foreground">
            24Help © {new Date().getFullYear()} — Relatório de Prestadores
          </p>
        </footer>
      </div>
    </PageLayout>
  );
};

export default PrestadoresReportPage;
