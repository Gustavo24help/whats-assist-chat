import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronUp, Calendar, User, DollarSign, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type FichaDeServico = Database["public"]["Tables"]["fichas_de_servico"]["Row"];

interface FichaWithData extends FichaDeServico {
  cliente_nome?: string;
  prestador_nome?: string;
  orcamentos_count?: number;
}

interface Orcamento {
  id: string;
  prestador_cpf: string;
  valor_total: number | null;
  valor_mao_obra: number | null;
  valor_pecas: number | null;
  tempo_servico: string | null;
  observacoes: string | null;
  status: string;
  data_criacao: string;
  prestador_nome?: string;
}

interface FichaCardProps {
  ficha: FichaWithData;
}

const getStatusColor = (status: string | null) => {
  const statusMap: Record<string, string> = {
    "Ficha Criada": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    "Contato Inicial": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    "Dúvida Prestador": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    "Orçamento Enviado": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    "Negociação": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    "Visita Técnica": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    "Orçamento Aprovado / Agendamento": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    "Orçamento Não Aprovado": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    "Agendado": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    "Em andamento": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    "Finalizado": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "Garantia": "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200",
    "Perdido": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    "Não foi adiante": "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
  };

  return statusMap[status || ""] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
};

export const FichaCard = ({ ficha }: FichaCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loadingOrcamentos, setLoadingOrcamentos] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isDescriptionTruncated, setIsDescriptionTruncated] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (descriptionRef.current && ficha.descricao) {
      const element = descriptionRef.current;
      setIsDescriptionTruncated(element.scrollHeight > element.clientHeight);
    }
  }, [ficha.descricao]);

  const fetchOrcamentos = async () => {
    if (orcamentos.length > 0) return; // Já carregou

    setLoadingOrcamentos(true);
    try {
      const { data: orcamentosData } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("ficha_nome", ficha.id)
        .order("data_criacao", { ascending: false });

      if (!orcamentosData) {
        setLoadingOrcamentos(false);
        return;
      }

      // Buscar prestadores
      const cpfs = [...new Set(orcamentosData.map((o) => o.prestador_cpf))];
      const { data: prestadoresData } = await supabase
        .from("prestadores")
        .select("cpf, nome")
        .in("cpf", cpfs);

      const prestadoresMap = new Map(prestadoresData?.map((p) => [p.cpf, p.nome]));

      const orcamentosComNome = orcamentosData.map((orc) => ({
        ...orc,
        prestador_nome: prestadoresMap.get(orc.prestador_cpf) || orc.prestador_cpf,
      }));

      setOrcamentos(orcamentosComNome);
    } catch (error) {
      console.error("Erro ao buscar orçamentos:", error);
    } finally {
      setLoadingOrcamentos(false);
    }
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-all duration-200 border-border hover:border-primary/50">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-bold text-foreground line-clamp-1">
            {ficha.nome_ficha || "Sem nome"}
          </CardTitle>
          <Badge className={getStatusColor(ficha.status)}>{ficha.status || "Sem status"}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Cliente: {ficha.cliente_nome}</p>
      </CardHeader>

      <CardContent className="space-y-2 pb-3 px-3">
        {/* Data de criação */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {ficha.created_at
              ? format(new Date(ficha.created_at), "dd/MM/yyyy", { locale: ptBR })
              : "Sem data"}
          </span>
        </div>

        {/* Descrição */}
        {ficha.descricao && (
          <div className="space-y-1">
            <p 
              ref={descriptionRef}
              className={cn(
                "text-xs text-muted-foreground",
                !showFullDescription && "line-clamp-2"
              )}
            >
              {ficha.descricao}
            </p>
            {isDescriptionTruncated && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-primary"
                onClick={() => setShowFullDescription(!showFullDescription)}
              >
                {showFullDescription ? "Ver menos" : "Ler mais"}
              </Button>
            )}
          </div>
        )}

        {/* Prestador */}
        {ficha.prestador_nome && (
          <div className="flex items-center gap-1.5 text-xs">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">Prestador:</span>
            <span className="text-muted-foreground truncate">{ficha.prestador_nome}</span>
          </div>
        )}

        {/* Agendamento */}
        {ficha.horario_agendamento && (
          <div className="flex items-center gap-1.5 text-xs">
            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">Agendado:</span>
            <span className="text-muted-foreground truncate">
              {format(new Date(ficha.horario_agendamento), "dd/MM/yy HH:mm", { locale: ptBR })}
            </span>
          </div>
        )}

        {/* Número de orçamentos */}
        {ficha.orcamentos_count !== undefined && ficha.orcamentos_count > 0 && (
          <Badge variant="secondary" className="w-fit text-xs px-1.5 py-0.5">
            <DollarSign className="h-3 w-3 mr-1" />
            {ficha.orcamentos_count} orçamento{ficha.orcamentos_count > 1 ? "s" : ""}
          </Badge>
        )}

        {/* Popover de Orçamentos */}
        {ficha.orcamentos_count !== undefined && ficha.orcamentos_count > 0 && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-between h-8 text-xs"
                onClick={() => {
                  if (!isOpen) fetchOrcamentos();
                }}
              >
                <span>Ver Orçamentos</span>
                {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </PopoverTrigger>
            
            <PopoverContent 
              className="w-80 max-h-96 overflow-y-auto p-4 z-50"
              align="start"
              side="bottom"
            >
              <div className="space-y-2">
                {loadingOrcamentos ? (
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : orcamentos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Nenhum orçamento encontrado
                  </p>
                ) : (
                  orcamentos.map((orc) => (
                    <Card key={orc.id} className="p-3 bg-muted/30 border-border">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground">
                            {orc.prestador_nome}
                          </span>
                          <Badge
                            variant={
                              orc.status === "aprovado"
                                ? "default"
                                : orc.status === "rejeitado"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-xs"
                          >
                            {orc.status}
                          </Badge>
                        </div>
                        {orc.valor_total !== null && (
                          <p className="text-sm text-muted-foreground">
                            Valor: R$ {orc.valor_total.toFixed(2)}
                          </p>
                        )}
                        {orc.tempo_servico && (
                          <p className="text-xs text-muted-foreground">Tempo: {orc.tempo_servico}</p>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </CardContent>
    </Card>
  );
};
