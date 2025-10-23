import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface OrcamentosTabProps {
  fichaId: string;
}

interface Orcamento {
  id: string;
  prestador_cpf: string;
  valor_total: number | null;
  valor_mao_obra: number | null;
  valor_pecas: number | null;
  observacoes: string | null;
  categoria: string | null;
  status: string;
  data_criacao: string;
  prestador_nome?: string;
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
          filter: `ficha_nome=eq.${fichaId}`
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
      .eq('ficha_nome', fichaId)
      .order('data_criacao', { ascending: false });

    if (data) {
      // Buscar nome dos prestadores
      const orcamentosComNome = await Promise.all(
        data.map(async (orc) => {
          const { data: prestadorData } = await supabase
            .from('prestadores')
            .select('nome')
            .eq('cpf', orc.prestador_cpf)
            .maybeSingle();

          return {
            ...orc,
            prestador_nome: prestadorData?.nome || orc.prestador_cpf
          };
        })
      );
      setOrcamentos(orcamentosComNome);
    }
  };

  const aprovarOrcamento = async (orc: Orcamento) => {
    try {
      // Atualizar status do orçamento
      const { error: orcError } = await supabase
        .from('orcamentos')
        .update({ status: 'aprovado' })
        .eq('id', orc.id);

      if (orcError) throw orcError;

      // Atualizar ficha com valores do orçamento
      const { error: fichaError } = await supabase
        .from('fichas_de_servico')
        .update({
          valor_total: orc.valor_total || 0,
          valor_mao_obra: orc.valor_mao_obra || 0,
          valor_pecas: orc.valor_pecas || 0,
          prestador_id: orc.prestador_cpf
        })
        .eq('id', fichaId);

      if (fichaError) throw fichaError;

      // Buscar a ficha completa atualizada para enviar ao webhook
      const { data: fichaAtualizada } = await supabase
        .from('fichas_de_servico')
        .select('*')
        .eq('id', fichaId)
        .single();

      if (fichaAtualizada) {
        // Buscar id_crm do prestador
        const { data: prestadorData } = await supabase
          .from('prestadores')
          .select('id_crm, cpf')
          .eq('cpf', orc.prestador_cpf)
          .maybeSingle();

        const webhookUrl = localStorage.getItem('webhook_ficha_atualizada');
        if (webhookUrl) {
          try {
            const webhookPayload = {
              ...(fichaAtualizada as any),
              // Enviar id_crm do prestador (ID do CRM externo)
              prestador_id_crm: prestadorData?.id_crm || null,
              // Enviar CPF do prestador para facilitar updates na API externa
              prestador_cpf: prestadorData?.cpf || orc.prestador_cpf,
              // Converter boolean para string legível
              pagamento_gerar_link: fichaAtualizada.pagamento_gerar_link ? "Sim" : "Não",
              // Metadados úteis
              timestamp_webhook: new Date().toISOString(),
              evento: 'orcamento_aprovado',
            };

            console.log("Enviando webhook após aprovação de orçamento:", webhookUrl);
            console.log("Payload:", JSON.stringify(webhookPayload, null, 2));

            const response = await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(webhookPayload),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error("Erro no webhook (HTTP " + response.status + "):", errorText);
            } else {
              console.log("Webhook enviado com sucesso após aprovar orçamento");
            }
          } catch (webhookError) {
            console.error('Erro ao enviar webhook:', webhookError);
            const errorMessage = webhookError instanceof Error ? webhookError.message : 'Erro desconhecido';
            console.error('Detalhes do erro:', errorMessage);
          }
        }
      }

      toast.success("Orçamento aprovado! Valores atualizados na ficha.");
      fetchOrcamentos();
    } catch (error) {
      console.error('Erro ao aprovar orçamento:', error);
      toast.error("Erro ao aprovar orçamento");
    }
  };

  return (
    <div className="p-6">
      <h3 className="text-xl font-bold mb-6 text-foreground">Orçamentos</h3>
      
      {orcamentos.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum orçamento cadastrado</p>
      ) : (
        <div className="space-y-4">
          {orcamentos.map((orc) => (
            <Card key={orc.id} className="shadow-md border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Orçamento #{orc.id.slice(0, 8)}</CardTitle>
                  <Badge 
                    variant={orc.status === 'aprovado' ? 'default' : 'secondary'}
                    className="shadow-sm"
                  >
                    {orc.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <div className="text-sm">
                  <span className="font-medium text-foreground">Prestador:</span> 
                  <span className="text-muted-foreground ml-1">{orc.prestador_nome || orc.prestador_cpf}</span>
                </div>

                {orc.valor_total !== null && (
                  <div className="text-sm">
                    <span className="font-medium text-foreground">Valor Total:</span> 
                    <span className="text-muted-foreground ml-1">R$ {orc.valor_total.toFixed(2)}</span>
                  </div>
                )}
                
                {orc.valor_mao_obra !== null && (
                  <div className="text-sm">
                    <span className="font-medium text-foreground">Mão de Obra:</span> 
                    <span className="text-muted-foreground ml-1">R$ {orc.valor_mao_obra.toFixed(2)}</span>
                  </div>
                )}
                
                {orc.valor_pecas !== null && (
                  <div className="text-sm">
                    <span className="font-medium text-foreground">Peças:</span> 
                    <span className="text-muted-foreground ml-1">R$ {orc.valor_pecas.toFixed(2)}</span>
                  </div>
                )}
                
                {orc.categoria && (
                  <div className="text-sm">
                    <span className="font-medium text-foreground">Categoria:</span> 
                    <span className="text-muted-foreground ml-1">{orc.categoria}</span>
                  </div>
                )}
                
                {orc.observacoes && (
                  <div className="text-sm">
                    <span className="font-medium text-foreground">Observações:</span>
                    <p className="text-muted-foreground mt-1">{orc.observacoes}</p>
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    Criado em: {format(new Date(orc.data_criacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                  
                  {orc.status !== 'aprovado' && (
                    <Button 
                      variant="secondary"
                      size="sm"
                      className="shadow-sm hover:shadow-md transition-shadow"
                      onClick={() => aprovarOrcamento(orc)}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Aprovar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
