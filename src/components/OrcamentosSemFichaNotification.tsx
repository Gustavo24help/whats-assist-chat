import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface FichaSemCriar {
  ficha_nome: string;
  total_orcamentos: number;
}

export const OrcamentosSemFichaNotification = () => {
  const [fichasSemCriar, setFichasSemCriar] = useState<FichaSemCriar[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchOrcamentosSemFicha = async () => {
    try {
      // Buscar todos os orçamentos
      const { data: orcamentos, error: orcError } = await supabase
        .from("orcamentos")
        .select("ficha_nome");

      if (orcError) throw orcError;

      // Buscar todas as fichas existentes
      const { data: fichas, error: fichasError } = await supabase
        .from("fichas_de_servico")
        .select("id");

      if (fichasError) throw fichasError;

      // Criar set de IDs de fichas existentes
      const fichasExistentes = new Set(fichas?.map(f => f.id) || []);

      // Filtrar orçamentos sem ficha e contar
      const fichasSemCriarMap = new Map<string, number>();
      
      orcamentos?.forEach(orc => {
        if (!fichasExistentes.has(orc.ficha_nome)) {
          fichasSemCriarMap.set(
            orc.ficha_nome,
            (fichasSemCriarMap.get(orc.ficha_nome) || 0) + 1
          );
        }
      });

      // Converter para array
      const resultado = Array.from(fichasSemCriarMap.entries()).map(([ficha_nome, total_orcamentos]) => ({
        ficha_nome,
        total_orcamentos
      }));

      setFichasSemCriar(resultado);
    } catch (error) {
      console.error("Erro ao buscar orçamentos sem ficha:", error);
    }
  };

  useEffect(() => {
    fetchOrcamentosSemFicha();

    // Escutar mudanças em orçamentos e fichas
    const orcamentosChannel = supabase
      .channel("orcamentos-sem-ficha")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orcamentos"
        },
        () => {
          fetchOrcamentosSemFicha();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "fichas_de_servico"
        },
        () => {
          fetchOrcamentosSemFicha();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orcamentosChannel);
    };
  }, []);

  const totalOrcamentos = fichasSemCriar.reduce((acc, curr) => acc + curr.total_orcamentos, 0);

  if (totalOrcamentos === 0) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <AlertCircle className="h-4 w-4 text-blue-500" />
          {totalOrcamentos > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-blue-500 hover:bg-blue-600"
            >
              {totalOrcamentos}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            Fichas não criadas
          </h4>
          <p className="text-xs text-muted-foreground">
            Estas fichas possuem orçamentos mas ainda não foram criadas no sistema.
          </p>
          <ScrollArea className="h-[200px] mt-2">
            <div className="space-y-2">
              {fichasSemCriar.map((ficha) => (
                <div
                  key={ficha.ficha_nome}
                  className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {ficha.ficha_nome}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {ficha.total_orcamentos} {ficha.total_orcamentos === 1 ? 'orçamento' : 'orçamentos'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
};
