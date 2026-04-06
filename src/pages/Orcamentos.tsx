import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, Search, Filter, X, ClipboardList, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface OrcamentoRow {
  id: string;
  ficha_nome: string;
  prestador_cpf: string;
  valor_total: number;
  valor_mao_obra: number | null;
  valor_pecas: number | null;
  status: string | null;
  data_criacao: string | null;
  tempo_servico: string | null;
  observacoes: string | null;
  horario_sugerido: string | null;
  pode_horario: boolean | null;
}

interface Prestador {
  cpf: string;
  nome: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const statusColor = (status: string | null) => {
  switch (status) {
    case "aprovado": return "bg-green-100 text-green-800";
    case "rejeitado": return "bg-red-100 text-red-800";
    case "pendente": return "bg-yellow-100 text-yellow-800";
    default: return "bg-muted text-muted-foreground";
  }
};

const statusLabel = (status: string | null) => {
  switch (status) {
    case "aprovado": return "Aprovado";
    case "rejeitado": return "Não Aprovado";
    case "pendente": return "Pendente";
    default: return status || "—";
  }
};

export default function Orcamentos() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoRow[]>([]);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [fichaClientes, setFichaClientes] = useState<Map<string, { nome_cliente: string | null; telefone_cliente: string }>>(new Map());
  const [loading, setLoading] = useState(true);

  // Filters
  const [filtroFicha, setFiltroFicha] = useState("");
  const [filtroPrestador, setFiltroPrestador] = useState("todos");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: orcData }, { data: prestData }] = await Promise.all([
        supabase.from("orcamentos").select("*").order("data_criacao", { ascending: false }),
        supabase.from("prestadores").select("cpf, nome"),
      ]);

      setOrcamentos(orcData || []);
      setPrestadores(prestData || []);

      // Fetch client info for all fichas referenced
      const fichaIds = [...new Set((orcData || []).map(o => o.ficha_nome))];
      if (fichaIds.length > 0) {
        const { data: fichasData } = await supabase
          .from("fichas_de_servico")
          .select("id, nome_cliente, telefone_cliente")
          .in("id", fichaIds);

        const map = new Map<string, { nome_cliente: string | null; telefone_cliente: string }>();
        (fichasData || []).forEach(f => map.set(f.id, { nome_cliente: f.nome_cliente, telefone_cliente: f.telefone_cliente }));
        setFichaClientes(map);
      }
    } catch (err) {
      console.error("Erro ao carregar orçamentos:", err);
    } finally {
      setLoading(false);
    }
  };

  const prestadorMap = useMemo(() => {
    const m = new Map<string, string>();
    prestadores.forEach(p => m.set(p.cpf, p.nome));
    return m;
  }, [prestadores]);

  const orcamentosFiltrados = useMemo(() => {
    return orcamentos.filter(o => {
      if (filtroFicha && !o.ficha_nome.toLowerCase().includes(filtroFicha.toLowerCase())) return false;
      if (filtroPrestador !== "todos" && o.prestador_cpf !== filtroPrestador) return false;
      if (filtroStatus !== "todos" && o.status !== filtroStatus) return false;

      if (filtroCliente) {
        const cliente = fichaClientes.get(o.ficha_nome);
        if (!cliente) return false;
        const search = filtroCliente.toLowerCase();
        const match = (cliente.nome_cliente || "").toLowerCase().includes(search) ||
          cliente.telefone_cliente.includes(search);
        if (!match) return false;
      }

      if (dataInicio && o.data_criacao) {
        const d = new Date(o.data_criacao);
        if (d < dataInicio) return false;
      }
      if (dataFim && o.data_criacao) {
        const d = new Date(o.data_criacao);
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        if (d > fim) return false;
      }

      return true;
    });
  }, [orcamentos, filtroFicha, filtroPrestador, filtroCliente, filtroStatus, dataInicio, dataFim, fichaClientes]);

  const limparFiltros = () => {
    setFiltroFicha("");
    setFiltroPrestador("todos");
    setFiltroCliente("");
    setFiltroStatus("todos");
    setDataInicio(undefined);
    setDataFim(undefined);
  };

  const temFiltroAtivo = filtroFicha || filtroPrestador !== "todos" || filtroCliente || filtroStatus !== "todos" || dataInicio || dataFim;

  return (
    <PageLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Orçamentos</h1>
            <Badge variant="secondary" className="ml-2">{orcamentosFiltrados.length}</Badge>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filtros
              {temFiltroAtivo && (
                <Button variant="ghost" size="sm" onClick={limparFiltros} className="ml-auto h-7 text-xs">
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ficha</Label>
                <Input
                  placeholder="ID da ficha..."
                  value={filtroFicha}
                  onChange={e => setFiltroFicha(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Prestador</Label>
                <Select value={filtroPrestador} onValueChange={setFiltroPrestador}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {prestadores.map(p => (
                      <SelectItem key={p.cpf} value={p.cpf}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Cliente</Label>
                <Input
                  placeholder="Nome ou telefone..."
                  value={filtroCliente}
                  onChange={e => setFiltroCliente(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="rejeitado">Não Aprovado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Data início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-8 w-full text-xs justify-start", !dataInicio && "text-muted-foreground")}>
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Data fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-8 w-full text-xs justify-start", !dataFim && "text-muted-foreground")}>
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataFim} onSelect={setDataFim} locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : orcamentosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhum orçamento encontrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Ficha</TableHead>
                    <TableHead className="text-xs">Prestador</TableHead>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs text-right">Mão de Obra</TableHead>
                    <TableHead className="text-xs text-right">Peças</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                    <TableHead className="text-xs">Tempo</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orcamentosFiltrados.map(o => {
                    const cliente = fichaClientes.get(o.ficha_nome);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="text-xs font-mono">{o.ficha_nome}</TableCell>
                        <TableCell className="text-xs">{prestadorMap.get(o.prestador_cpf) || o.prestador_cpf}</TableCell>
                        <TableCell className="text-xs">{cliente?.nome_cliente || cliente?.telefone_cliente || "—"}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(o.valor_mao_obra || 0)}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(o.valor_pecas || 0)}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{formatCurrency(o.valor_total || 0)}</TableCell>
                        <TableCell className="text-xs">{o.tempo_servico || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs", statusColor(o.status))}>
                            {statusLabel(o.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {o.data_criacao ? format(parseISO(o.data_criacao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={o.observacoes || ""}>
                          {o.observacoes || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
