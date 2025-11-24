import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const OrcamentoPublico = () => {
  const [searchParams] = useSearchParams();
  const fichaId = searchParams.get("ficha");
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [fichaExists, setFichaExists] = useState(false);
  
  const [formData, setFormData] = useState({
    prestador_cpf: "",
    categoria: "",
    valor_mao_obra: "",
    valor_pecas: "",
    pode_horario: "sim",
    tempo_estimado: "",
    unidade_tempo: "Horas",
    servico_adicional: "",
    observacoes: "",
    porcentagem_desconto: "",
  });

  useEffect(() => {
    if (fichaId) {
      verificarFicha();
      fetchCategorias();
      fetchPrestadores();
    }
  }, [fichaId]);

  const verificarFicha = async () => {
    const { data } = await supabase
      .from("fichas_de_servico")
      .select("id")
      .eq("id", fichaId)
      .single();
    
    setFichaExists(!!data);
  };

  const fetchCategorias = async () => {
    const { data } = await supabase
      .from("categorias")
      .select("*")
      .order("nome");
    
    if (data) setCategorias(data);
  };

  const fetchPrestadores = async () => {
    const { data } = await supabase
      .from("prestadores")
      .select("cpf, nome")
      .order("nome");
    
    if (data) setPrestadores(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fichaExists) {
      toast({
        title: "Erro",
        description: "Ficha não encontrada",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const valorMaoObra = parseFloat(formData.valor_mao_obra) || 0;
      const valorPecas = parseFloat(formData.valor_pecas) || 0;
      const valorTotal = valorMaoObra + valorPecas;

      // Buscar nome do prestador
      const prestador = prestadores.find(p => p.cpf === formData.prestador_cpf);
      
      const orcamentoData = {
        ficha_nome: fichaId,
        prestador_cpf: formData.prestador_cpf,
        categoria: formData.categoria,
        valor_mao_obra: valorMaoObra,
        valor_pecas: valorPecas,
        valor_total: valorTotal,
        tempo_servico: `${formData.tempo_estimado} ${formData.unidade_tempo}`,
        observacoes: formData.observacoes,
        status: "pendente" as const,
      };

      // Salvar no banco
      const { data: orcamento, error } = await supabase
        .from("orcamentos")
        .insert([orcamentoData])
        .select()
        .single();

      if (error) throw error;

      // Enviar webhook
      await supabase.functions.invoke("submit-orcamento", {
        body: {
          ...orcamentoData,
          prestador_nome: prestador?.nome,
          pode_horario: formData.pode_horario,
          servico_adicional: formData.servico_adicional,
          porcentagem_desconto: formData.porcentagem_desconto,
        },
      });

      toast({
        title: "Orçamento enviado!",
        description: "Seu orçamento foi enviado com sucesso.",
      });

      // Limpar formulário
      setFormData({
        prestador_cpf: "",
        categoria: "",
        valor_mao_obra: "",
        valor_pecas: "",
        pode_horario: "sim",
        tempo_estimado: "",
        unidade_tempo: "Horas",
        servico_adicional: "",
        observacoes: "",
        porcentagem_desconto: "",
      });
    } catch (error) {
      console.error("Erro ao enviar orçamento:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar orçamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!fichaId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Link inválido. Por favor, use o link fornecido pela 24Help.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!fichaExists) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Ficha não encontrada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">24</span>
            </div>
            <span className="text-lg font-semibold text-primary">Help</span>
          </div>
          <CardTitle className="text-xl">Formulário de Orçamento</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Preencha os dados para enviar o orçamento
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prestador">Nome do Prestador</Label>
              <Select
                value={formData.prestador_cpf}
                onValueChange={(value) => setFormData({ ...formData, prestador_cpf: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {prestadores.map((prestador) => (
                    <SelectItem key={prestador.cpf} value={prestador.cpf}>
                      {prestador.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={formData.prestador_cpf}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria do Serviço</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.nome}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="mao_obra">Mão de Obra (R$)</Label>
                <Input
                  id="mao_obra"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.valor_mao_obra}
                  onChange={(e) => setFormData({ ...formData, valor_mao_obra: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pecas">Peças/Materiais (R$)</Label>
                <Input
                  id="pecas"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.valor_pecas}
                  onChange={(e) => setFormData({ ...formData, valor_pecas: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pode no horário solicitado pelo cliente?</Label>
              <RadioGroup
                value={formData.pode_horario}
                onValueChange={(value) => setFormData({ ...formData, pode_horario: value })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="sim" />
                  <Label htmlFor="sim" className="cursor-pointer font-normal">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="nao" />
                  <Label htmlFor="nao" className="cursor-pointer font-normal">Não</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tempo">Tempo Estimado</Label>
                <Input
                  id="tempo"
                  type="number"
                  placeholder="Ex: 2"
                  value={formData.tempo_estimado}
                  onChange={(e) => setFormData({ ...formData, tempo_estimado: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unidade">Unidade de Tempo</Label>
                <Select
                  value={formData.unidade_tempo}
                  onValueChange={(value) => setFormData({ ...formData, unidade_tempo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Horas">Horas</SelectItem>
                    <SelectItem value="Dias">Dias</SelectItem>
                    <SelectItem value="Semanas">Semanas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adicional">Adicional/Serviço</Label>
              <Input
                id="adicional"
                placeholder="Adicional (Opcional)"
                value={formData.servico_adicional}
                onChange={(e) => setFormData({ ...formData, servico_adicional: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="obs">Observação</Label>
              <Textarea
                id="obs"
                placeholder="Digite uma observação (opcional)"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desconto">Porcentagem de desconto (opcional)</Label>
              <Input
                id="desconto"
                type="number"
                placeholder="Ex: 10"
                value={formData.porcentagem_desconto}
                onChange={(e) => setFormData({ ...formData, porcentagem_desconto: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Orçamento"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrcamentoPublico;
