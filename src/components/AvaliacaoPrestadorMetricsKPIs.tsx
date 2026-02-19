import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Wrench, ThumbsUp, Minus, ThumbsDown, ChevronDown, ChevronUp, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AvaliacaoPrestadorMetricsKPIsProps {
  periodoFrom?: Date;
  periodoTo?: Date;
}

interface AvaliacaoResposta {
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

export const AvaliacaoPrestadorMetricsKPIs = ({ periodoFrom, periodoTo }: AvaliacaoPrestadorMetricsKPIsProps) => {
  const [avaliacaoData, setAvaliacaoData] = useState<AvaliacaoResposta[]>([]);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [periodoFrom, periodoTo]);

  useEffect(() => {
    const channel = supabase
      .channel('avaliacao-prestador-kpis-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'avaliacao_prestador' },
        () => { fetchData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [periodoFrom, periodoTo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("avaliacao_prestador")
        .select("*")
        .not("nota", "is", null);

      if (periodoFrom) query = query.gte("enviado_em", periodoFrom.toISOString());
      if (periodoTo) query = query.lte("enviado_em", periodoTo.toISOString());

      const { data: result, error } = await query;
      if (error) throw error;

      const { data: prestadoresData } = await supabase
        .from("prestadores")
        .select("cpf, nome");

      setAvaliacaoData((result || []) as AvaliacaoResposta[]);
      setPrestadores(prestadoresData || []);
    } catch (error) {
      console.error("Erro ao buscar dados de avaliação de prestadores:", error);
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => {
    if (avaliacaoData.length === 0) {
      return { mediaGeral: 0, indiceSatisfacao: 0, totalRespostas: 0, positivos: 0, neutros: 0, criticos: 0, percentualPositivas: 0, percentualCriticas: 0 };
    }

    const total = avaliacaoData.length;
    const soma = avaliacaoData.reduce((acc, n) => acc + (n.nota || 0), 0);
    const media = soma / total;
    const positivos = avaliacaoData.filter((n) => (n.nota || 0) >= 4).length;
    const neutros = avaliacaoData.filter((n) => (n.nota || 0) === 3).length;
    const criticos = avaliacaoData.filter((n) => (n.nota || 0) <= 2).length;

    return {
      mediaGeral: media,
      indiceSatisfacao: Math.round((media / 5) * 100),
      totalRespostas: total,
      positivos,
      neutros,
      criticos,
      percentualPositivas: Math.round((positivos / total) * 100),
      percentualCriticas: Math.round((criticos / total) * 100),
    };
  }, [avaliacaoData]);

  const prestadorMetrics = useMemo((): PrestadorSatisfacao[] => {
    const prestadorMap = new Map(prestadores.map((p) => [p.cpf, p.nome]));
    const grouped: Record<string, { notas: number[]; classificacoes: string[] }> = {};

    avaliacaoData.forEach((av) => {
      if (av.prestador_id && av.nota !== null) {
        if (!grouped[av.prestador_id]) grouped[av.prestador_id] = { notas: [], classificacoes: [] };
        grouped[av.prestador_id].notas.push(av.nota);
        if (av.classificacao) grouped[av.prestador_id].classificacoes.push(av.classificacao);
      }
    });

    return Object.entries(grouped)
      .map(([cpf, data]) => ({
        cpf,
        nome: prestadorMap.get(cpf) || cpf,
        media: data.notas.reduce((a, b) => a + b, 0) / data.notas.length,
        total: data.notas.length,
        positivos: data.classificacoes.filter((c) => c === "positivo").length,
        neutros: data.classificacoes.filter((c) => c === "neutro").length,
        criticos: data.classificacoes.filter((c) => c === "critico").length,
      }))
      .sort((a, b) => b.media - a.media);
  }, [avaliacaoData, prestadores]);

  const criticosRecentes = useMemo(() => {
    return avaliacaoData
      .filter((n) => (n.nota || 0) <= 2)
      .sort((a, b) => new Date(b.enviado_em).getTime() - new Date(a.enviado_em).getTime())
      .slice(0, 5);
  }, [avaliacaoData]);

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
        <CardHeader><Skeleton className="h-6 w-64" /></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (avaliacaoData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-500" />
            Métricas de Avaliação de Prestadores (1-5)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhuma avaliação de prestador registrada no período selecionado
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wrench className="h-5 w-5 text-orange-500" />
          Métricas de Avaliação de Prestadores (1-5)
          <Badge variant="secondary" className="ml-2">{metrics.totalRespostas} avaliações</Badge>
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
              <Badge variant="secondary" className="mt-1">{getIndiceLabel(metrics.indiceSatisfacao)}</Badge>
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
                <span className="flex items-center gap-1 text-emerald-600"><ThumbsUp className="h-3 w-3" />{metrics.positivos}</span>
                <span className="flex items-center gap-1 text-yellow-600"><Minus className="h-3 w-3" />{metrics.neutros}</span>
                <span className="flex items-center gap-1 text-red-600"><ThumbsDown className="h-3 w-3" />{metrics.criticos}</span>
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
                Ranking por avaliação média
              </div>
              <ScrollArea className="h-64">
                <div className="space-y-2 pr-3">
                  {prestadorMetrics.map((p, index) => (
                    <div key={p.cpf} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                          index === 0 && "bg-yellow-500 text-white",
                          index === 1 && "bg-gray-400 text-white",
                          index === 2 && "bg-amber-700 text-white",
                          index > 2 && "bg-muted text-muted-foreground"
                        )}>
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
                  <div key={d.id} className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
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
