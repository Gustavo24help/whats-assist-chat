import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
}

export const OrcamentosTab = ({ fichaId }: OrcamentosTabProps) => {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  
  // Estados do formulário
  const [prestadorCpf, setPrestadorCpf] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [valorMaoObra, setValorMaoObra] = useState("");
  const [valorPecas, setValorPecas] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [categoria, setCategoria] = useState("");

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

    if (data) setOrcamentos(data);
  };

  const limparFormulario = () => {
    setPrestadorCpf("");
    setValorTotal("");
    setValorMaoObra("");
    setValorPecas("");
    setObservacoes("");
    setCategoria("");
  };

  const adicionarOrcamento = async () => {
    if (!prestadorCpf.trim()) {
      toast.error("CPF do prestador é obrigatório");
      return;
    }

    const novoOrcamento = {
      ficha_nome: fichaId,
      prestador_cpf: prestadorCpf.trim(),
      valor_total: valorTotal ? parseFloat(valorTotal) : null,
      valor_mao_obra: valorMaoObra ? parseFloat(valorMaoObra) : null,
      valor_pecas: valorPecas ? parseFloat(valorPecas) : null,
      observacoes: observacoes.trim() || null,
      categoria: categoria.trim() || null,
      status: 'pendente' as const
    };

    const { error } = await supabase
      .from('orcamentos')
      .insert([novoOrcamento]);

    if (error) {
      console.error("Erro ao adicionar orçamento:", error);
      toast.error("Erro ao adicionar orçamento");
      return;
    }

    toast.success("Orçamento adicionado com sucesso");
    limparFormulario();
    fetchOrcamentos();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <h3 className="font-semibold text-lg">Orçamentos</h3>
        
        {/* Formulário para adicionar orçamento */}
        <Accordion type="single" collapsible defaultValue="novo-orcamento">
          <AccordionItem value="novo-orcamento">
            <AccordionTrigger>➕ Adicionar Novo Orçamento</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                <div>
                  <Label htmlFor="prestador_cpf">CPF do Prestador *</Label>
                  <Input
                    id="prestador_cpf"
                    value={prestadorCpf}
                    onChange={(e) => setPrestadorCpf(e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>

                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Input
                    id="categoria"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    placeholder="Ex: Elétrica, Hidráulica..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="valor_total">Valor Total</Label>
                    <Input
                      id="valor_total"
                      type="number"
                      step="0.01"
                      value={valorTotal}
                      onChange={(e) => setValorTotal(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="valor_mao_obra">Mão de Obra</Label>
                    <Input
                      id="valor_mao_obra"
                      type="number"
                      step="0.01"
                      value={valorMaoObra}
                      onChange={(e) => setValorMaoObra(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="valor_pecas">Peças</Label>
                    <Input
                      id="valor_pecas"
                      type="number"
                      step="0.01"
                      value={valorPecas}
                      onChange={(e) => setValorPecas(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Detalhes do orçamento..."
                    rows={3}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Lista de orçamentos */}
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
                <p className="text-sm">
                  <span className="font-medium">CPF Prestador:</span> {orc.prestador_cpf}
                </p>
                
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {orc.valor_total !== null && (
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-medium">R$ {orc.valor_total.toFixed(2)}</p>
                    </div>
                  )}
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

                {orc.observacoes && (
                  <p className="text-sm">
                    <span className="font-medium">Observações:</span> {orc.observacoes}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Criado em: {new Date(orc.data_criacao).toLocaleString('pt-BR')}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Botão flutuante de salvar */}
      <div className="sticky bottom-0 bg-background border-t border-border p-3 z-10">
        <Button onClick={adicionarOrcamento} className="w-full">
          💾 Adicionar Orçamento
        </Button>
      </div>
    </div>
  );
};
