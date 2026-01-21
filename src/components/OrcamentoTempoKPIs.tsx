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
  Clock, 
  Timer, 
  Users, 
  Layers,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
  Minus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface OrcamentoComTempo {
  id: string;
  ficha_nome: string;
  prestador_cpf: string;
  prestador_nome?: string;
  categoria: string | null;
  data_criacao: string;
  tempo_resposta_minutos: number;
}

interface FichaComTempos {
  ficha_id: string;
  ficha_nome?: string;
  created_at: string;
  orcamentos: {
    id: string;
    prestador_nome?: string;
    categoria: string | null;
    tempo_resposta_minutos: number;
    data_criacao: string;
  }[];
  tempo_primeiro_orcamento?: number;
}

interface TemposPorPrestador {
  cpf: string;
  nome: string;
  tempos: number[];
  media: number;
}

interface TemposPorCategoria {
  categoria: string;
  tempos: number[];
  media: number;
}

interface OrcamentoTempoKPIsProps {
  periodoFrom?: Date;
  periodoTo?: Date;
}

const formatarTempo = (minutos: number): string => {
  if (minutos < 60) {
    return `${Math.round(minutos)} min`;
  } else if (minutos < 1440) {
    const horas = Math.floor(minutos / 60);
    const mins = Math.round(minutos % 60);
    return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
  } else {
    const dias = Math.floor(minutos / 1440);
    const horas = Math.floor((minutos % 1440) / 60);
    return horas > 0 ? `${dias}d ${horas}h` : `${dias}d`;
  }
};

