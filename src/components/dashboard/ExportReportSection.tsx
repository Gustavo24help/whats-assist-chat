import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Definição das colunas disponíveis
const AVAILABLE_COLUMNS = [
  // Cliente
  { id: "cliente_nome", label: "Nome do Cliente", group: "Cliente" },
  { id: "telefone_cliente", label: "Telefone", group: "Cliente" },
  { id: "cpf", label: "CPF", group: "Cliente" },
  { id: "endereco", label: "Endereço", group: "Cliente" },
  { id: "bairro", label: "Bairro", group: "Cliente" },
  { id: "cidade", label: "Cidade", group: "Cliente" },
  
  // Ficha
  { id: "id", label: "ID da Ficha", group: "Ficha" },
  { id: "nome_ficha", label: "Nome da Ficha", group: "Ficha" },
  { id: "descricao", label: "Descrição do Serviço", group: "Ficha" },
  { id: "created_at", label: "Data de Criação", group: "Ficha" },
  
  // Serviço
  { id: "categoria_nome", label: "Categoria do Serviço", group: "Serviço" },
  { id: "prestador_nome", label: "Prestador", group: "Serviço" },
  { id: "horario_agendamento", label: "Data de Agendamento", group: "Serviço" },
  { id: "data_visita_tecnica", label: "Data da Visita Técnica", group: "Serviço" },
  { id: "tempo_servico", label: "Tempo do Serviço", group: "Serviço" },
  
  // Status
  { id: "status", label: "Status Atual", group: "Status" },
  { id: "historico_status", label: "Histórico de Status", group: "Status" },
  
  // Financeiro
  { id: "valor_total", label: "Valor Total da OS", group: "Financeiro" },
  { id: "valor_mao_obra", label: "Valor Mão de Obra", group: "Financeiro" },
  { id: "valor_pecas", label: "Valor Material/Peças", group: "Financeiro" },
  { id: "pagamento_realizado", label: "Serviço Pago", group: "Financeiro" },
  { id: "pagamento_tipo", label: "Tipo de Pagamento", group: "Financeiro" },
];

const COLUMN_GROUPS = ["Cliente", "Ficha", "Serviço", "Status", "Financeiro"];

const PERIODO_OPTIONS = [
  { value: "todos", label: "Todo período" },
  { value: "hoje", label: "Hoje" },
  { value: "7dias", label: "Últimos 7 dias" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "mes", label: "Este mês" },
  { value: "mes_passado", label: "Mês passado" },
  { value: "personalizado", label: "Personalizado" },
];

interface FichaExportData {
  id: string;
  nome_ficha: string | null;
  telefone_cliente: string;
  nome_cliente: string | null;
  cpf: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  descricao: string | null;
  status: string | null;
  categoria_id: number | null;
  prestador_id: string | null;
  created_at: string | null;
  horario_agendamento: string | null;
  data_visita_tecnica: string | null;
  tempo_servico: string | null;
  valor_total: number | null;
  valor_mao_obra: number | null;
  valor_pecas: number | null;
  pagamento_realizado: boolean | null;
  pagamento_tipo: string | null;
}

interface StatusHistorico {
  status_anterior: string | null;
  status_novo: string;
  data_inicio: string;
  data_fim: string | null;
}

