import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, ThumbsUp, Minus, ThumbsDown, ChevronDown, ChevronUp, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface NPSMetricsKPIsProps {
  periodoFrom?: Date;
  periodoTo?: Date;
}

interface NPSResposta {
  id: string;
  ficha_id: string;
  telefone_cliente: string;
  prestador_id: string | null;
  nota: number | null;
  classificacao: string | null;
  feedback: string | null;
  enviado_em: string;
  respondido_em: string | null;
  prioridade: boolean;
}

interface Prestador {
  cpf: string;
  nome: string;
}

interface PrestadorSatisfacao {
  cpf: string;
  nome: string;
  media: number;
  total: number;
  positivos: number;
  neutros: number;
  criticos: number;
}

export const NPSMetricsKPIs = ({ periodoFrom, periodoTo }: NPSMetricsKPIsProps) => {
  const [npsData, setNpsData] = useState<NPSResposta[]>([]);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [periodoFrom, periodoTo]);

  useEffect(() => {
    const channel = supabase
      .channel('nps-kpis-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nps_respostas'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [periodoFrom, periodoTo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let npsQuery = supabase
        .from("nps_respostas")
        .select("*")
        .not("nota", "is", null);

      if (periodoFrom) {
        npsQuery = npsQuery.gte("enviado_em", periodoFrom.toISOString());
      }
      if (periodoTo) {
        npsQuery = npsQuery.lte("enviado_em", periodoTo.toISOString());
      }

      const { data: npsDataResult, error: npsError } = await npsQuery;
      if (npsError) throw npsError;

      const { data: prestadoresData } = await supabase
        .from("prestadores")
        .select("cpf, nome");

      setNpsData((npsDataResult || []) as NPSResposta[]);
      setPrestadores(prestadoresData || []);
    } catch (error) {
      console.error("Erro ao buscar dados de satisfação:", error);
    } finally {
      setLoading(false);
    }
  };

  const dataEscala15 = useMemo(
    () => npsData.filter((n) => n.nota !== null && n.nota >= 1 && n.nota <= 5),
    [npsData]
  );

  const respostasLegado = useMemo(
    () => npsData.filter((n) => n.nota !== null && n.nota > 5),
    [npsData]
  );

  const metrics = useMemo(() => {
    if (dataEscala15.length === 0) {
      return {
        mediaGeral: 0,
        indiceSatisfacao: 0,
        totalRespostas: 0,
        positivos: 0,
        neutros: 0,
        criticos: 0,
        percentualPositivas: 0,
        percentualCriticas: 0,
      };
    }

    const totalRespostas = dataEscala15.length;
    const somaNotas = dataEscala15.reduce((acc, n) => acc + (n.nota || 0), 0);
    const mediaGeral = somaNotas / totalRespostas;

    const positivos = dataEscala15.filter((n) => (n.nota || 0) >= 4).length;
    const neutros = dataEscala15.filter((n) => (n.nota || 0) === 3).length;
    const criticos = dataEscala15.filter((n) => (n.nota || 0) <= 2).length;

    const indiceSatisfacao = Math.round((mediaGeral / 5) * 100);
    const percentualPositivas = Math.round((positivos / totalRespostas) * 100);
    const percentualCriticas = Math.round((criticos / totalRespostas) * 100);

    return {
      mediaGeral,
      indiceSatisfacao,
      totalRespostas,
      positivos,
      neutros,
      criticos,
      percentualPositivas,
      percentualCriticas,
    };
  }, [dataEscala15]);

  const prestadorMetrics = useMemo((): PrestadorSatisfacao[] => {
    const prestadorMap = new Map(prestadores.map((p) => [p.cpf, p.nome]));
    const grouped: Record<string, { notas: number[]; classificacoes: string[] }> = {};

    dataEscala15.forEach((nps) => {
      if (nps.prestador_id && nps.nota !== null) {
        if (!grouped[nps.prestador_id]) {
          grouped[nps.prestador_id] = { notas: [], classificacoes: [] };
        }
        grouped[nps.prestador_id].notas.push(nps.nota);
        if (nps.classificacao) {
          grouped[nps.prestador_id].classificacoes.push(nps.classificacao);
        }
      }
    });

    return Object.entries(grouped)
      .map(([cpf, data]) => {
        const media = data.notas.reduce((a, b) => a + b, 0) / data.notas.length;
        const positivos = data.classificacoes.filter((c) => ["positivo", "promotor"].includes(c)).length;
        const neutros = data.classificacoes.filter((c) => c === "neutro").length;
        const criticos = data.classificacoes.filter((c) => ["critico", "detrator"].includes(c)).length;

        return {
          cpf,
          nome: prestadorMap.get(cpf) || cpf,
          media,
          total: data.notas.length,
          positivos,
          neutros,
          criticos,
        };
      })
      .sort((a, b) => b.media - a.media);
  }, [dataEscala15, prestadores]);

  const criticosRecentes = useMemo(() => {
    return dataEscala15
      .filter((n) => (n.nota || 0) <= 2 || ["critico", "detrator"].includes(n.classificacao || ""))
      .sort((a, b) => new Date(b.enviado_em).getTime() - new Date(a.enviado_em).getTime())
      .slice(0, 5);
  }, [dataEscala15]);

  const getIndiceColor = (indice: number) => {
    if (indice >= 80) return "text-emerald-600";
    if (indice >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getIndiceLabel = (indice: number) => {
    if (indice >= 80) return "Excelente";
    if (indice >= 60) return "Bom";
    return "Crítico";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (dataEscala15.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Métricas de Satisfação (1-5)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhuma resposta na escala 1-5 registrada no período selecionado
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          Métricas de Satisfação (1-5)
          <Badge variant="secondary" className="ml-2">
            {metrics.totalRespostas} respostas
          </Badge>
          {respostasLegado.length > 0 && (
            <Badge variant="outline">{respostasLegado.length} respostas legado 0-10</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">Índice de Satisfação</div>
              <div className={cn("text-3xl font-bold", getIndiceColor(metrics.indiceSatisfacao))}>
                {metrics.indiceSatisfacao}%
              </div>
              <Badge variant="secondary" className="mt-1">
                {getIndiceLabel(metrics.indiceSatisfacao)}
              </Badge>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">Média Geral</div>
              <div className="text-3xl font-bold">{metrics.mediaGeral.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground mt-1">de 1 a 5</div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">% Positivas</div>
              <div className="text-3xl font-bold text-emerald-600">{metrics.percentualPositivas}%</div>
              <div className="text-xs text-muted-foreground mt-1">Notas 4-5</div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">% Críticas</div>
              <div className="text-3xl font-bold text-red-600">{metrics.percentualCriticas}%</div>
              <div className="text-xs text-muted-foreground mt-1">Notas 1-2</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-2">Distribuição</div>
              <div className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1 text-emerald-600">
                  <ThumbsUp className="h-3 w-3" />
                  {metrics.positivos}
                </span>
                <span className="flex items-center gap-1 text-yellow-600">
                  <Minus className="h-3 w-3" />
                  {metrics.neutros}
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <ThumbsDown className="h-3 w-3" />
                  {metrics.criticos}
                </span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden mt-2">
                <div className="bg-emerald-500" style={{ width: `${(metrics.positivos / metrics.totalRespostas) * 100}%` }} />
                <div className="bg-yellow-500" style={{ width: `${(metrics.neutros / metrics.totalRespostas) * 100}%` }} />
                <div className="bg-red-500" style={{ width: `${(metrics.criticos / metrics.totalRespostas) * 100}%` }} />
              </div>
            </CardContent>
          </Card>

          <Popover>
            <PopoverTrigger asChild>
              <Card className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground mb-1">Por Prestador</div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="text-lg font-semibold">{prestadorMetrics.length} prestadores</span>
                  </div>
                  <div className="text-xs text-primary mt-1">Clique para ver ranking</div>
                </CardContent>
              </Card>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Ranking por satisfação média
              </div>
              <ScrollArea className="h-64">
                <div className="space-y-2 pr-3">
                  {prestadorMetrics.map((p, index) => (
                    <div key={p.cpf} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                            index === 0 && "bg-yellow-500 text-white",
                            index === 1 && "bg-gray-400 text-white",
                            index === 2 && "bg-amber-700 text-white",
                            index > 2 && "bg-muted text-muted-foreground"
                          )}
                        >
                          {index + 1}
                        </span>
                        <div>
                          <div className="text-sm font-medium truncate max-w-[120px]">{p.nome}</div>
                          <div className="text-xs text-muted-foreground">{p.total} {p.total === 1 ? "avaliação" : "avaliações"}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn("font-bold", p.media >= 4 && "text-emerald-600", p.media === 3 && "text-yellow-600", p.media < 3 && "text-red-600")}>
                          {p.media.toFixed(1)}
                        </div>
                        <div className="flex gap-1 text-xs">
                          <span className="text-emerald-600">{p.positivos}P</span>
                          <span className="text-yellow-600">{p.neutros}N</span>
                          <span className="text-red-600">{p.criticos}C</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        {criticosRecentes.length > 0 && (
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  {criticosRecentes.length} avaliações críticas recentes
                </span>
                {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 mt-2">
                {criticosRecentes.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{d.telefone_cliente}</span>
                      <Badge variant="destructive">Nota {d.nota}</Badge>
                    </div>
                    {d.feedback && <p className="text-sm text-muted-foreground italic">"{d.feedback}"</p>}
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(d.enviado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};