export const OrcamentoTempoKPIs = ({ periodoFrom, periodoTo }: OrcamentoTempoKPIsProps) => {
  const [loading, setLoading] = useState(true);
  const [fichasComTempos, setFichasComTempos] = useState<FichaComTempos[]>([]);
  const [temposPorPrestador, setTemposPorPrestador] = useState<TemposPorPrestador[]>([]);
  const [temposPorCategoria, setTemposPorCategoria] = useState<TemposPorCategoria[]>([]);
  const [showDetalhes, setShowDetalhes] = useState(false);

  useEffect(() => {
    fetchTemposOrcamentos();
  }, [periodoFrom, periodoTo]);

  const fetchTemposOrcamentos = async () => {
    setLoading(true);
    try {
      // Buscar fichas de serviço
      let fichasQuery = supabase
        .from("fichas_de_servico")
        .select("id, nome_ficha, created_at")
        .order("created_at", { ascending: false });

      if (periodoFrom) {
        fichasQuery = fichasQuery.gte("created_at", periodoFrom.toISOString());
      }
      if (periodoTo) {
        fichasQuery = fichasQuery.lte("created_at", periodoTo.toISOString());
      }

      const { data: fichasData } = await fichasQuery;

      if (!fichasData || fichasData.length === 0) {
        setFichasComTempos([]);
        setTemposPorPrestador([]);
        setTemposPorCategoria([]);
        setLoading(false);
        return;
      }

      const fichaIds = fichasData.map(f => f.id);

      // Buscar orçamentos dessas fichas
      const { data: orcamentosData } = await supabase
        .from("orcamentos")
        .select("id, ficha_nome, prestador_cpf, categoria, data_criacao")
        .in("ficha_nome", fichaIds)
        .order("data_criacao", { ascending: true });

      // Buscar prestadores
      const cpfs = [...new Set(orcamentosData?.map(o => o.prestador_cpf) || [])];
      const { data: prestadoresData } = await supabase
        .from("prestadores")
        .select("cpf, nome")
        .in("cpf", cpfs);

      const prestadoresMap = new Map(prestadoresData?.map(p => [p.cpf, p.nome]) || []);

      // Criar mapa de fichas -> created_at
      const fichasMap = new Map(fichasData.map(f => [f.id, { created_at: f.created_at, nome_ficha: f.nome_ficha }]));

      // Calcular tempos de resposta para cada orçamento
      const orcamentosComTempo: OrcamentoComTempo[] = (orcamentosData || []).map(orc => {
        const fichaInfo = fichasMap.get(orc.ficha_nome);
        const fichaCreatedAt = fichaInfo ? new Date(fichaInfo.created_at) : new Date();
        const orcCreatedAt = new Date(orc.data_criacao);
        const tempoMinutos = (orcCreatedAt.getTime() - fichaCreatedAt.getTime()) / (1000 * 60);

        return {
          ...orc,
          prestador_nome: prestadoresMap.get(orc.prestador_cpf),
          tempo_resposta_minutos: Math.max(0, tempoMinutos),
        };
      });

      // Agrupar por ficha
      const fichasAgrupadas: FichaComTempos[] = fichasData.map(ficha => {
        const orcamentosFicha = orcamentosComTempo
          .filter(o => o.ficha_nome === ficha.id)
          .sort((a, b) => a.tempo_resposta_minutos - b.tempo_resposta_minutos);

        return {
          ficha_id: ficha.id,
          ficha_nome: ficha.nome_ficha || ficha.id,
          created_at: ficha.created_at,
          orcamentos: orcamentosFicha.map(o => ({
            id: o.id,
            prestador_nome: o.prestador_nome,
            categoria: o.categoria,
            tempo_resposta_minutos: o.tempo_resposta_minutos,
            data_criacao: o.data_criacao,
          })),
          tempo_primeiro_orcamento: orcamentosFicha.length > 0 
            ? orcamentosFicha[0].tempo_resposta_minutos 
            : undefined,
        };
      }).filter(f => f.orcamentos.length > 0);

      // Agrupar por prestador
      const prestadorMap = new Map<string, { nome: string; tempos: number[] }>();
      orcamentosComTempo.forEach(orc => {
        const nome = orc.prestador_nome || orc.prestador_cpf;
        if (!prestadorMap.has(orc.prestador_cpf)) {
          prestadorMap.set(orc.prestador_cpf, { nome, tempos: [] });
        }
        prestadorMap.get(orc.prestador_cpf)!.tempos.push(orc.tempo_resposta_minutos);
      });

      const temposPrestadores: TemposPorPrestador[] = Array.from(prestadorMap.entries())
        .map(([cpf, data]) => ({
          cpf,
          nome: data.nome,
          tempos: data.tempos,
          media: data.tempos.reduce((a, b) => a + b, 0) / data.tempos.length,
        }))
        .sort((a, b) => a.media - b.media);

      // Agrupar por categoria
      const categoriaMap = new Map<string, number[]>();
      orcamentosComTempo.forEach(orc => {
        const categoria = orc.categoria || "Sem categoria";
        if (!categoriaMap.has(categoria)) {
          categoriaMap.set(categoria, []);
        }
        categoriaMap.get(categoria)!.push(orc.tempo_resposta_minutos);
      });

      const temposCategorias: TemposPorCategoria[] = Array.from(categoriaMap.entries())
        .map(([categoria, tempos]) => ({
          categoria,
          tempos,
          media: tempos.reduce((a, b) => a + b, 0) / tempos.length,
        }))
        .sort((a, b) => a.media - b.media);

      setFichasComTempos(fichasAgrupadas);
      setTemposPorPrestador(temposPrestadores);
      setTemposPorCategoria(temposCategorias);
    } catch (error) {
      console.error("Erro ao buscar tempos de orçamentos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular métricas principais
  const metricas = useMemo(() => {
    if (fichasComTempos.length === 0) {
      return {
        mediaPrimeiroOrcamento: 0,
        mediaGeralTodosOrcamentos: 0,
        totalOrcamentos: 0,
        totalFichasComOrcamento: 0,
      };
    }

    // Média do primeiro orçamento
    const primeirosTempo = fichasComTempos
      .filter(f => f.tempo_primeiro_orcamento !== undefined)
      .map(f => f.tempo_primeiro_orcamento!);
    
    const mediaPrimeiroOrcamento = primeirosTempo.length > 0
      ? primeirosTempo.reduce((a, b) => a + b, 0) / primeirosTempo.length
      : 0;

    // Média geral de todos os orçamentos
    const todosTempos = fichasComTempos.flatMap(f => f.orcamentos.map(o => o.tempo_resposta_minutos));
    const mediaGeralTodosOrcamentos = todosTempos.length > 0
      ? todosTempos.reduce((a, b) => a + b, 0) / todosTempos.length
      : 0;

    return {
      mediaPrimeiroOrcamento,
      mediaGeralTodosOrcamentos,
      totalOrcamentos: todosTempos.length,
      totalFichasComOrcamento: fichasComTempos.length,
    };
  }, [fichasComTempos]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Tempo de Resposta dos Orçamentos</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (metricas.totalOrcamentos === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Tempo de Resposta dos Orçamentos</h3>
        </div>
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum orçamento encontrado no período selecionado
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
          <Timer className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Tempo de Resposta dos Orçamentos</h3>
          <Badge variant="outline" className="text-[10px]">
            {metricas.totalOrcamentos} orçamentos
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Média Primeiro Orçamento */}
        <Card className="p-3 border-2 border-transparent">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">
                Média 1º Orçamento
              </p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                {formatarTempo(metricas.mediaPrimeiroOrcamento)}
              </p>
            </div>
            <div className="p-1.5 bg-blue-500/10 rounded-lg flex-shrink-0">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-muted-foreground">
            <span className="truncate">{metricas.totalFichasComOrcamento} fichas com orçamento</span>
          </div>
        </Card>

        {/* Média Geral */}
        <Card className="p-3 border-2 border-transparent">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground truncate">
                Média Geral
              </p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                {formatarTempo(metricas.mediaGeralTodosOrcamentos)}
              </p>
            </div>
            <div className="p-1.5 bg-purple-500/10 rounded-lg flex-shrink-0">
              <Timer className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-muted-foreground">
            <span className="truncate">Todos os {metricas.totalOrcamentos} orçamentos</span>
          </div>
        </Card>

        {/* Prestador mais rápido */}
        {temposPorPrestador.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Card className="p-3 border-2 border-transparent cursor-pointer hover:border-emerald-500/30 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      Prestador + Rápido
                    </p>
                    <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                      {formatarTempo(temposPorPrestador[0].media)}
                    </p>
                  </div>
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg flex-shrink-0">
                    <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                  <span className="truncate">{temposPorPrestador[0].nome}</span>
                </div>
              </Card>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <div className="p-3 border-b">
                <h4 className="text-sm font-semibold">Tempo Médio por Prestador</h4>
                <p className="text-xs text-muted-foreground">Ordenado do mais rápido ao mais lento</p>
              </div>
              <ScrollArea className="max-h-64">
                <div className="p-2 space-y-1">
                  {temposPorPrestador.map((prestador, index) => (
                    <div
                      key={prestador.cpf}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center",
                          index === 0 ? "bg-emerald-500/20 text-emerald-600" :
                          index === temposPorPrestador.length - 1 ? "bg-red-500/20 text-red-600" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium truncate max-w-[140px]">
                          {prestador.nome}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatarTempo(prestador.media)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {prestador.tempos.length} orçamentos
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}

        {/* Categoria mais rápida */}
        {temposPorCategoria.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Card className="p-3 border-2 border-transparent cursor-pointer hover:border-orange-500/30 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      Categoria + Rápida
                    </p>
                    <p className="text-lg sm:text-xl font-bold text-orange-600 dark:text-orange-400 mt-0.5 truncate">
                      {formatarTempo(temposPorCategoria[0].media)}
                    </p>
                  </div>
                  <div className="p-1.5 bg-orange-500/10 rounded-lg flex-shrink-0">
                    <Layers className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                  <span className="truncate">{temposPorCategoria[0].categoria}</span>
                </div>
              </Card>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-3 border-b">
                <h4 className="text-sm font-semibold">Tempo Médio por Categoria</h4>
                <p className="text-xs text-muted-foreground">Ordenado do mais rápido ao mais lento</p>
              </div>
              <ScrollArea className="max-h-64">
                <div className="p-2 space-y-1">
                  {temposPorCategoria.map((cat, index) => (
                    <div
                      key={cat.categoria}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center",
                          index === 0 ? "bg-orange-500/20 text-orange-600" :
                          index === temposPorCategoria.length - 1 ? "bg-red-500/20 text-red-600" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium truncate max-w-[140px]">
                          {cat.categoria}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatarTempo(cat.media)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {cat.tempos.length} orçamentos
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Detalhes por Ficha */}
      {showDetalhes && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">Tempo de Orçamentos por Ficha</h4>
          <ScrollArea className="max-h-80">
            <div className="space-y-3">
              {fichasComTempos.slice(0, 20).map((ficha) => (
                <div key={ficha.ficha_id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium truncate max-w-[200px]">
                      {ficha.ficha_nome}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {ficha.orcamentos.length} orçamento(s)
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {ficha.orcamentos.map((orc, idx) => (
                      <div
                        key={orc.id}
                        className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-bold",
                            idx === 0 ? "text-emerald-600" : "text-muted-foreground"
                          )}>
                            #{idx + 1}
                          </span>
                          <span className="truncate max-w-[100px]">
                            {orc.prestador_nome || "Prestador"}
                          </span>
                          {orc.categoria && (
                            <Badge variant="secondary" className="text-[9px] px-1">
                              {orc.categoria}
                            </Badge>
                          )}
                        </div>
                        <span className={cn(
                          "font-semibold",
                          idx === 0 ? "text-emerald-600" : "text-foreground"
                        )}>
                          {formatarTempo(orc.tempo_resposta_minutos)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          {fichasComTempos.length > 20 && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Mostrando 20 de {fichasComTempos.length} fichas
            </p>
          )}
        </Card>
      )}
    </div>
  );
};
