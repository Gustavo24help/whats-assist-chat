import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  FileText, 
  MessageCircle, 
  CheckCircle2, 
  Clock,
  TrendingUp,
  Settings2
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type FichaDeServico = Database["public"]["Tables"]["fichas_de_servico"]["Row"];

interface FichaWithData extends FichaDeServico {
  cliente_nome?: string;
  prestador_nome?: string;
  orcamentos_count?: number;
}

interface FichasDashboardProps {
  fichas: FichaWithData[];
  conversasAbertas: number;
  onStatusFilter: (status: string) => void;
  onPagamentoFilter: (filter: string) => void;
  selectedStatus: string;
  selectedPagamento: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Ficha Criada": { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
  "Contato Inicial": { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/30" },
  "Dúvida Prestador": { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30" },
  "Orçamento Enviado": { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/30" },
  "Negociação": { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30" },
  "Visita Técnica": { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400", border: "border-pink-500/30" },
  "Orçamento Aprovado / Agendamento": { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  "Orçamento Não Aprovado": { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30" },
  "Agendado": { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/30" },
  "Em andamento": { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
  "Finalizado": { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/30" },
  "Garantia": { bg: "bg-lime-500/10", text: "text-lime-600 dark:text-lime-400", border: "border-lime-500/30" },
  "Perdido": { bg: "bg-gray-500/10", text: "text-gray-600 dark:text-gray-400", border: "border-gray-500/30" },
  "Não foi adiante": { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", border: "border-slate-500/30" },
  "pendente": { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30" },
};

const STORAGE_KEY = "fichas-status-visibility";

export const FichasDashboard = ({ 
  fichas, 
  conversasAbertas, 
  onStatusFilter, 
  onPagamentoFilter,
  selectedStatus,
  selectedPagamento
}: FichasDashboardProps) => {
  const [hiddenStatuses, setHiddenStatuses] = useState<string[]>([]);

  // Carregar preferências do localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setHiddenStatuses(JSON.parse(saved));
      } catch {
        setHiddenStatuses([]);
      }
    }
  }, []);

  // Salvar preferências no localStorage
  const toggleStatusVisibility = (status: string) => {
    setHiddenStatuses(prev => {
      const newHidden = prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHidden));
      return newHidden;
    });
  };

  // Calcular métricas
  const metrics = useMemo(() => {
    const total = fichas.length;
    const pagos = fichas.filter(f => f.pagamento_realizado === true).length;
    const pendentes = fichas.filter(f => f.pagamento_link && f.pagamento_realizado !== true).length;
    
    // Agrupar por status
    const statusCount = fichas.reduce((acc, ficha) => {
      const status = ficha.status || "Sem status";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Ordenar por quantidade (maior para menor)
    const statusEntries = Object.entries(statusCount).sort((a, b) => b[1] - a[1]);

    return { total, pagos, pendentes, statusEntries };
  }, [fichas]);

  // Filtrar status visíveis
  const visibleStatusEntries = metrics.statusEntries.filter(
    ([status]) => !hiddenStatuses.includes(status)
  );

  return (
    <div className="space-y-4">
      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Fichas Criadas */}
        <Card 
          className={cn(
            "p-3 cursor-pointer transition-all hover:shadow-md border-2",
            selectedStatus === "Todos" && selectedPagamento === "Todos"
              ? "border-primary bg-primary/5" 
              : "border-transparent hover:border-primary/30"
          )}
          onClick={() => {
            onStatusFilter("Todos");
            onPagamentoFilter("Todos");
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">Fichas Criadas</p>
              <p className="text-xl sm:text-2xl font-bold text-primary mt-0.5">{metrics.total}</p>
            </div>
            <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Total no período</span>
          </div>
        </Card>

        {/* Conversas Abertas */}
        <Card className="p-3 border-2 border-transparent">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">Conversas Abertas</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {conversasAbertas}
              </p>
            </div>
            <div className="p-1.5 bg-emerald-500/10 rounded-lg relative flex-shrink-0">
              <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {conversasAbertas > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-muted-foreground">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Janela 24h ativa</span>
          </div>
        </Card>

        {/* Pagos */}
        <Card 
          className={cn(
            "p-3 cursor-pointer transition-all hover:shadow-md border-2",
            selectedPagamento === "pagos" 
              ? "border-green-500 bg-green-500/5" 
              : "border-transparent hover:border-green-500/30"
          )}
          onClick={() => onPagamentoFilter(selectedPagamento === "pagos" ? "Todos" : "pagos")}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">Pagos</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 mt-0.5">
                {metrics.pagos}
              </p>
            </div>
            <div className="p-1.5 bg-green-500/10 rounded-lg flex-shrink-0">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-green-600/70 dark:text-green-400/70">
            <span className="truncate">{metrics.total > 0 ? ((metrics.pagos / metrics.total) * 100).toFixed(1) : 0}% do total</span>
          </div>
        </Card>

        {/* Pendentes */}
        <Card 
          className={cn(
            "p-3 cursor-pointer transition-all hover:shadow-md border-2",
            selectedPagamento === "pendentes" 
              ? "border-amber-500 bg-amber-500/5" 
              : "border-transparent hover:border-amber-500/30"
          )}
          onClick={() => onPagamentoFilter(selectedPagamento === "pendentes" ? "Todos" : "pendentes")}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">Pendentes</p>
              <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {metrics.pendentes}
              </p>
            </div>
            <div className="p-1.5 bg-amber-500/10 rounded-lg flex-shrink-0">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-amber-600/70 dark:text-amber-400/70">
            <span className="truncate">Com link de pagamento</span>
          </div>
        </Card>
      </div>

      {/* Distribuição por Status - Grid em duas linhas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-foreground">Distribuição por Status</h3>
            
            {/* Botão de configuração */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3 bg-popover border shadow-lg z-50" align="start">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Configurar Status Visíveis</h4>
                    <Badge variant="outline" className="text-[10px]">
                      {visibleStatusEntries.length}/{metrics.statusEntries.length}
                    </Badge>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {metrics.statusEntries.map(([status, count]) => {
                      const colors = STATUS_COLORS[status] || STATUS_COLORS["pendente"];
                      const isVisible = !hiddenStatuses.includes(status);
                      
                      return (
                        <label
                          key={status}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={isVisible}
                            onCheckedChange={() => toggleStatusVisibility(status)}
                          />
                          <div className="flex-1 flex items-center justify-between">
                            <span className={cn("text-xs font-medium", colors.text)}>
                              {status}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1.5">
                              {count}
                            </Badge>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
            {visibleStatusEntries.length} ativos
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {visibleStatusEntries.map(([status, count]) => {
            const colors = STATUS_COLORS[status] || STATUS_COLORS["pendente"];
            const percentage = metrics.total > 0 ? ((count / metrics.total) * 100).toFixed(1) : 0;
            const isSelected = selectedStatus === status;
            
            return (
              <Card
                key={status}
                className={cn(
                  "p-2 cursor-pointer transition-all hover:shadow-sm border",
                  colors.bg,
                  isSelected ? `${colors.border} shadow-sm` : "border-transparent hover:border-border"
                )}
                onClick={() => onStatusFilter(isSelected ? "Todos" : status)}
              >
                <p className={cn("text-[10px] font-medium line-clamp-2 leading-tight min-h-[28px]", colors.text)}>
                  {status}
                </p>
                <p className={cn("text-lg font-bold", colors.text)}>
                  {count}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {percentage}%
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
