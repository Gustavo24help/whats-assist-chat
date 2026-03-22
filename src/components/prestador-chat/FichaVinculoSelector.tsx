import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileText, Link, X } from "lucide-react";
import { toast } from "sonner";

interface FichaVinculoSelectorProps {
  prestadorTelefone: string;
  clienteTelefone?: string;
}

export const FichaVinculoSelector = ({ prestadorTelefone, clienteTelefone }: FichaVinculoSelectorProps) => {
  const { userProfile } = useAuth();
  const [fichaVinculada, setFichaVinculada] = useState<{ id: string; nome_ficha: string | null } | null>(null);
  const [fichasDisponiveis, setFichasDisponiveis] = useState<{ id: string; nome_ficha: string | null; descricao: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  // Load current vinculo
  useEffect(() => {
    const loadVinculo = async () => {
      const filterCol = prestadorTelefone ? "prestador_telefone" : "cliente_telefone";
      const filterVal = prestadorTelefone || clienteTelefone;

      const { data } = await supabase
        .from("conversa_ficha_vinculo")
        .select("ficha_id")
        .eq(filterCol, filterVal)
        .eq("ativo", true)
        .order("vinculado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.ficha_id) {
        const { data: ficha } = await supabase
          .from("fichas_de_servico")
          .select("id, nome_ficha")
          .eq("id", data.ficha_id)
          .single();

        if (ficha) setFichaVinculada(ficha);
      }
    };

    loadVinculo();
  }, [prestadorTelefone, clienteTelefone]);

  const loadFichas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fichas_de_servico")
      .select("id, nome_ficha, descricao")
      .not("status", "eq", "Perdido")
      .order("created_at", { ascending: false })
      .limit(50);

    setFichasDisponiveis(data || []);
    setLoading(false);
  };

  const vincularFicha = async (fichaId: string) => {
    // Deactivate old vinculos
    const filterCol = prestadorTelefone ? "prestador_telefone" : "cliente_telefone";
    const filterVal = prestadorTelefone || clienteTelefone;

    await supabase
      .from("conversa_ficha_vinculo")
      .update({ ativo: false })
      .eq(filterCol, filterVal!)
      .eq("ativo", true);

    // Create new vinculo
    const { error } = await supabase
      .from("conversa_ficha_vinculo")
      .insert({
        ficha_id: fichaId,
        prestador_telefone: prestadorTelefone || null,
        cliente_telefone: clienteTelefone || null,
        vinculado_por: userProfile?.fullName || "Operador",
      });

    if (error) {
      toast.error("Erro ao vincular ficha");
      return;
    }

    const { data: ficha } = await supabase
      .from("fichas_de_servico")
      .select("id, nome_ficha")
      .eq("id", fichaId)
      .single();

    if (ficha) {
      setFichaVinculada(ficha);
      toast.success(`Ficha ${fichaId} vinculada!`);
    }
  };

  const desvincular = async () => {
    const filterCol = prestadorTelefone ? "prestador_telefone" : "cliente_telefone";
    const filterVal = prestadorTelefone || clienteTelefone;

    await supabase
      .from("conversa_ficha_vinculo")
      .update({ ativo: false })
      .eq(filterCol, filterVal!)
      .eq("ativo", true);

    setFichaVinculada(null);
    toast.success("Ficha desvinculada");
  };

  if (fichaVinculada) {
    return (
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="gap-1 text-xs bg-primary/5">
          <FileText className="h-3 w-3" />
          {fichaVinculada.id}
        </Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={desvincular}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Popover onOpenChange={(open) => open && loadFichas()}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 text-xs">
          <Link className="h-3 w-3" />
          Vincular Ficha
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <p className="text-xs font-medium mb-2 px-1">Vincular a uma ficha de serviço</p>
        {loading ? (
          <p className="text-xs text-muted-foreground p-2">Carregando...</p>
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-1">
            {fichasDisponiveis.map((ficha) => (
              <button
                key={ficha.id}
                onClick={() => vincularFicha(ficha.id)}
                className="w-full text-left p-2 rounded hover:bg-accent text-xs"
              >
                <span className="font-medium">{ficha.id}</span>
                {ficha.nome_ficha && (
                  <span className="text-muted-foreground ml-1">- {ficha.nome_ficha}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
