import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface OrcamentosTabProps {
  fichaId: string;
}

interface Orcamento {
  id: string;
  cpf_prestador: string | null;
  valor: number;
  valor_mao_obra: number | null;
  valor_pecas: number | null;
  descricao: string;
  categoria: string | null;
  status: string;
  created_at: string;
}

export const OrcamentosTab = ({ fichaId }: OrcamentosTabProps) => {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);

  useEffect(() => {
    fetchOrcamentos();

    const channel = supabase
      .channel(`orcamentos-${fichaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orcamentos',
          filter: `ficha_id=eq.${fichaId}`
        },
        () => fetchOrcamentos()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fichaId]);

  const fetchOrcamentos = async () => {
    const { data } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('ficha_id', fichaId)
      .order('created_at', { ascending: false });

    if (data) setOrcamentos(data);
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <h3 className="font-semibold text-lg">Orçamentos</h3>
      
      {orcamentos.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum orçamento cadastrado</p>
      ) : (
        orcamentos.map((orc) => (
          <Card key={orc.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Orçamento #{orc.id.slice(0, 8)}</span>
                <Badge variant={orc.status === 'aprovado' ? 'default' : 'secondary'}>
                  {orc.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {orc.cpf_prestador && (
                <p className="text-sm">
                  <span className="font-medium">CPF Prestador:</span> {orc.cpf_prestador}
                </p>
              )}
              
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">R$ {orc.valor.toFixed(2)}</p>
                </div>
                {orc.valor_mao_obra !== null && (
                  <div>
                    <p className="text-muted-foreground">Mão de Obra</p>
                    <p className="font-medium">R$ {orc.valor_mao_obra.toFixed(2)}</p>
                  </div>
                )}
                {orc.valor_pecas !== null && (
                  <div>
                    <p className="text-muted-foreground">Peças</p>
                    <p className="font-medium">R$ {orc.valor_pecas.toFixed(2)}</p>
                  </div>
                )}
              </div>

              {orc.categoria && (
                <p className="text-sm">
                  <span className="font-medium">Categoria:</span> {orc.categoria}
                </p>
              )}

              <p className="text-sm">
                <span className="font-medium">Observações:</span> {orc.descricao}
              </p>

              <Button variant="outline" className="w-full mt-2">
                Aprovar
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
