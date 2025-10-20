import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus, Send } from "lucide-react";
import { toast } from "sonner";

interface Ficha {
  id: string;
  descricao: string | null;
  notas: string | null;
  valor_total: number;
  valor_mao_obra: number;
  valor_pecas: number;
  cpf: string | null;
  endereco: string | null;
  prestador_id: string | null;
  horario_agendamento: string | null;
  pagamento_tipo: string | null;
  pagamento_parcelas: number;
  pagamento_gerar_link: boolean;
  status: "pendente" | "em_andamento" | "concluido";
}

interface Orcamento {
  id: string;
  valor: number;
  descricao: string;
  enviado: boolean;
  status: string;
}

interface FichaPanelProps {
  clienteId: string;
  clienteNome: string;
  onClose: () => void;
}

export const FichaPanel = ({ clienteId, clienteNome, onClose }: FichaPanelProps) => {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [novoOrcamento, setNovoOrcamento] = useState({ valor: "", descricao: "" });

  useEffect(() => {
    fetchFicha();
  }, [clienteId]);

  const fetchFicha = async () => {
    const { data: fichaData } = await supabase
      .from('fichas_de_servico')
      .select('*')
      .eq('cliente_id', clienteId)
      .maybeSingle();

    if (fichaData) {
      setFicha(fichaData);
      fetchOrcamentos(fichaData.id);
    }
  };

  const fetchOrcamentos = async (fichaId: string) => {
    const { data } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('ficha_id', fichaId);

    if (data) setOrcamentos(data);
  };

  const criarFicha = async () => {
    const { data, error } = await supabase
      .from('fichas_de_servico')
      .insert({ cliente_id: clienteId })
      .select()
      .single();

    if (!error && data) {
      setFicha(data);
      toast.success("Ficha criada com sucesso!");
    }
  };

  const salvarFicha = async () => {
    if (!ficha) return;

    const { error } = await supabase
      .from('fichas_de_servico')
      .update({
        descricao: ficha.descricao,
        notas: ficha.notas,
        valor_total: ficha.valor_total,
        valor_mao_obra: ficha.valor_mao_obra,
        valor_pecas: ficha.valor_pecas,
        cpf: ficha.cpf,
        endereco: ficha.endereco,
        status: ficha.status
      })
      .eq('id', ficha.id);

    if (!error) {
      toast.success("Ficha salva com sucesso!");
    }
  };

  const criarOrcamento = async () => {
    if (!ficha || !novoOrcamento.valor || !novoOrcamento.descricao) return;

    const { error } = await supabase
      .from('orcamentos')
      .insert({
        ficha_id: ficha.id,
        valor: parseFloat(novoOrcamento.valor),
        descricao: novoOrcamento.descricao
      });

    if (!error) {
      toast.success("Orçamento criado!");
      setNovoOrcamento({ valor: "", descricao: "" });
      fetchOrcamentos(ficha.id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border-l">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-lg">Ficha de Serviço</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!ficha ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Nenhuma ficha encontrada</p>
            <Button onClick={criarFicha}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Ficha
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={ficha.descricao || ""}
                  onChange={(e) => setFicha({ ...ficha, descricao: e.target.value })}
                  placeholder="Descrição do serviço..."
                />
              </div>

              <div>
                <Label>Notas</Label>
                <Textarea
                  value={ficha.notas || ""}
                  onChange={(e) => setFicha({ ...ficha, notas: e.target.value })}
                  placeholder="Observações adicionais..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor Peças</Label>
                  <Input
                    type="number"
                    value={ficha.valor_pecas}
                    onChange={(e) => setFicha({ ...ficha, valor_pecas: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Valor Mão de Obra</Label>
                  <Input
                    type="number"
                    value={ficha.valor_mao_obra}
                    onChange={(e) => setFicha({ ...ficha, valor_mao_obra: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label>CPF</Label>
                <Input
                  value={ficha.cpf || ""}
                  onChange={(e) => setFicha({ ...ficha, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>

              <div>
                <Label>Endereço</Label>
                <Input
                  value={ficha.endereco || ""}
                  onChange={(e) => setFicha({ ...ficha, endereco: e.target.value })}
                  placeholder="Endereço completo..."
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select 
                  value={ficha.status} 
                  onValueChange={(value: "pendente" | "em_andamento" | "concluido") => 
                    setFicha({ ...ficha, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={salvarFicha} className="w-full">Salvar Ficha</Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Orçamentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {orcamentos.map((orc) => (
                  <div key={orc.id} className="p-3 border rounded-lg">
                    <p className="font-medium">{orc.descricao}</p>
                    <p className="text-sm text-muted-foreground">
                      R$ {orc.valor.toFixed(2)} - {orc.status}
                    </p>
                  </div>
                ))}

                <div className="space-y-2">
                  <Input
                    placeholder="Descrição do orçamento"
                    value={novoOrcamento.descricao}
                    onChange={(e) => setNovoOrcamento({ ...novoOrcamento, descricao: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Valor"
                    value={novoOrcamento.valor}
                    onChange={(e) => setNovoOrcamento({ ...novoOrcamento, valor: e.target.value })}
                  />
                  <Button onClick={criarOrcamento} className="w-full" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Orçamento
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};