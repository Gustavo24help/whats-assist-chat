import { useState, useEffect } from "react";
import { useSearchParams, useParams } from "react-router-dom";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, X, CalendarIcon, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo-24help.png";
import ErrorBoundary from "@/components/ErrorBoundary";

// Parse number handling Brazilian locale (dot as thousand separator, comma as decimal)
function parseLocalizedNumber(value: string): number {
  if (!value || value.trim() === "") return 0;
  let str = value.trim();
  // Remove currency symbols and spaces
  str = str.replace(/[R$\s]/g, "");
  
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  
  if (lastComma > lastDot) {
    // Brazilian format: 4.800,50 → comma is decimal
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // Could be 4,800.50 (US) or just 4800.50
    // Check if dot has exactly 3 digits after and no decimal part with comma
    const afterDot = str.substring(lastDot + 1);
    const beforeDot = str.substring(0, lastDot);
    if (afterDot.length === 3 && !str.includes(",") && !afterDot.includes(",")) {
      // Likely thousand separator: 4.800 → 4800
      str = str.replace(/\./g, "");
    } else {
      // Normal decimal: 48.50
      str = str.replace(/,/g, "");
    }
  } else {
    // No dot or comma, or only one type present
    if (lastComma !== -1) {
      const afterComma = str.substring(lastComma + 1);
      if (afterComma.length === 3) {
        // Thousand separator: 4,800 → 4800
        str = str.replace(/,/g, "");
      } else {
        // Decimal: 48,5
        str = str.replace(",", ".");
      }
    }
    // If only dots or no separators, keep as is (dots handled above)
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper function para formatação segura de datas
const formatarDataSegura = (dataStr: string | null | undefined, formatStr: string): string => {
  if (!dataStr) return "Data não disponível";
  try {
    const data = new Date(dataStr);
    if (isNaN(data.getTime())) return "Data inválida";
    return format(data, formatStr);
  } catch {
    return "Data não disponível";
  }
};

const OrcamentoPublico = () => {
  const [searchParams] = useSearchParams();
  const params = useParams<{ fichaId?: string }>();
  
  // Obter fichaId com fallback robusto para window.location
  const getFichaId = (): string | null => {
    // 1. Path parameter (novo formato: /orcamento/ID)
    if (params.fichaId) {
      console.log("OrcamentoPublico - fichaId do path param:", params.fichaId);
      return params.fichaId;
    }
    
    // 2. Query parameter (formato antigo: /orcamento?ficha=ID)
    const fromRouter = searchParams.get("ficha");
    if (fromRouter) {
      console.log("OrcamentoPublico - fichaId do query param:", fromRouter);
      return fromRouter;
    }
    
    // Fallback: ler diretamente da URL do navegador
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const fromWindow = urlParams.get("ficha");
      if (fromWindow) {
        console.log("OrcamentoPublico - fichaId do window.location (fallback):", fromWindow);
        return fromWindow;
      }
    }
    
    return null;
  };
  
  const [fichaId, setFichaId] = useState<string | null>(getFichaId());
  const [verificandoUrl, setVerificandoUrl] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
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

  // Verificação robusta da URL com delay para garantir que React Router processou
  useEffect(() => {
    console.log("OrcamentoPublico - URL completa:", window.location.href);
    console.log("OrcamentoPublico - search params:", window.location.search);
    
    // Aguardar um ciclo de render para garantir que React Router processou a URL
    const timer = setTimeout(() => {
      const currentFichaId = getFichaId();
      console.log("OrcamentoPublico - fichaId após verificação:", currentFichaId);
      setFichaId(currentFichaId);
      setVerificandoUrl(false);

      // Normaliza URL antiga (?ficha=) para path parameter, evitando truncamento
      // em in-app browsers (WhatsApp) em recargas/compartilhamentos futuros.
      if (currentFichaId && !params.fichaId && typeof window !== 'undefined') {
        const novaUrl = `/orcamento/${encodeURIComponent(currentFichaId)}`;
        window.history.replaceState({}, '', novaUrl);
      }
    }, 150);
    
    return () => clearTimeout(timer);
  }, [searchParams]);

  useEffect(() => {
    const carregarDados = async () => {
      if (verificandoUrl) return; // Aguardar verificação da URL
      
      setCarregandoInicial(true);
      try {
        if (fichaId) {
          await Promise.all([verificarFicha(), fetchCategorias()]);
        }
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
      } finally {
        setCarregandoInicial(false);
      }
    };
    carregarDados();
  }, [fichaId, verificandoUrl]);

  const verificarFicha = async () => {
    console.log("OrcamentoPublico - verificando fichaId:", fichaId);
    try {
      const { data: responseData, error: invokeError } = await supabase.functions.invoke("public-orcamento-data", {
        body: { action: "verificar-ficha", ficha_id: fichaId },
      });

      if (invokeError || !responseData?.success) {
        console.error("OrcamentoPublico - Erro ao buscar ficha:", invokeError || responseData?.error);
        setFichaExists(false);
        return;
      }

      const ficha = responseData.ficha;
      console.log("OrcamentoPublico - Ficha encontrada:", !!ficha);
      setFichaExists(!!ficha);
      setFormularioAtivo(ficha?.formulario_orcamento_ativo ?? true);
      setFichaData(ficha);
      setCategorias(responseData.categorias || []);
      
      // Pré-selecionar a categoria da ficha
      if (ficha?.categorias?.nome) {
        setFormData(prev => ({ ...prev, categoria: ficha.categorias.nome }));
      }
    } catch (error) {
      console.error("OrcamentoPublico - Erro inesperado:", error);
      setFichaExists(false);
    }
  };

  const fetchCategorias = async () => {
    // Categorias são carregadas junto com verificarFicha
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
      const { data: responseData } = await supabase.functions.invoke("public-orcamento-data", {
        body: { action: "validar-cpf", cpf: cpfLimpo },
      });

      if (responseData?.valido) {
        setCpfValido(true);
        setNomePrestador(responseData.nome || "");
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

  // Função para arredondar para o próximo número terminando em 8
  const arredondarParaProximo8 = (valor: number): number => {
    const arredondado = Math.ceil(valor);
    const ultimoDigito = arredondado % 10;
    
    if (ultimoDigito === 8) {
      return arredondado;
    } else if (ultimoDigito < 8) {
      return Math.floor(arredondado / 10) * 10 + 8;
    } else {
      return Math.floor(arredondado / 10) * 10 + 18;
    }
  };

  // Função para calcular valor total com taxa
  const calcularValorTotalComTaxa = (maoObra: number, pecas: number): number => {
    const soma = maoObra + pecas;
    const comTaxa = soma / 0.77;
    return arredondarParaProximo8(comTaxa);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (fichaExists && !formularioAtivo) {
      toast.error("Formulário encerrado", {
        description: "Este formulário de orçamento já foi encerrado.",
      });
      return;
    }

    if (!cpfValido) {
      toast.error("CPF inválido", {
        description: "Por favor, digite um CPF válido cadastrado no sistema.",
      });
      return;
    }

    // Validar tempo estimado
    if (!formData.tempo_estimado || formData.tempo_estimado.trim() === "") {
      toast.error("Campo obrigatório", {
        description: "Por favor, informe o tempo estimado do serviço.",
      });
      return;
    }

    // Validar categoria
    if (!formData.categoria || formData.categoria.trim() === "") {
      toast.error("Campo obrigatório", {
        description: "Por favor, selecione uma categoria.",
      });
      return;
    }

    setLoading(true);

    try {
      const valorMaoObra = parseLocalizedNumber(formData.valor_mao_obra);
      const valorPecas = parseLocalizedNumber(formData.valor_pecas);
      const valorTotal = calcularValorTotalComTaxa(valorMaoObra, valorPecas);

      const cpfLimpo = formData.prestador_cpf.replace(/\D/g, "");
      
      // Combinar data e horário sugeridos em timestamp
      let horarioSugeridoTimestamp = null;
      if (formData.pode_horario === "nao" && dataSugerida && formData.horario_sugerido) {
        const [horas, minutos] = formData.horario_sugerido.split(':');
        const dataCompleta = new Date(dataSugerida);
        dataCompleta.setHours(parseInt(horas), parseInt(minutos), 0, 0);
        horarioSugeridoTimestamp = dataCompleta.toISOString();
      }
      
      const tempoServico = formData.tempo_estimado.trim() 
        ? `${formData.tempo_estimado.trim()} ${formData.unidade_tempo}`
        : null;

      const orcamentoData = {
        ficha_nome: fichaId,
        prestador_cpf: cpfLimpo,
        categoria: formData.categoria,
        valor_mao_obra: valorMaoObra,
        valor_pecas: valorPecas,
        valor_total: valorTotal,
        tempo_servico: tempoServico,
        observacoes: formData.observacoes,
        status: "pendente" as const,
        pode_horario: formData.pode_horario === "sim",
        horario_sugerido: horarioSugeridoTimestamp,
      };

      console.log("OrcamentoPublico - Dados a enviar:", orcamentoData);

      // Salvar no banco - usando insert simples sem .single() para maior resiliência em mobile
      const { data: insertResult, error } = await supabase.functions.invoke("public-orcamento-data", {
        body: { action: "inserir-orcamento", orcamento: orcamentoData },
      });

      if (error || !insertResult?.success) {
        console.error("OrcamentoPublico - Erro ao inserir:", error || insertResult?.error);
        throw new Error(insertResult?.error || "Erro ao salvar orçamento");
      }

      // Orçamento salvo com sucesso - mostrar confirmação independente do webhook
      console.log("OrcamentoPublico - Orçamento salvo com sucesso");

      // Formatar data de forma segura para o webhook
      let dataSugeridaFormatada = null;
      if (dataSugerida && !isNaN(dataSugerida.getTime())) {
        try {
          dataSugeridaFormatada = format(dataSugerida, "yyyy-MM-dd");
        } catch (formatError) {
          console.error("OrcamentoPublico - Erro ao formatar data:", formatError);
        }
      }

      // Tentar enviar webhook (mas não falhar se der erro)
      try {
        await supabase.functions.invoke("submit-orcamento", {
          body: {
            ...orcamentoData,
            prestador_nome: nomePrestador,
            pode_horario: formData.pode_horario,
            data_sugerida: dataSugeridaFormatada,
            horario_sugerido: formData.horario_sugerido || null,
            porcentagem_desconto: formData.porcentagem_desconto,
          },
        });
      } catch (webhookError) {
        console.error("OrcamentoPublico - Erro no webhook (orçamento já foi salvo):", webhookError);
      }

      toast.success("Orçamento enviado!", {
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
    } catch (error: any) {
      console.error("Erro ao enviar orçamento:", error);
      const detalhe = error?.message || error?.code || "Erro de conexão. Verifique sua internet e tente novamente.";
      toast.error("Erro ao enviar orçamento", {
        description: detalhe,
      });
    } finally {
      setLoading(false);
    }
  };

  // Estado de verificação da URL e loading inicial
  if (verificandoUrl || carregandoInicial) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Carregando formulário...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!fichaId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-muted-foreground font-medium">Link inválido</p>
            <p className="text-xs text-muted-foreground">
              O parâmetro da ficha não foi encontrado na URL.
            </p>
            <p className="text-xs text-muted-foreground break-all bg-muted/50 p-2 rounded">
              URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">
              Por favor, use o link completo fornecido pela 24Help.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ficha não encontrada no banco de dados
  if (!fichaExists) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-muted-foreground font-medium">Ficha não encontrada</p>
            <p className="text-xs text-muted-foreground">
              A ficha "{fichaId}" não foi encontrada no sistema.
            </p>
            <p className="text-xs text-muted-foreground">
              Verifique se o link está correto ou entre em contato com a 24Help.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (fichaExists && !formularioAtivo) {
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4 py-8">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-4 space-y-3">
          <div className="flex items-center justify-center">
            <img src={logo} alt="24Help" className="h-12 w-auto" />
          </div>
          
          <div className="space-y-3 p-4 border-2 border-primary/20 rounded-lg bg-primary/5 animate-fade-in">
            <CardTitle className="text-lg font-bold text-primary">
              {fichaExists ? (fichaData?.nome_ficha || `Ficha #${fichaData?.id}`) : fichaId}
            </CardTitle>
            {fichaExists && fichaData?.descricao && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {fichaData.descricao}
              </p>
            )}
            
            {fichaExists && fichaData && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-10 text-sm border-2 border-primary/30 bg-background hover:bg-primary hover:text-primary-foreground transition-all hover-scale"
                  >
                    <Info className="mr-2 h-4 w-4" />
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
                          {formatarDataSegura(fichaData.horario_agendamento, "dd/MM/yyyy 'às' HH:mm")}
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
            )}
          </div>
          
          <p className="text-xs text-muted-foreground">
            Preencha os dados para enviar o orçamento
          </p>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 pb-8">
          <form onSubmit={handleSubmit} className="space-y-5 mb-6">
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
              <Label htmlFor="categoria" className="text-base touch-action-manipulation">
                Categoria do Serviço
                {!fichaExists && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                required={!fichaExists}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent 
                  position="popper" 
                  side="bottom"
                  align="start"
                  className="z-50 max-h-[300px] bg-background"
                  sideOffset={4}
                >
                  {categorias.map((cat) => (
                    <SelectItem 
                      key={cat.id} 
                      value={cat.nome}
                      className="min-h-[44px] cursor-pointer text-base"
                    >
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
                  className="h-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-xs text-muted-foreground">(opcional)</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base touch-action-manipulation">Pode no horário solicitado pelo cliente?</Label>
              
              {fichaData?.preferencia_horario_cliente && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    📅 Preferência do cliente: {fichaData.preferencia_horario_cliente}
                  </p>
                </div>
              )}
              
              <RadioGroup
                value={formData.pode_horario}
                onValueChange={(value) => setFormData({ ...formData, pode_horario: value })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2 min-h-[44px] cursor-pointer">
                  <RadioGroupItem value="sim" id="sim" className="h-5 w-5" />
                  <Label htmlFor="sim" className="cursor-pointer font-normal text-base hover:text-primary transition-colors">Sim</Label>
                </div>
                <div className="flex items-center space-x-2 min-h-[44px] cursor-pointer">
                  <RadioGroupItem value="nao" id="nao" className="h-5 w-5" />
                  <Label htmlFor="nao" className="cursor-pointer font-normal text-base hover:text-primary transition-colors">Não</Label>
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
                          {dataSugerida && !isNaN(dataSugerida.getTime()) ? format(dataSugerida, "dd/MM/yyyy") : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dataSugerida}
                          onSelect={(date) => {
                            // Validar data antes de setar para evitar crash em mobile
                            if (date && !isNaN(date.getTime())) {
                              setDataSugerida(date);
                            }
                          }}
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
                <SelectContent 
                  position="popper" 
                  side="bottom"
                  className="z-50 bg-background"
                  sideOffset={4}
                >
                  <SelectItem value="Horas" className="min-h-[44px] cursor-pointer text-base">Horas</SelectItem>
                  <SelectItem value="Dias" className="min-h-[44px] cursor-pointer text-base">Dias</SelectItem>
                  <SelectItem value="Semanas" className="min-h-[44px] cursor-pointer text-base">Semanas</SelectItem>
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
              className="w-full h-14 text-base mt-8"
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

// Exportar componente envolvido em ErrorBoundary
const OrcamentoPublicoComErrorBoundary = () => (
  <ErrorBoundary fallbackMessage="Ocorreu um erro ao carregar o formulário de orçamento. Por favor, tente novamente.">
    <OrcamentoPublico />
  </ErrorBoundary>
);

export default OrcamentoPublicoComErrorBoundary;
