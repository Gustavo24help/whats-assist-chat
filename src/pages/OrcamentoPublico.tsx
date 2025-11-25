import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, X, CalendarIcon, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo-24help.png";

const OrcamentoPublico = () => {
  const [searchParams] = useSearchParams();
  const fichaId = searchParams.get("ficha");
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [fichaExists, setFichaExists] = useState(false);
  const [formularioAtivo, setFormularioAtivo] = useState(true);
  const [validandoCpf, setValidandoCpf] = useState(false);
  const [cpfValido, setCpfValido] = useState<boolean | null>(null);
  const [nomePrestador, setNomePrestador] = useState("");
  const [fichaData, setFichaData] = useState<any>(null);
  const [orcamentoEnviado, setOrcamentoEnviado] = useState(false);
  
  const [dataSugerida, setDataSugerida] = useState<Date | undefined>(undefined);
  const [formData, setFormData] = useState({
    prestador_cpf: "",
    categoria: "",
    valor_mao_obra: "",
    valor_pecas: "",
    pode_horario: "sim",
    tempo_estimado: "",
    unidade_tempo: "Horas",
    horario_sugerido: "",
    observacoes: "",
    porcentagem_desconto: "",
  });

  useEffect(() => {
    if (fichaId) {
      verificarFicha();
      fetchCategorias();
    }
  }, [fichaId]);

  const verificarFicha = async () => {
    const { data } = await supabase
      .from("fichas_de_servico")
      .select(`
        *,
        categoria:categorias(nome),
        prestador:prestadores(nome)
      `)
      .eq("id", fichaId)
      .single();
    
    setFichaExists(!!data);
    setFormularioAtivo(data?.formulario_orcamento_ativo ?? true);
    setFichaData(data);
  };

  const fetchCategorias = async () => {
    const { data } = await supabase
      .from("categorias")
      .select("*")
      .order("nome");
    
    if (data) setCategorias(data);
  };

  const validarCpf = async (cpf: string) => {
    // Remover caracteres não numéricos
    const cpfLimpo = cpf.replace(/\D/g, "");
    
    if (cpfLimpo.length !== 11) {
      setCpfValido(null);
      setNomePrestador("");
      return;
    }

    setValidandoCpf(true);
    try {
      const { data } = await supabase
        .from("prestadores")
        .select("cpf, nome")
        .eq("cpf", cpfLimpo)
        .single();

      if (data) {
        setCpfValido(true);
        setNomePrestador(data.nome);
      } else {
        setCpfValido(false);
        setNomePrestador("");
      }
    } catch (error) {
      setCpfValido(false);
      setNomePrestador("");
    } finally {
      setValidandoCpf(false);
    }
  };

  const handleCpfChange = (value: string) => {
    setFormData({ ...formData, prestador_cpf: value });
    validarCpf(value);
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

    if (!formularioAtivo) {
      toast({
        title: "Formulário encerrado",
        description: "Este formulário de orçamento já foi encerrado.",
        variant: "destructive",
      });
      return;
    }

    if (!cpfValido) {
      toast({
        title: "CPF inválido",
        description: "Por favor, digite um CPF válido cadastrado no sistema.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const valorMaoObra = parseFloat(formData.valor_mao_obra) || 0;
      const valorPecas = parseFloat(formData.valor_pecas) || 0;
      const valorTotal = valorMaoObra + valorPecas;

      const cpfLimpo = formData.prestador_cpf.replace(/\D/g, "");
      
      const orcamentoData = {
        ficha_nome: fichaId,
        prestador_cpf: cpfLimpo,
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
          prestador_nome: nomePrestador,
          pode_horario: formData.pode_horario,
          data_sugerida: dataSugerida ? format(dataSugerida, "yyyy-MM-dd") : null,
          horario_sugerido: formData.horario_sugerido || null,
          porcentagem_desconto: formData.porcentagem_desconto,
        },
      });

      toast({
        title: "Orçamento enviado!",
        description: "Seu orçamento foi enviado com sucesso.",
      });

      // Mostrar tela de sucesso
      setOrcamentoEnviado(true);

      // Limpar formulário
      setFormData({
        prestador_cpf: "",
        categoria: "",
        valor_mao_obra: "",
        valor_pecas: "",
        pode_horario: "sim",
        tempo_estimado: "",
        unidade_tempo: "Horas",
        horario_sugerido: "",
        observacoes: "",
        porcentagem_desconto: "",
      });
      setDataSugerida(undefined);
      setCpfValido(null);
      setNomePrestador("");
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

  if (!formularioAtivo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-2">
            <p className="text-lg font-semibold text-foreground">Formulário Encerrado</p>
            <p className="text-muted-foreground">Este formulário de orçamento foi encerrado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (orcamentoEnviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex items-center justify-center">
              <img src={logo} alt="24Help" className="h-12 w-auto" />
            </div>
            
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-green-500/10 p-6">
                <Check className="h-16 w-16 text-green-500" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Orçamento Enviado!</h2>
              <p className="text-muted-foreground">
                Seu orçamento foi enviado com sucesso. Aguarde o contato da 24Help.
              </p>
            </div>

            <Button 
              onClick={() => setOrcamentoEnviado(false)} 
              variant="outline"
              className="w-full h-12 text-base"
            >
              Enviar outro orçamento
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-4 space-y-3">
          <div className="flex items-center justify-center">
            <img src={logo} alt="24Help" className="h-12 w-auto" />
          </div>
          
          {fichaData && (
            <div className="space-y-2">
              <CardTitle className="text-lg">{fichaData.nome_ficha || `Ficha #${fichaData.id}`}</CardTitle>
              {fichaData.descricao && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {fichaData.descricao}
                </p>
              )}
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    <Info className="mr-1 h-3 w-3" />
                    Ver informações completas
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Informações da Ficha</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 text-sm">
                    <div>
                      <Label className="text-xs font-semibold">Nome da Ficha</Label>
                      <p className="text-muted-foreground">{fichaData.nome_ficha || `Ficha #${fichaData.id}`}</p>
                    </div>
                    {fichaData.descricao && (
                      <div>
                        <Label className="text-xs font-semibold">Descrição</Label>
                        <p className="text-muted-foreground">{fichaData.descricao}</p>
                      </div>
                    )}
                    {fichaData.categoria && (
                      <div>
                        <Label className="text-xs font-semibold">Categoria</Label>
                        <p className="text-muted-foreground">{fichaData.categoria.nome}</p>
                      </div>
                    )}
                    {fichaData.endereco && (
                      <div>
                        <Label className="text-xs font-semibold">Endereço</Label>
                        <p className="text-muted-foreground">{fichaData.endereco}</p>
                      </div>
                    )}
                    {fichaData.horario_agendamento && (
                      <div>
                        <Label className="text-xs font-semibold">Horário Solicitado</Label>
                        <p className="text-muted-foreground">
                          {format(new Date(fichaData.horario_agendamento), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      </div>
                    )}
                    {fichaData.tempo_servico && (
                      <div>
                        <Label className="text-xs font-semibold">Tempo Estimado</Label>
                        <p className="text-muted-foreground">{fichaData.tempo_servico}</p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            Preencha os dados para enviar o orçamento
          </p>
        </CardHeader>

        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="cpf" className="text-base touch-action-manipulation">CPF do Prestador</Label>
              <div className="relative">
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={formData.prestador_cpf}
                  onChange={(e) => handleCpfChange(e.target.value)}
                  required
                  inputMode="numeric"
                  className="pr-10 h-12"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {validandoCpf ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : cpfValido === true ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : cpfValido === false ? (
                    <X className="h-4 w-4 text-red-500" />
                  ) : null}
                </div>
              </div>
              {cpfValido === false && (
                <p className="text-xs text-red-500">CPF não encontrado no sistema</p>
              )}
            </div>

            {nomePrestador && (
              <div className="space-y-2">
                <Label htmlFor="nome_prestador" className="text-base touch-action-manipulation">Nome do Prestador</Label>
                <Input
                  id="nome_prestador"
                  value={nomePrestador}
                  disabled
                  className="bg-muted h-12"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="categoria" className="text-base touch-action-manipulation">Categoria do Serviço</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                required
              >
                <SelectTrigger className="h-12">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mao_obra" className="text-base touch-action-manipulation">Mão de Obra (R$)</Label>
                <Input
                  id="mao_obra"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={formData.valor_mao_obra}
                  onChange={(e) => setFormData({ ...formData, valor_mao_obra: e.target.value })}
                  required
                  className="h-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pecas" className="text-base touch-action-manipulation">Peças/Materiais (R$)</Label>
                <Input
                  id="pecas"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={formData.valor_pecas}
                  onChange={(e) => setFormData({ ...formData, valor_pecas: e.target.value })}
                  required
                  className="h-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base touch-action-manipulation">Pode no horário solicitado pelo cliente?</Label>
              <RadioGroup
                value={formData.pode_horario}
                onValueChange={(value) => setFormData({ ...formData, pode_horario: value })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-3 min-h-[44px] p-2 rounded-md hover:bg-accent transition-colors">
                  <RadioGroupItem value="sim" id="sim" className="h-5 w-5" />
                  <Label htmlFor="sim" className="cursor-pointer font-normal text-base">Sim</Label>
                </div>
                <div className="flex items-center space-x-3 min-h-[44px] p-2 rounded-md hover:bg-accent transition-colors">
                  <RadioGroupItem value="nao" id="nao" className="h-5 w-5" />
                  <Label htmlFor="nao" className="cursor-pointer font-normal text-base">Não</Label>
                </div>
              </RadioGroup>
            </div>

            {formData.pode_horario === "nao" && (
              <div className="space-y-3 p-4 border border-border rounded-md bg-muted/30">
                <p className="text-base font-medium text-foreground">Sugerir nova data e horário:</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data_sugerida" className="text-base touch-action-manipulation">Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-12",
                            !dataSugerida && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dataSugerida ? format(dataSugerida, "dd/MM/yyyy") : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dataSugerida}
                          onSelect={setDataSugerida}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="horario_sugerido" className="text-base touch-action-manipulation">Horário</Label>
                    <Input
                      id="horario_sugerido"
                      type="time"
                      value={formData.horario_sugerido}
                      onChange={(e) => setFormData({ ...formData, horario_sugerido: e.target.value })}
                      className="h-12"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tempo" className="text-base touch-action-manipulation">Tempo Estimado</Label>
                <Input
                  id="tempo"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 2"
                  value={formData.tempo_estimado}
                  onChange={(e) => setFormData({ ...formData, tempo_estimado: e.target.value })}
                  required
                  className="h-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unidade" className="text-base touch-action-manipulation">Unidade de Tempo</Label>
                <Select
                  value={formData.unidade_tempo}
                  onValueChange={(value) => setFormData({ ...formData, unidade_tempo: value })}
                >
                  <SelectTrigger className="h-12">
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
              <Label htmlFor="obs" className="text-base touch-action-manipulation">Observação</Label>
              <Textarea
                id="obs"
                placeholder="Digite uma observação (opcional)"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                className="min-h-[100px] resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desconto" className="text-base touch-action-manipulation">Porcentagem de desconto (opcional)</Label>
              <Input
                id="desconto"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 10"
                value={formData.porcentagem_desconto}
                onChange={(e) => setFormData({ ...formData, porcentagem_desconto: e.target.value })}
                className="h-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-14 text-base"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
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
