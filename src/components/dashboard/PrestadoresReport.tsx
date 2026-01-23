import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format, getDay, getHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Users, 
  Wrench, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle,
  MapPin,
  Tag,
  Calendar,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Loader2
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";

interface Prestador {
  cpf: string;
  nome: string;
  categoria: string | null;
  telefone: string;
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
}

interface PrestadorMetrics {
  cpf: string;
  nome: string;
  categoria: string | null;
  totalServicos: number;
  ticketMedio: number;
  valorTotalMaoObra: number;
  valorTotalPecas: number;
  valorTotal: number;
  orcamentosAceitos: number;
  orcamentosRejeitados: number;
  orcamentosPendentes: number;
  mediaTempoResposta: number | null; // em minutos
  bairrosMaisAtendidos: { bairro: string; count: number }[];
  categoriasMaisAtendidas: { categoria: string; count: number }[];
  diasDaSemana: { dia: string; count: number }[];
  periodoDoDia: { manha: number; tarde: number };
}

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const CORES_GRAFICO = ["hsl(var(--brand-green))", "hsl(var(--brand-yellow))", "hsl(var(--brand-coral))", "hsl(var(--brand-red))", "#8884d8", "#82ca9d"];

export const PrestadoresReport = () => {
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [fichas, setFichas] = useState<FichaServico[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [fichasParaOrcamentos, setFichasParaOrcamentos] = useState<Record<string, FichaParaOrcamento>>({});
  const [loading, setLoading] = useState(true);
  const [selectedPrestador, setSelectedPrestador] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar prestadores
      const { data: prestadoresData } = await supabase
        .from("prestadores")
        .select("cpf, nome, categoria, telefone")
        .order("nome");

      // Buscar fichas finalizadas (com prestador)
      const { data: fichasData } = await supabase
        .from("fichas_de_servico")
        .select("id, prestador_id, status, valor_total, valor_mao_obra, valor_pecas, horario_agendamento, bairro, categoria_id, created_at")
        .not("prestador_id", "is", null)
        .in("status", ["Finalizado", "Agendado", "Em andamento"]);

      // Buscar orçamentos
      const { data: orcamentosData } = await supabase
        .from("orcamentos")
        .select("id, prestador_cpf, ficha_nome, status, valor_total, data_criacao, categoria");

      // Buscar created_at das fichas para calcular tempo de resposta
      if (orcamentosData && orcamentosData.length > 0) {
        const fichaIds = [...new Set(orcamentosData.map(o => o.ficha_nome))];
        const { data: fichasOrcamentosData } = await supabase
          .from("fichas_de_servico")
          .select("id, created_at")
          .in("id", fichaIds);

        const fichasMap: Record<string, FichaParaOrcamento> = {};
        fichasOrcamentosData?.forEach(f => {
          fichasMap[f.id] = f;
        });
        setFichasParaOrcamentos(fichasMap);
      }

      setPrestadores(prestadoresData || []);
      setFichas(fichasData || []);
      setOrcamentos(orcamentosData || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const calcularMetricasPrestador = (cpf: string): PrestadorMetrics | null => {
    const prestador = prestadores.find(p => p.cpf === cpf);
    if (!prestador) return null;

    // Fichas do prestador
    const fichasDoPrestador = fichas.filter(f => f.prestador_id === cpf);
    const fichasFinalizadas = fichasDoPrestador.filter(f => f.status === "Finalizado");
    
    // Orçamentos do prestador
    const orcamentosDoPrestador = orcamentos.filter(o => o.prestador_cpf === cpf);
    const orcamentosAceitos = orcamentosDoPrestador.filter(o => o.status === "aprovado").length;
    const orcamentosRejeitados = orcamentosDoPrestador.filter(o => o.status === "rejeitado" || o.status === "Não Aprovado").length;
    const orcamentosPendentes = orcamentosDoPrestador.filter(o => o.status === "pendente").length;

    // Valores
    const valorTotal = fichasFinalizadas.reduce((acc, f) => acc + (f.valor_total || 0), 0);
    const valorTotalMaoObra = fichasFinalizadas.reduce((acc, f) => acc + (f.valor_mao_obra || 0), 0);
    const valorTotalPecas = fichasFinalizadas.reduce((acc, f) => acc + (f.valor_pecas || 0), 0);
    const ticketMedio = fichasFinalizadas.length > 0 ? valorTotal / fichasFinalizadas.length : 0;

    // Média tempo de resposta (orçamento)
    let temposResposta: number[] = [];
    orcamentosDoPrestador.forEach(orc => {
      const ficha = fichasParaOrcamentos[orc.ficha_nome];
      if (ficha?.created_at && orc.data_criacao) {
        const diff = new Date(orc.data_criacao).getTime() - new Date(ficha.created_at).getTime();
        if (diff > 0) {
          temposResposta.push(diff / (1000 * 60)); // em minutos
        }
      }
    });
    const mediaTempoResposta = temposResposta.length > 0 
      ? temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length 
      : null;

    // Bairros mais atendidos
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

    // Categorias mais atendidas (usando orçamentos que têm categoria)
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

    // Dias da semana
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
        } else if (hora >= 12 && hora < 18) {
          servicosTarde++;
        } else {
          // Serviços fora do horário comercial vão para tarde
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
      totalServicos: fichasFinalizadas.length,
      ticketMedio,
      valorTotalMaoObra,
      valorTotalPecas,
      valorTotal,
      orcamentosAceitos,
      orcamentosRejeitados,
      orcamentosPendentes,
      mediaTempoResposta,
      bairrosMaisAtendidos,
      categoriasMaisAtendidas,
      diasDaSemana,
      periodoDoDia: { manha: servicosManha, tarde: servicosTarde }
    };
  };

  const metricsData = useMemo(() => {
    return prestadores
      .map(p => calcularMetricasPrestador(p.cpf))
      .filter((m): m is PrestadorMetrics => m !== null)
      .sort((a, b) => b.totalServicos - a.totalServicos);
  }, [prestadores, fichas, orcamentos, fichasParaOrcamentos]);

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

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seletor de Prestador */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Relatório de Prestadores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedPrestador || ""} onValueChange={setSelectedPrestador}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecione um prestador para ver detalhes" />
            </SelectTrigger>
            <SelectContent>
              {prestadores.map(p => (
                <SelectItem key={p.cpf} value={p.cpf}>
                  {p.nome} {p.categoria && `(${p.categoria})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Detalhes do Prestador Selecionado */}
      {selectedMetrics && (
        <>
          {/* KPIs do Prestador */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Wrench className="h-4 w-4" />
                  Serviços
                </div>
                <p className="text-2xl font-bold mt-1">{selectedMetrics.totalServicos}</p>
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
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="text-muted-foreground">Orçamentos Não Aprovados</span>
                </div>
                <p className="text-3xl font-bold mt-2">{selectedMetrics.orcamentosRejeitados}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-brand-yellow" />
                  <span className="text-muted-foreground">Orçamentos Pendentes</span>
                </div>
                <p className="text-3xl font-bold mt-2">{selectedMetrics.orcamentosPendentes}</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dias da Semana */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" />
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

            {/* Período do Dia */}
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
                    <div className="flex items-center gap-2 p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                      <Sun className="h-8 w-8 text-yellow-500" />
                    </div>
                    <span className="text-3xl font-bold mt-2">{selectedMetrics.periodoDoDia.manha}</span>
                    <span className="text-sm text-muted-foreground">Manhã (6h-12h)</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 p-4 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                      <Moon className="h-8 w-8 text-orange-500" />
                    </div>
                    <span className="text-3xl font-bold mt-2">{selectedMetrics.periodoDoDia.tarde}</span>
                    <span className="text-sm text-muted-foreground">Tarde (12h-18h)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Bairros */}
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

            {/* Top Categorias */}
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
                              className="h-full bg-brand-coral rounded-full"
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
        </>
      )}

      {/* Tabela de Ranking de Todos os Prestadores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ranking de Prestadores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Prestador</TableHead>
                  <TableHead className="text-center">Serviços</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="text-center">Tempo Resp.</TableHead>
                  <TableHead className="text-right">Mão de Obra</TableHead>
                  <TableHead className="text-right">Peças</TableHead>
                  <TableHead className="text-center">Aceitos</TableHead>
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
                        <div>
                          <span className="font-medium">{m.nome}</span>
                          {m.categoria && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {m.categoria}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{m.totalServicos}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.ticketMedio)}</TableCell>
                      <TableCell className="text-center">{formatTempoResposta(m.mediaTempoResposta)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.valorTotalMaoObra)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.valorTotalPecas)}</TableCell>
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
                      <TableRow>
                        <TableCell colSpan={10} className="bg-muted/30 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Dias mais ativos */}
                            <div>
                              <h4 className="font-medium mb-2 flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
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
                            {/* Período preferido */}
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
                            {/* Top Bairros */}
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
        </CardContent>
      </Card>
    </div>
  );
};
