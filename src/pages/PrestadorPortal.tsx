import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ChevronDown, LogOut, CheckCircle2, XCircle, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Prestador {
  cpf: string;
  nome: string;
  telefone: string;
  categoria: string | null;
  especialidade: string | null;
}

interface Orcamento {
  id: string;
  valor_total: number;
  valor_mao_obra: number | null;
  valor_pecas: number | null;
  data_criacao: string;
  prestador_cpf: string;
  ficha_nome: string;
  tempo_servico: string | null;
  observacoes: string | null;
  ficha?: {
    id: string;
    descricao: string;
    prestador_id: string | null;
    status: string;
    horario_agendamento: string | null;
    endereco: string | null;
    nome_ficha: string | null;
  };
}

interface Servico {
  id: string;
  nome_ficha: string | null;
  descricao: string | null;
  status: string;
  horario_agendamento: string | null;
  horario_visita_tecnica: string | null;
  endereco: string | null;
  valor_total: number;
  valor_mao_obra: number | null;
  valor_pecas: number | null;
  tempo_servico: string | null;
  updated_at: string;
}

export default function PrestadorPortal() {
  const [cpf, setCpf] = useState("");
  const [prestador, setPrestador] = useState<Prestador | null>(null);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return value;
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCPF(e.target.value));
  };

  const handleLogin = async () => {
    const cpfLimpo = cpf.replace(/\D/g, "");
    
    if (cpfLimpo.length !== 11) {
      toast.error("CPF inválido", {
        description: "Por favor, digite um CPF válido com 11 dígitos.",
      });
      return;
    }

    setLoading(true);

    try {
      // Buscar prestador
      const { data: prestadorData, error: prestadorError } = await supabase
        .from("prestadores")
        .select("*")
        .eq("cpf", cpfLimpo)
        .maybeSingle();

      if (prestadorError) throw prestadorError;

      if (!prestadorData) {
        toast.error("CPF não encontrado", {
          description: "Não encontramos um prestador com este CPF.",
        });
        setLoading(false);
        return;
      }

      setPrestador(prestadorData);

      // Buscar orçamentos
      const { data: orcamentosData, error: orcamentosError } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("prestador_cpf", cpfLimpo)
        .order("data_criacao", { ascending: false });

      if (orcamentosError) throw orcamentosError;
      
      // Buscar fichas relacionadas aos orçamentos
      const orcamentosComFicha = await Promise.all(
        (orcamentosData || []).map(async (orc) => {
          const { data: fichaData } = await supabase
            .from("fichas_de_servico")
            .select("id, descricao, prestador_id, status, horario_agendamento, endereco, nome_ficha")
            .eq("id", orc.ficha_nome)
            .maybeSingle();
          
          return {
            ...orc,
            ficha: fichaData || undefined
          };
        })
      );
      
      setOrcamentos(orcamentosComFicha);

      // Buscar serviços vinculados (incluindo visitas técnicas)
      const { data: servicosData, error: servicosError } = await supabase
        .from("fichas_de_servico")
        .select("*")
        .eq("prestador_id", cpfLimpo)
        .in("status", ["Agendado", "Finalizado", "Em andamento", "Visita Técnica"])
        .order("horario_agendamento", { ascending: true });

      if (servicosError) throw servicosError;
      setServicos(servicosData || []);

      toast.success("Bem-vindo!", {
        description: `Olá, ${prestadorData.nome}`,
      });
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro ao carregar dados", {
        description: "Ocorreu um erro ao buscar seus dados. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setPrestador(null);
    setOrcamentos([]);
    setServicos([]);
    setCpf("");
  };

  const getOrcamentoStatus = (orcamento: Orcamento) => {
    const ficha = orcamento.ficha;
    if (!ficha) return "pendente";

    const cpfLimpo = cpf.replace(/\D/g, "");
    if (ficha.prestador_id === cpfLimpo) return "aprovado";
    if (ficha.prestador_id && ficha.prestador_id !== cpfLimpo) return "rejeitado";
    return "pendente";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aprovado":
        return (
          <Badge className="bg-green-500 hover:bg-green-600 text-white">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Aprovado
          </Badge>
        );
      case "rejeitado":
        return (
          <Badge className="bg-red-500 hover:bg-red-600 text-white">
            <XCircle className="w-3 h-3 mr-1" />
            Rejeitado
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const servicosAgendados = servicos.filter(s => s.status === "Agendado" || s.status === "Em andamento");
  const servicosFinalizados = servicos.filter(s => s.status === "Finalizado");
  const visitasTecnicas = servicos.filter(s => s.status === "Visita Técnica");

  const getServicosNaData = (date: Date) => {
    return servicos.filter(s => {
      if (!s.horario_agendamento) return false;
      const servicoDate = new Date(s.horario_agendamento);
      return servicoDate.toDateString() === date.toDateString();
    });
  };

  const servicosNaDataSelecionada = selectedDate ? getServicosNaData(selectedDate) : [];

  // Modificadores para o calendário
  const modifiers = {
    agendado: servicosAgendados
      .filter(s => s.horario_agendamento)
      .map(s => new Date(s.horario_agendamento!)),
    finalizado: servicosFinalizados
      .filter(s => s.horario_agendamento)
      .map(s => new Date(s.horario_agendamento!)),
    visitaTecnica: visitasTecnicas
      .filter(s => s.horario_visita_tecnica)
      .map(s => new Date(s.horario_visita_tecnica!)),
  };

  const modifiersClassNames = {
    agendado: "bg-orange-500 text-white hover:bg-orange-600",
    finalizado: "bg-green-500 text-white hover:bg-green-600",
    visitaTecnica: "bg-blue-500 text-white hover:bg-blue-600",
  };

  if (!prestador) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">🔧 Portal do Prestador</CardTitle>
            <CardDescription>Digite seu CPF para acessar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                type="text"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={handleCPFChange}
                maxLength={14}
                className="h-12"
              />
            </div>
            <Button
              onClick={handleLogin}
              disabled={loading}
              className="w-full h-12"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">🔧 Portal do Prestador</CardTitle>
                <CardDescription className="mt-2 flex flex-wrap gap-3">
                  <span>👤 {prestador.nome}</span>
                  {prestador.categoria && <span>📋 {prestador.categoria}</span>}
                  {prestador.especialidade && <span>🔧 {prestador.especialidade}</span>}
                  <span>📞 {prestador.telefone}</span>
                </CardDescription>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="orcamentos" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="orcamentos">Orçamentos</TabsTrigger>
            <TabsTrigger value="calendario">Calendário</TabsTrigger>
            <TabsTrigger value="lista">Lista de Serviços</TabsTrigger>
          </TabsList>

          {/* Aba: Orçamentos */}
          <TabsContent value="orcamentos">
            <Card>
              <CardHeader>
                <CardTitle>📋 Meus Orçamentos</CardTitle>
                <CardDescription>
                  Total de {orcamentos.length} orçamento{orcamentos.length !== 1 ? "s" : ""} enviado{orcamentos.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {orcamentos.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Você ainda não enviou nenhum orçamento.
                      </p>
                    ) : (
                      orcamentos.map((orc) => {
                        const status = getOrcamentoStatus(orc);
                        return (
                          <Card key={orc.id} className="border-2">
                            <CardContent className="pt-6">
                              <div className="flex items-start justify-between mb-3">
                                <div className="space-y-1">
                                  <h3 className="font-semibold text-lg">{orc.ficha?.nome_ficha || orc.ficha_nome}</h3>
                                  <p className="text-sm text-muted-foreground">{orc.ficha?.descricao}</p>
                                </div>
                                {getStatusBadge(status)}
                              </div>
                              <div className="grid grid-cols-2 gap-4 mb-2">
                                <div>
                                  <span className="text-xs text-muted-foreground">Mão de Obra</span>
                                  <p className="font-semibold text-lg text-primary">
                                    R$ {orc.valor_mao_obra?.toFixed(2) || "0,00"}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-xs text-muted-foreground">Peças e Materiais</span>
                                  <p className="font-semibold text-lg text-primary">
                                    R$ {orc.valor_pecas?.toFixed(2) || "0,00"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <span>
                                  Enviado em {format(new Date(orc.data_criacao), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                                {orc.tempo_servico && (
                                  <span>⏱️ {orc.tempo_servico}</span>
                                )}
                              </div>
                              {status === "rejeitado" && (
                                <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
                                  ⚠️ Outro prestador foi selecionado para este serviço
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba: Calendário */}
          <TabsContent value="calendario">
            <Card>
              <CardHeader>
                <CardTitle>📅 Calendário de Serviços</CardTitle>
                <CardDescription>Visualize seus serviços agendados e finalizados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    modifiers={modifiers}
                    modifiersClassNames={modifiersClassNames}
                    className="rounded-md border"
                    locale={ptBR}
                  />
                </div>

                <div className="flex gap-4 justify-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                    <span>Agendado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                    <span>Visita Técnica</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span>Finalizado</span>
                  </div>
                </div>

                {selectedDate && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Serviços em {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}:
                    </h3>
                    {servicosNaDataSelecionada.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum serviço nesta data.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {servicosNaDataSelecionada.map((servico) => {
                          const isVisitaTecnica = servico.status === "Visita Técnica";
                          const horario = isVisitaTecnica 
                            ? servico.horario_visita_tecnica 
                            : servico.horario_agendamento;
                          
                          return (
                            <Card key={servico.id} className="border-2">
                              <CardContent className="pt-4">
                                <div className="flex items-start gap-3">
                                  <div className={`w-3 h-3 rounded-full mt-1 ${
                                    isVisitaTecnica 
                                      ? "bg-blue-500" 
                                      : servico.status === "Finalizado" 
                                        ? "bg-green-500" 
                                        : "bg-orange-500"
                                  }`}></div>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-semibold">
                                        {horario && format(new Date(horario), "HH:mm", { locale: ptBR })}
                                        {" - "}
                                        {servico.nome_ficha || servico.id}
                                      </h4>
                                      <Badge variant={servico.status === "Finalizado" ? "default" : "secondary"}>
                                        {servico.status}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{servico.descricao}</p>
                                    {servico.endereco && (
                                      <p className="text-sm flex items-center gap-1 text-muted-foreground">
                                        <MapPin className="w-3 h-3" />
                                        {servico.endereco}
                                      </p>
                                    )}
                                    {!isVisitaTecnica && (
                                      <div className="flex gap-3 text-sm">
                                        {servico.valor_mao_obra && servico.valor_mao_obra > 0 && (
                                          <span className="font-medium text-primary">
                                            Mão de obra: R$ {servico.valor_mao_obra.toFixed(2)}
                                          </span>
                                        )}
                                        {servico.valor_pecas && servico.valor_pecas > 0 && (
                                          <span className="font-medium text-primary">
                                            Peças: R$ {servico.valor_pecas.toFixed(2)}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba: Lista de Serviços */}
          <TabsContent value="lista">
            <Card>
              <CardHeader>
                <CardTitle>📋 Meus Serviços</CardTitle>
                <CardDescription>
                  {servicosAgendados.length} agendado{servicosAgendados.length !== 1 ? "s" : ""} • {visitasTecnicas.length} visita{visitasTecnicas.length !== 1 ? "s" : ""} técnica{visitasTecnicas.length !== 1 ? "s" : ""} • {servicosFinalizados.length} finalizado{servicosFinalizados.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {/* Agendados */}
                    <Collapsible defaultOpen>
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors">
                        <span className="font-semibold flex items-center gap-2">
                          🟠 Agendados ({servicosAgendados.length})
                        </span>
                        <ChevronDown className="w-5 h-5" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-3">
                        {servicosAgendados.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum serviço agendado.
                          </p>
                        ) : (
                          servicosAgendados.map((servico) => (
                          <Card key={servico.id} className="border-l-4 border-l-orange-500">
                              <CardContent className="pt-4">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-semibold">
                                      {servico.nome_ficha || servico.id}
                                    </h4>
                                    <Badge variant="secondary">{servico.status}</Badge>
                                  </div>
                                  {servico.horario_agendamento && (
                                    <p className="text-sm text-muted-foreground">
                                      📅 {format(new Date(servico.horario_agendamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                  )}
                                  <p className="text-sm">{servico.descricao}</p>
                                  {servico.endereco && (
                                    <p className="text-sm flex items-center gap-1 text-muted-foreground">
                                      <MapPin className="w-3 h-3" />
                                      {servico.endereco}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-3 text-sm">
                                    {servico.valor_mao_obra && servico.valor_mao_obra > 0 && (
                                      <span className="font-semibold text-primary">
                                        Mão de obra: R$ {servico.valor_mao_obra.toFixed(2)}
                                      </span>
                                    )}
                                    {servico.valor_pecas && servico.valor_pecas > 0 && (
                                      <span className="font-semibold text-primary">
                                        Peças: R$ {servico.valor_pecas.toFixed(2)}
                                      </span>
                                    )}
                                    {servico.tempo_servico && (
                                      <span className="text-muted-foreground">⏱️ {servico.tempo_servico}</span>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Visitas Técnicas */}
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors">
                        <span className="font-semibold flex items-center gap-2">
                          🔵 Visitas Técnicas ({visitasTecnicas.length})
                        </span>
                        <ChevronDown className="w-5 h-5" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-3">
                        {visitasTecnicas.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhuma visita técnica agendada.
                          </p>
                        ) : (
                          visitasTecnicas.map((servico) => (
                            <Card key={servico.id} className="border-l-4 border-l-blue-500">
                              <CardContent className="pt-4">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-semibold">
                                      {servico.nome_ficha || servico.id}
                                    </h4>
                                    <Badge className="bg-blue-500 hover:bg-blue-600 text-white">
                                      {servico.status}
                                    </Badge>
                                  </div>
                                  {servico.horario_visita_tecnica && (
                                    <p className="text-sm text-muted-foreground">
                                      📅 {format(new Date(servico.horario_visita_tecnica), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                  )}
                                  <p className="text-sm">{servico.descricao}</p>
                                  {servico.endereco && (
                                    <p className="text-sm flex items-center gap-1 text-muted-foreground">
                                      <MapPin className="w-3 h-3" />
                                      {servico.endereco}
                                    </p>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Finalizados */}
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-green-50 dark:bg-green-950/30 rounded-lg hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors">
                        <span className="font-semibold flex items-center gap-2">
                          🟢 Finalizados ({servicosFinalizados.length})
                        </span>
                        <ChevronDown className="w-5 h-5" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-3">
                        {servicosFinalizados.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum serviço finalizado.
                          </p>
                        ) : (
                          servicosFinalizados.map((servico) => (
                            <Card key={servico.id} className="border-l-4 border-l-green-500">
                              <CardContent className="pt-4">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-semibold">
                                      {servico.nome_ficha || servico.id}
                                    </h4>
                                    <Badge className="bg-green-500 hover:bg-green-600 text-white">
                                      {servico.status}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    ✅ Finalizado em {format(new Date(servico.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                                  </p>
                                  <p className="text-sm">{servico.descricao}</p>
                                  {servico.endereco && (
                                    <p className="text-sm flex items-center gap-1 text-muted-foreground">
                                      <MapPin className="w-3 h-3" />
                                      {servico.endereco}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-3 text-sm">
                                    {servico.valor_mao_obra && servico.valor_mao_obra > 0 && (
                                      <span className="font-semibold text-primary">
                                        Mão de obra: R$ {servico.valor_mao_obra.toFixed(2)}
                                      </span>
                                    )}
                                    {servico.valor_pecas && servico.valor_pecas > 0 && (
                                      <span className="font-semibold text-primary">
                                        Peças: R$ {servico.valor_pecas.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
