import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Eye, 
  CheckCircle2, 
  XCircle,
  Clock,
  Users,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

interface FichaComVisita {
  id: string;
  nome_ficha: string | null;
  status: string | null;
  prestador_id: string | null;
  prestador_nome?: string;
  data_visita_tecnica: string | null;
}

interface ConversaoPrestador {
  cpf: string;
  nome: string;
  totalVisitas: number;
  convertidos: number;
  perdidos: number;
  emAndamento: number;
  taxaConversao: number;
}

interface VisitaConversaoKPIsProps {
  periodoFrom?: Date;
  periodoTo?: Date;
}

// Status que indicam conversão bem-sucedida
const STATUS_CONVERTIDO = [
  "Agendado",
  "Em andamento",
  "Finalizado",
  "Garantia",
];

// Status que indicam perda
const STATUS_PERDIDO = [
  "Perdido",
  "Não foi adiante",
  "Orçamento Não Aprovado",
];

// Status ainda em andamento/processo
const STATUS_EM_ANDAMENTO = [
  "Visita Técnica",
  "Orçamento Aprovado / Agendamento",
  "Negociação",
  "Orçamento Enviado",
  "Dúvida Prestador",
  "Contato Inicial",
  "Ficha Criada",
];

export const VisitaConversaoKPIs = ({ periodoFrom, periodoTo }: VisitaConversaoKPIsProps) => {
  const [loading, setLoading] = useState(true);
  const [fichasComVisita, setFichasComVisita] = useState<FichaComVisita[]>([]);
  const [conversaoPorPrestador, setConversaoPorPrestador] = useState<ConversaoPrestador[]>([]);
  const [showDetalhes, setShowDetalhes] = useState(false);

  useEffect(() => {
    fetchVisitas();
  }, [periodoFrom, periodoTo]);

  const fetchVisitas = async () => {
    setLoading(true);
    try {
      // Buscar fichas que têm data_visita_tecnica preenchida
      let query = supabase
        .from("fichas_de_servico")
        .select("id, nome_ficha, status, prestador_id, data_visita_tecnica")
        .not("data_visita_tecnica", "is", null)
        .order("data_visita_tecnica", { ascending: false });

      if (periodoFrom) {
        query = query.gte("data_visita_tecnica", periodoFrom.toISOString().split('T')[0]);
      }
      if (periodoTo) {
        query = query.lte("data_visita_tecnica", periodoTo.toISOString().split('T')[0]);
      }

      const { data: fichasData } = await query;

      if (!fichasData || fichasData.length === 0) {
        setFichasComVisita([]);
        setConversaoPorPrestador([]);
        setLoading(false);
        return;
      }

      // Buscar nomes dos prestadores
      const cpfs = [...new Set(fichasData.map(f => f.prestador_id).filter(Boolean))];
      const { data: prestadoresData } = await supabase
        .from("prestadores")
        .select("cpf, nome")
        .in("cpf", cpfs);

      const prestadoresMap = new Map(prestadoresData?.map(p => [p.cpf, p.nome]) || []);

      // Adicionar nome do prestador às fichas
      const fichasComPrestador: FichaComVisita[] = fichasData.map(ficha => ({
        ...ficha,
        prestador_nome: ficha.prestador_id ? prestadoresMap.get(ficha.prestador_id) : undefined,
      }));

      setFichasComVisita(fichasComPrestador);

      // Agrupar por prestador
      const prestadorMap = new Map<string, {
        nome: string;
        convertidos: number;
        perdidos: number;
        emAndamento: number;
      }>();

      fichasComPrestador.forEach(ficha => {
        const cpf = ficha.prestador_id || "sem_prestador";
        const nome = ficha.prestador_nome || "Sem prestador";
        
        if (!prestadorMap.has(cpf)) {
          prestadorMap.set(cpf, { nome, convertidos: 0, perdidos: 0, emAndamento: 0 });
        }
        
        const stats = prestadorMap.get(cpf)!;
        const status = ficha.status || "";
        
        if (STATUS_CONVERTIDO.includes(status)) {
          stats.convertidos++;
        } else if (STATUS_PERDIDO.includes(status)) {
          stats.perdidos++;
        } else {
          stats.emAndamento++;
        }
      });

      const conversoes: ConversaoPrestador[] = Array.from(prestadorMap.entries())
        .map(([cpf, stats]) => {
          const totalVisitas = stats.convertidos + stats.perdidos + stats.emAndamento;
          // Taxa de conversão considera apenas os finalizados (convertidos + perdidos)
          const totalFinalizados = stats.convertidos + stats.perdidos;
          const taxaConversao = totalFinalizados > 0 
            ? (stats.convertidos / totalFinalizados) * 100 
            : 0;
          
          return {
            cpf,
            nome: stats.nome,
            totalVisitas,
            convertidos: stats.convertidos,
            perdidos: stats.perdidos,
            emAndamento: stats.emAndamento,
            taxaConversao,
          };
        })
        .filter(p => p.cpf !== "sem_prestador")
        .sort((a, b) => b.taxaConversao - a.taxaConversao);

      setConversaoPorPrestador(conversoes);
    } catch (error) {
      console.error("Erro ao buscar visitas:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular métricas principais
  const metricas = useMemo(() => {
    if (fichasComVisita.length === 0) {
      return {
        totalVisitas: 0,
        convertidos: 0,
        perdidos: 0,
        emAndamento: 0,
        taxaConversaoGeral: 0,
      };
    }

    let convertidos = 0;
    let perdidos = 0;
    let emAndamento = 0;

    fichasComVisita.forEach(ficha => {
      const status = ficha.status || "";
      if (STATUS_CONVERTIDO.includes(status)) {
        convertidos++;
      } else if (STATUS_PERDIDO.includes(status)) {
        perdidos++;
      } else {
        emAndamento++;
      }
    });

    const totalFinalizados = convertidos + perdidos;
    const taxaConversaoGeral = totalFinalizados > 0 
      ? (convertidos / totalFinalizados) * 100 
      : 0;

    return {
      totalVisitas: fichasComVisita.length,
      convertidos,
      perdidos,
      emAndamento,
      taxaConversaoGeral,
    };
  }, [fichasComVisita]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Conversão de Visitas Técnicas</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (metricas.totalVisitas === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Conversão de Visitas Técnicas</h3>
        </div>
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma visita técnica encontrada no período selecionado
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Conversão de Visitas Técnicas</h3>
          <Badge variant="outline" className="text-[10px]">
            {metricas.totalVisitas} visitas
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetalhes(!showDetalhes)}
          className="text-xs"
        >
          {showDetalhes ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Ocultar detalhes
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Ver detalhes
            </>
          )}
        </Button>
      </div>

      {/* Cards Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {/* Total de Visitas */}
        <Card className="p-3 border-2 border-transparent">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">
                Total Visitas
              </p>
              <p className="text-xl sm:text-2xl font-bold text-pink-600 dark:text-pink-400 mt-0.5">
                {metricas.totalVisitas}
              </p>
            </div>
            <div className="p-1.5 bg-pink-500/10 rounded-lg flex-shrink-0">
              <Eye className="h-4 w-4 text-pink-600 dark:text-pink-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-muted-foreground">
            <span className="truncate">No período selecionado</span>
          </div>
        </Card>

        {/* Taxa de Conversão Geral */}
        <Card className="p-3 border-2 border-transparent">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">
                Taxa Conversão
              </p>
              <p className={cn(
                "text-xl sm:text-2xl font-bold mt-0.5",
                metricas.taxaConversaoGeral >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                metricas.taxaConversaoGeral >= 50 ? "text-amber-600 dark:text-amber-400" :
                "text-red-600 dark:text-red-400"
              )}>
                {metricas.taxaConversaoGeral.toFixed(1)}%
              </p>
            </div>
            <div className={cn(
              "p-1.5 rounded-lg flex-shrink-0",
              metricas.taxaConversaoGeral >= 70 ? "bg-emerald-500/10" :
              metricas.taxaConversaoGeral >= 50 ? "bg-amber-500/10" :
              "bg-red-500/10"
            )}>
              <TrendingUp className={cn(
                "h-4 w-4",
                metricas.taxaConversaoGeral >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                metricas.taxaConversaoGeral >= 50 ? "text-amber-600 dark:text-amber-400" :
                "text-red-600 dark:text-red-400"
              )} />
            </div>
          </div>
          <Progress 
            value={metricas.taxaConversaoGeral} 
            className="mt-2 h-1.5"
          />
        </Card>

        {/* Convertidos */}
        <Card className="p-3 border-2 border-transparent">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">
                Convertidos
              </p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {metricas.convertidos}
              </p>
            </div>
            <div className="p-1.5 bg-emerald-500/10 rounded-lg flex-shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-emerald-600/70 dark:text-emerald-400/70">
            <span className="truncate">Agendado/Finalizado</span>
          </div>
        </Card>

        {/* Perdidos */}
        <Card className="p-3 border-2 border-transparent">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">
                Perdidos
              </p>
              <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400 mt-0.5">
                {metricas.perdidos}
              </p>
            </div>
            <div className="p-1.5 bg-red-500/10 rounded-lg flex-shrink-0">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-red-600/70 dark:text-red-400/70">
            <span className="truncate">Não converteram</span>
          </div>
        </Card>

        {/* Em Andamento */}
        <Card className="p-3 border-2 border-transparent">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">
                Em Andamento
              </p>
              <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {metricas.emAndamento}
              </p>
            </div>
            <div className="p-1.5 bg-amber-500/10 rounded-lg flex-shrink-0">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-amber-600/70 dark:text-amber-400/70">
            <span className="truncate">Ainda em processo</span>
          </div>
        </Card>
      </div>

      {/* Conversão por Prestador */}
      {conversaoPorPrestador.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Taxa de Conversão por Prestador</h4>
          </div>
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {conversaoPorPrestador.map((prestador, index) => (
                <div
                  key={prestador.cpf}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
                >
                  <span className={cn(
                    "text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                    index === 0 ? "bg-emerald-500/20 text-emerald-600" :
                    index === conversaoPorPrestador.length - 1 && conversaoPorPrestador.length > 1 
                      ? "bg-red-500/20 text-red-600" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {index + 1}
                  </span>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate max-w-[150px]">
                        {prestador.nome}
                      </span>
                      <span className={cn(
                        "text-sm font-bold",
                        prestador.taxaConversao >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                        prestador.taxaConversao >= 50 ? "text-amber-600 dark:text-amber-400" :
                        "text-red-600 dark:text-red-400"
                      )}>
                        {prestador.taxaConversao.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={prestador.taxaConversao} 
                      className="h-1.5"
                    />
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span>{prestador.totalVisitas} visitas</span>
                      <span className="text-emerald-600">✓ {prestador.convertidos}</span>
                      <span className="text-red-600">✗ {prestador.perdidos}</span>
                      {prestador.emAndamento > 0 && (
                        <span className="text-amber-600">⏳ {prestador.emAndamento}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* Detalhes por Ficha */}
      {showDetalhes && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">Detalhes das Visitas Técnicas</h4>
          <ScrollArea className="max-h-80">
            <div className="space-y-2">
              {fichasComVisita.slice(0, 30).map((ficha) => {
                const status = ficha.status || "";
                const isConvertido = STATUS_CONVERTIDO.includes(status);
                const isPerdido = STATUS_PERDIDO.includes(status);
                
                return (
                  <div
                    key={ficha.id}
                    className="flex items-center justify-between p-2 rounded-md border bg-muted/20"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {ficha.nome_ficha || ficha.id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ficha.prestador_nome || "Sem prestador"} • {ficha.data_visita_tecnica}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px]",
                          isConvertido ? "border-emerald-500 text-emerald-600" :
                          isPerdido ? "border-red-500 text-red-600" :
                          "border-amber-500 text-amber-600"
                        )}
                      >
                        {status}
                      </Badge>
                      {isConvertido && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      {isPerdido && <XCircle className="h-4 w-4 text-red-500" />}
                      {!isConvertido && !isPerdido && <Clock className="h-4 w-4 text-amber-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          {fichasComVisita.length > 30 && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Mostrando 30 de {fichasComVisita.length} visitas
            </p>
          )}
        </Card>
      )}
    </div>
  );
};
