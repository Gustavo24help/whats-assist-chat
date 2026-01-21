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

interface PrestadorNPS {
  cpf: string;
  nome: string;
  media: number;
  total: number;
  promotores: number;
  neutros: number;
  detratores: number;
}

export const NPSMetricsKPIs = ({ periodoFrom, periodoTo }: NPSMetricsKPIsProps) => {
  const [npsData, setNpsData] = useState<NPSResposta[]>([]);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [periodoFrom, periodoTo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar respostas NPS com nota registrada
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

      // Buscar prestadores
      const { data: prestadoresData } = await supabase
        .from("prestadores")
        .select("cpf, nome");

      setNpsData((npsDataResult || []) as NPSResposta[]);
      setPrestadores(prestadoresData || []);
    } catch (error) {
      console.error("Erro ao buscar dados NPS:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular métricas
  const metrics = useMemo(() => {
    if (npsData.length === 0) {
      return {
        mediaGeral: 0,
        totalRespostas: 0,
        promotores: 0,
        neutros: 0,
        detratores: 0,
        npsScore: 0,
        taxaResposta: 0,
      };
    }

    const totalRespostas = npsData.length;
    const somaNotas = npsData.reduce((acc, n) => acc + (n.nota || 0), 0);
    const mediaGeral = somaNotas / totalRespostas;

    const promotores = npsData.filter((n) => (n.nota || 0) >= 9).length;
    const neutros = npsData.filter((n) => (n.nota || 0) >= 7 && (n.nota || 0) <= 8).length;
    const detratores = npsData.filter((n) => (n.nota || 0) <= 6).length;

    // NPS Score = % Promotores - % Detratores
    const npsScore = Math.round(
      ((promotores / totalRespostas) * 100) - ((detratores / totalRespostas) * 100)
    );

    return {
      mediaGeral,
      totalRespostas,
      promotores,
      neutros,
      detratores,
      npsScore,
    };
  }, [npsData]);

  // Métricas por prestador
  const prestadorMetrics = useMemo((): PrestadorNPS[] => {
    const prestadorMap = new Map(prestadores.map((p) => [p.cpf, p.nome]));
    const grouped: Record<string, { notas: number[]; classificacoes: string[] }> = {};

    npsData.forEach((nps) => {
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
        const promotores = data.classificacoes.filter((c) => c === "promotor").length;
        const neutros = data.classificacoes.filter((c) => c === "neutro").length;
        const detratores = data.classificacoes.filter((c) => c === "detrator").length;

        return {
          cpf,
          nome: prestadorMap.get(cpf) || cpf,
          media,
          total: data.notas.length,
          promotores,
          neutros,
          detratores,
        };
      })
      .sort((a, b) => b.media - a.media);
  }, [npsData, prestadores]);

  // Clientes detratores recentes
  const detratoresRecentes = useMemo(() => {
    return npsData
      .filter((n) => n.classificacao === "detrator")
      .sort((a, b) => new Date(b.enviado_em).getTime() - new Date(a.enviado_em).getTime())
      .slice(0, 5);
  }, [npsData]);

  const getNPSScoreColor = (score: number) => {
    if (score >= 50) return "text-emerald-600";
    if (score >= 0) return "text-yellow-600";
    return "text-red-600";
  };

  const getNPSScoreLabel = (score: number) => {
    if (score >= 75) return "Excelente";
    if (score >= 50) return "Muito Bom";
    if (score >= 0) return "Razoável";
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

  if (npsData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Métricas NPS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhuma resposta NPS registrada no período selecionado
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
          Métricas NPS
          <Badge variant="secondary" className="ml-2">
            {metrics.totalRespostas} respostas
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPIs principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* NPS Score */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">NPS Score</div>
              <div className={cn("text-3xl font-bold", getNPSScoreColor(metrics.npsScore))}>
                {metrics.npsScore > 0 ? "+" : ""}
                {metrics.npsScore}
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  "mt-1",
                  metrics.npsScore >= 50 && "bg-emerald-100 text-emerald-700",
                  metrics.npsScore >= 0 && metrics.npsScore < 50 && "bg-yellow-100 text-yellow-700",
                  metrics.npsScore < 0 && "bg-red-100 text-red-700"
                )}
              >
                {getNPSScoreLabel(metrics.npsScore)}
              </Badge>
            </CardContent>
          </Card>

          {/* Média Geral */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">Média Geral</div>
              <div className="text-3xl font-bold">{metrics.mediaGeral.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground mt-1">de 0 a 10</div>
            </CardContent>
          </Card>

          {/* Distribuição */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-2">Distribuição</div>
              <div className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1 text-emerald-600">
                  <ThumbsUp className="h-3 w-3" />
                  {metrics.promotores}
                </span>
                <span className="flex items-center gap-1 text-yellow-600">
                  <Minus className="h-3 w-3" />
                  {metrics.neutros}
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <ThumbsDown className="h-3 w-3" />
                  {metrics.detratores}
                </span>
              </div>
              {/* Barra de distribuição */}
              <div className="flex h-2 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-emerald-500"
                  style={{ width: `${(metrics.promotores / metrics.totalRespostas) * 100}%` }}
                />
                <div
                  className="bg-yellow-500"
                  style={{ width: `${(metrics.neutros / metrics.totalRespostas) * 100}%` }}
                />
                <div
                  className="bg-red-500"
                  style={{ width: `${(metrics.detratores / metrics.totalRespostas) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Ranking por Prestador */}
          <Popover>
            <PopoverTrigger asChild>
              <Card className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground mb-1">Por Prestador</div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="text-lg font-semibold">
                      {prestadorMetrics.length} prestadores
                    </span>
                  </div>
                  <div className="text-xs text-primary mt-1">Clique para ver ranking</div>
                </CardContent>
              </Card>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Ranking por NPS Médio
              </div>
              <ScrollArea className="h-64">
                <div className="space-y-2 pr-3">
                  {prestadorMetrics.map((p, index) => (
                    <div
                      key={p.cpf}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
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
                          <div className="text-sm font-medium truncate max-w-[120px]">
                            {p.nome}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.total} {p.total === 1 ? "avaliação" : "avaliações"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={cn(
                            "font-bold",
                            p.media >= 9 && "text-emerald-600",
                            p.media >= 7 && p.media < 9 && "text-yellow-600",
                            p.media < 7 && "text-red-600"
                          )}
                        >
                          {p.media.toFixed(1)}
                        </div>
                        <div className="flex gap-1 text-xs">
                          <span className="text-emerald-600">{p.promotores}P</span>
                          <span className="text-yellow-600">{p.neutros}N</span>
                          <span className="text-red-600">{p.detratores}D</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {prestadorMetrics.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-4">
                      Nenhum prestador com avaliações
                    </p>
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        {/* Detratores recentes */}
        {detratoresRecentes.length > 0 && (
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  {detratoresRecentes.length} detratores recentes
                </span>
                {detailsOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 mt-2">
                {detratoresRecentes.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{d.telefone_cliente}</span>
                      <Badge variant="destructive">Nota {d.nota}</Badge>
                    </div>
                    {d.feedback && (
                      <p className="text-sm text-muted-foreground italic">
                        "{d.feedback}"
                      </p>
                    )}
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
