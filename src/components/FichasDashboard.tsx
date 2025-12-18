import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
  FileText, 
  MessageCircle, 
  CheckCircle2, 
  Clock,
  TrendingUp
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

export const FichasDashboard = ({ 
  fichas, 
  conversasAbertas, 
  onStatusFilter, 
  onPagamentoFilter,
  selectedStatus,
  selectedPagamento
}: FichasDashboardProps) => {
  // Calcular métricas
  const metrics = useMemo(() => {
    const total = fichas.length;
    const pagos = fichas.filter(f => f.pagamento_realizado === true).length;
    // Pendentes: apenas fichas que TÊM link de pagamento e NÃO foram pagas
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

  return (
    <div className="space-y-6">
      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fichas Criadas */}
        <Card 
          className={cn(
            "p-4 cursor-pointer transition-all hover:shadow-lg border-2",
            selectedStatus === "Todos" && selectedPagamento === "Todos"
              ? "border-primary bg-primary/5" 
              : "border-transparent hover:border-primary/30"
          )}
          onClick={() => {
            onStatusFilter("Todos");
            onPagamentoFilter("Todos");
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fichas Criadas</p>
              <p className="text-3xl font-bold text-primary mt-1">{metrics.total}</p>
            </div>
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Total no período</span>
          </div>
        </Card>

        {/* Conversas Abertas */}
        <Card className="p-4 border-2 border-transparent">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Conversas Abertas</p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {conversasAbertas}
              </p>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg relative">
              <MessageCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              {conversasAbertas > 0 && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full animate-pulse" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Janela 24h ativa</span>
          </div>
        </Card>

        {/* Pagos */}
        <Card 
          className={cn(
            "p-4 cursor-pointer transition-all hover:shadow-lg border-2",
            selectedPagamento === "pagos" 
              ? "border-green-500 bg-green-500/5" 
              : "border-transparent hover:border-green-500/30"
          )}
          onClick={() => onPagamentoFilter(selectedPagamento === "pagos" ? "Todos" : "pagos")}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pagos</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                {metrics.pagos}
              </p>
            </div>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-green-600/70 dark:text-green-400/70">
            <span>{metrics.total > 0 ? ((metrics.pagos / metrics.total) * 100).toFixed(1) : 0}% do total</span>
          </div>
        </Card>

        {/* Pendentes */}
        <Card 
          className={cn(
            "p-4 cursor-pointer transition-all hover:shadow-lg border-2",
            selectedPagamento === "pendentes" 
              ? "border-amber-500 bg-amber-500/5" 
              : "border-transparent hover:border-amber-500/30"
          )}
          onClick={() => onPagamentoFilter(selectedPagamento === "pendentes" ? "Todos" : "pendentes")}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {metrics.pendentes}
              </p>
            </div>
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-amber-600/70 dark:text-amber-400/70">
            <span>Com link de pagamento</span>
          </div>
        </Card>
      </div>

      {/* Régua de Status */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Distribuição por Status</h3>
          <Badge variant="outline" className="text-xs">
            {metrics.statusEntries.length} status ativos
          </Badge>
        </div>
        
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-3">
            {metrics.statusEntries.map(([status, count]) => {
              const colors = STATUS_COLORS[status] || STATUS_COLORS["pendente"];
              const percentage = metrics.total > 0 ? ((count / metrics.total) * 100).toFixed(1) : 0;
              const isSelected = selectedStatus === status;
              
              return (
                <Card
                  key={status}
                  className={cn(
                    "flex-shrink-0 p-3 min-w-[140px] cursor-pointer transition-all hover:shadow-md border-2",
                    colors.bg,
                    isSelected ? `${colors.border} shadow-md` : "border-transparent hover:border-border"
                  )}
                  onClick={() => onStatusFilter(isSelected ? "Todos" : status)}
                >
                  <p className={cn("text-xs font-medium truncate", colors.text)}>
                    {status}
                  </p>
                  <p className={cn("text-2xl font-bold mt-1", colors.text)}>
                    {count}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {percentage}%
                  </p>
                </Card>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
};