export const ExportReportSection = () => {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    "nome_ficha", "cliente_nome", "telefone_cliente", "categoria_nome", 
    "prestador_nome", "status", "valor_total", "pagamento_realizado"
  ]);
  const [selectedPeriodo, setSelectedPeriodo] = useState("30dias");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [isExporting, setIsExporting] = useState(false);

  const getDateRange = useCallback(() => {
    const hoje = new Date();
    
    switch (selectedPeriodo) {
      case "hoje":
        return { from: startOfDay(hoje), to: endOfDay(hoje) };
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

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(c => c !== columnId)
        : [...prev, columnId]
    );
  };

  const toggleGroupColumns = (group: string) => {
    const groupColumns = AVAILABLE_COLUMNS.filter(c => c.group === group).map(c => c.id);
    const allSelected = groupColumns.every(c => selectedColumns.includes(c));
    
    if (allSelected) {
      setSelectedColumns(prev => prev.filter(c => !groupColumns.includes(c)));
    } else {
      setSelectedColumns(prev => [...new Set([...prev, ...groupColumns])]);
    }
  };

  const selectAllColumns = () => {
    setSelectedColumns(AVAILABLE_COLUMNS.map(c => c.id));
  };

  const clearAllColumns = () => {
    setSelectedColumns([]);
  };

  const formatCsvValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    if (typeof value === "number") return String(value);
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatHistoricoStatus = (historico: StatusHistorico[]): string => {
    if (!historico || historico.length === 0) return "";
    
    return historico.map(h => {
      const inicio = formatDate(h.data_inicio);
      const fim = h.data_fim ? formatDate(h.data_fim) : "Atual";
      return `${h.status_novo} (${inicio} - ${fim})`;
    }).join(" | ");
  };

  const exportToCSV = async () => {
    if (selectedColumns.length === 0) {
      toast.error("Selecione pelo menos uma coluna para exportar");
      return;
    }

    setIsExporting(true);

    try {
      const range = getDateRange();
      
      // Buscar fichas
      let query = supabase
        .from("fichas_de_servico")
        .select("*")
        .order("created_at", { ascending: false });

      if (range.from) {
        query = query.gte("created_at", range.from.toISOString());
      }
      if (range.to) {
        query = query.lte("created_at", range.to.toISOString());
      }

      const { data: fichas, error: fichasError } = await query;

      if (fichasError) throw fichasError;
      if (!fichas || fichas.length === 0) {
        toast.warning("Nenhuma ficha encontrada no período selecionado");
        setIsExporting(false);
        return;
      }

      // Buscar dados relacionados
      const fichaIds = fichas.map(f => f.id);
      const categoriaIds = [...new Set(fichas.map(f => f.categoria_id).filter(Boolean))];
      const prestadorIds = [...new Set(fichas.map(f => f.prestador_id).filter(Boolean))];

      // Buscar categorias, prestadores e histórico em paralelo
      const [categoriasResult, prestadoresResult, historicoResult] = await Promise.all([
        categoriaIds.length > 0 
          ? supabase.from("categorias").select("id, nome").in("id", categoriaIds)
          : { data: [] },
        prestadorIds.length > 0
          ? supabase.from("prestadores").select("cpf, nome").in("cpf", prestadorIds)
          : { data: [] },
        selectedColumns.includes("historico_status")
          ? supabase.from("ficha_status_historico").select("*").in("ficha_id", fichaIds).order("data_inicio", { ascending: true })
          : { data: [] }
      ]);

      const categoriasMap = new Map((categoriasResult.data || []).map(c => [c.id, c.nome]));
      const prestadoresMap = new Map((prestadoresResult.data || []).map(p => [p.cpf, p.nome]));
      
      // Agrupar histórico por ficha
      const historicoMap = new Map<string, StatusHistorico[]>();
      (historicoResult.data || []).forEach(h => {
        const existing = historicoMap.get(h.ficha_id) || [];
        existing.push({
          status_anterior: h.status_anterior,
          status_novo: h.status_novo,
          data_inicio: h.data_inicio,
          data_fim: h.data_fim
        });
        historicoMap.set(h.ficha_id, existing);
      });

      // Montar dados para exportação
      const rows: string[][] = [];
      
      // Header
      const headers = selectedColumns.map(colId => {
        const col = AVAILABLE_COLUMNS.find(c => c.id === colId);
        return col ? col.label : colId;
      });
      rows.push(headers);

      // Dados
      fichas.forEach(ficha => {
        const row: string[] = selectedColumns.map(colId => {
          switch (colId) {
            case "cliente_nome":
              return formatCsvValue(ficha.nome_cliente || "");
            case "categoria_nome":
              return formatCsvValue(ficha.categoria_id ? categoriasMap.get(ficha.categoria_id) || "" : "");
            case "prestador_nome":
              return formatCsvValue(ficha.prestador_id ? prestadoresMap.get(ficha.prestador_id) || "" : "");
            case "created_at":
              return formatCsvValue(formatDate(ficha.created_at));
            case "horario_agendamento":
              return formatCsvValue(formatDate(ficha.horario_agendamento));
            case "data_visita_tecnica":
              return formatCsvValue(ficha.data_visita_tecnica || "");
            case "historico_status":
              return formatCsvValue(formatHistoricoStatus(historicoMap.get(ficha.id) || []));
            case "pagamento_realizado":
              return formatCsvValue(ficha.pagamento_realizado);
            case "valor_total":
            case "valor_mao_obra":
            case "valor_pecas":
              return formatCsvValue(ficha[colId as keyof typeof ficha] || 0);
            default:
              return formatCsvValue(ficha[colId as keyof typeof ficha]);
          }
        });
        rows.push(row);
      });

      // Gerar CSV
      const csvContent = rows.map(row => row.join(",")).join("\n");
      
      // BOM para Excel reconhecer UTF-8
      const bom = "\uFEFF";
      const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
      
      // Download
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `relatorio-fichas-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`${fichas.length} fichas exportadas com sucesso!`);
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar relatório");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5 text-brand-green" />
            Exportar Relatório
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedPeriodo} onValueChange={setSelectedPeriodo}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODO_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPeriodo === "personalizado" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dateRange.from 
                      ? `${format(dateRange.from, "dd/MM")} - ${dateRange.to ? format(dateRange.to, "dd/MM") : "..."}`
                      : "Selecionar"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                    locale={ptBR}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Ações rápidas */}
          <div className="flex items-center gap-2 text-sm">
            <Button variant="ghost" size="sm" onClick={selectAllColumns}>
              Selecionar todas
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAllColumns}>
              Limpar seleção
            </Button>
            <span className="text-muted-foreground ml-auto">
              {selectedColumns.length} colunas selecionadas
            </span>
          </div>

          {/* Grid de colunas por grupo */}
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-6">
              {COLUMN_GROUPS.map(group => {
                const groupColumns = AVAILABLE_COLUMNS.filter(c => c.group === group);
                const allSelected = groupColumns.every(c => selectedColumns.includes(c.id));
                const someSelected = groupColumns.some(c => selectedColumns.includes(c.id));

                return (
                  <div key={group} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`group-${group}`}
                        checked={allSelected}
                        onCheckedChange={() => toggleGroupColumns(group)}
                        className={cn(someSelected && !allSelected && "data-[state=checked]:bg-muted")}
                      />
                      <Label 
                        htmlFor={`group-${group}`} 
                        className="font-semibold text-sm cursor-pointer"
                      >
                        {group}
                      </Label>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 ml-6">
                      {groupColumns.map(col => (
                        <div key={col.id} className="flex items-center gap-2">
                          <Checkbox
                            id={col.id}
                            checked={selectedColumns.includes(col.id)}
                            onCheckedChange={() => toggleColumn(col.id)}
                          />
                          <Label 
                            htmlFor={col.id} 
                            className="text-sm cursor-pointer font-normal"
                          >
                            {col.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Botão de exportar */}
          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={exportToCSV} 
              disabled={isExporting || selectedColumns.length === 0}
              className="gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
