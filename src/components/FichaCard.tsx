import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  User, 
  DollarSign, 
  Briefcase, 
  Copy, 
  RotateCcw, 
  Loader2,
  CheckCircle2,
  Clock,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
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

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  "Ficha Criada": { bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-300", border: "border-blue-500/30" },
  "Contato Inicial": { bg: "bg-cyan-500/10", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-500/30" },
  "Dúvida Prestador": { bg: "bg-purple-500/10", text: "text-purple-700 dark:text-purple-300", border: "border-purple-500/30" },
  "Orçamento Enviado": { bg: "bg-indigo-500/10", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-500/30" },
  "Negociação": { bg: "bg-yellow-500/10", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-500/30" },
  "Visita Técnica": { bg: "bg-pink-500/10", text: "text-pink-700 dark:text-pink-300", border: "border-pink-500/30" },
  "Orçamento Aprovado / Agendamento": { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-500/30" },
  "Orçamento Não Aprovado": { bg: "bg-red-500/10", text: "text-red-700 dark:text-red-300", border: "border-red-500/30" },
  "Agendado": { bg: "bg-teal-500/10", text: "text-teal-700 dark:text-teal-300", border: "border-teal-500/30" },
  "Em andamento": { bg: "bg-orange-500/10", text: "text-orange-700 dark:text-orange-300", border: "border-orange-500/30" },
  "Finalizado": { bg: "bg-green-500/10", text: "text-green-700 dark:text-green-300", border: "border-green-500/30" },
  "Garantia": { bg: "bg-lime-500/10", text: "text-lime-700 dark:text-lime-300", border: "border-lime-500/30" },
  "Perdido": { bg: "bg-gray-500/10", text: "text-gray-700 dark:text-gray-300", border: "border-gray-500/30" },
  "Não foi adiante": { bg: "bg-slate-500/10", text: "text-slate-700 dark:text-slate-300", border: "border-slate-500/30" },
};

const getStatusConfig = (status: string | null) => {
  return STATUS_CONFIG[status || ""] || { bg: "bg-gray-500/10", text: "text-gray-700 dark:text-gray-300", border: "border-gray-500/30" };
};

export const FichaCard = ({ ficha }: FichaCardProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loadingOrcamentos, setLoadingOrcamentos] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isDescriptionTruncated, setIsDescriptionTruncated] = useState(false);
  const [reativando, setReativando] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

  const statusConfig = getStatusConfig(ficha.status);

  useEffect(() => {
    if (descriptionRef.current && ficha.descricao) {
      const element = descriptionRef.current;
      setIsDescriptionTruncated(element.scrollHeight > element.clientHeight);
    }
  }, [ficha.descricao]);

  const fetchOrcamentos = async () => {
    if (orcamentos.length > 0) return;

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

  const copiarLinkOrcamento = () => {
    const link = `https://chat.24help.com.br/orcamento?ficha=${encodeURIComponent(ficha.id)}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "O link do formulário de orçamento foi copiado.",
    });
  };

  const reativarFormulario = async () => {
    setReativando(true);
    try {
      const { error } = await supabase
        .from("fichas_de_servico")
        .update({
          formulario_orcamento_ativo: true,
          formulario_orcamento_encerrado_em: null,
        })
        .eq("id", ficha.id);

      if (error) throw error;

      toast({
        title: "Formulário reativado!",
        description: "O formulário de orçamento foi reativado com sucesso.",
      });

      ficha.formulario_orcamento_ativo = true;
    } catch (error) {
      console.error("Erro ao reativar formulário:", error);
      toast({
        title: "Erro",
        description: "Erro ao reativar formulário. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setReativando(false);
    }
  };

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300",
      "hover:shadow-lg hover:-translate-y-1",
      "border-l-4",
      statusConfig.border
    )}>
      {/* Header com Status */}
      <div className={cn("px-4 pt-4 pb-2", statusConfig.bg)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate text-base">
              {ficha.nome_ficha || "Sem nome"}
            </h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {ficha.cliente_nome}
            </p>
          </div>
          <Badge 
            variant="outline" 
            className={cn("shrink-0 text-xs font-medium", statusConfig.text, statusConfig.border)}
          >
            {ficha.status || "Sem status"}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 pt-3 space-y-3">
        {/* Info Row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {ficha.created_at
                ? format(new Date(ficha.created_at), "dd/MM/yyyy", { locale: ptBR })
                : "Sem data"}
            </span>
          </div>
          
          {ficha.pagamento_realizado ? (
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Pago</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5" />
              <span>Pendente</span>
            </div>
          )}
        </div>

        {/* Descrição */}
        {ficha.descricao && (
          <div className="space-y-1">
            <p
              ref={descriptionRef}
              className={cn(
                "text-sm text-muted-foreground leading-relaxed",
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

        {/* Prestador e Agendamento */}
        <div className="space-y-2">
          {ficha.prestador_nome && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">{ficha.prestador_nome}</span>
            </div>
          )}

          {ficha.horario_agendamento && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">
                {format(new Date(ficha.horario_agendamento), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {ficha.orcamentos_count !== undefined && ficha.orcamentos_count > 0 && (
            <Badge variant="secondary" className="text-xs gap-1">
              <DollarSign className="h-3 w-3" />
              {ficha.orcamentos_count} orçamento{ficha.orcamentos_count > 1 ? "s" : ""}
            </Badge>
          )}

          {ficha.formulario_orcamento_ativo === false && (
            <Badge variant="destructive" className="text-xs gap-1">
              <FileText className="h-3 w-3" />
              Envio de Orçamentos Encerrado
            </Badge>
          )}
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-9 text-xs"
            onClick={copiarLinkOrcamento}
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copiar Link
          </Button>

          {ficha.formulario_orcamento_ativo === false && (
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 h-9 text-xs"
              onClick={reativarFormulario}
              disabled={reativando}
            >
              {reativando ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Reabrir Envio de Orçamentos
            </Button>
          )}
        </div>

        {/* Popover de Orçamentos */}
        {ficha.orcamentos_count !== undefined && ficha.orcamentos_count > 0 && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between h-9 text-xs hover:bg-muted"
                onClick={() => {
                  if (!isOpen) fetchOrcamentos();
                }}
              >
                <span>Ver Orçamentos</span>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </PopoverTrigger>

            <PopoverContent
              className="w-80 max-h-96 overflow-y-auto p-4 z-50"
              align="start"
              side="bottom"
            >
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-foreground">Orçamentos</h4>
                
                {loadingOrcamentos ? (
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : orcamentos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum orçamento encontrado
                  </p>
                ) : (
                  orcamentos.map((orc) => (
                    <Card key={orc.id} className="p-3 bg-muted/50">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground truncate">
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
                          <p className="text-lg font-semibold text-foreground">
                            R$ {orc.valor_total.toFixed(2)}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {orc.tempo_servico && (
                            <span>⏱️ {orc.tempo_servico}</span>
                          )}
                          {orc.data_criacao && (
                            <span>
                              {format(new Date(orc.data_criacao), "dd/MM/yy", { locale: ptBR })}
                            </span>
                          )}
                        </div>
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
