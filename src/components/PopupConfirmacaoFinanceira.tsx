import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calculator, AlertTriangle, CheckCircle2, Search, ExternalLink, Loader2 } from "lucide-react";
import { isBusinessDay } from "@/lib/businessDays2026";

interface PopupConfirmacaoFinanceiraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fichaId: string;
  onConfirm: () => void;
}

// Arredonda para o próximo inteiro que termina em 8
function arredondarPara8(valor: number): number {
  if (valor <= 0) return 0;
  const inteiro = Math.ceil(valor);
  const ultimoDigito = inteiro % 10;
  if (ultimoDigito === 8) return inteiro;
  if (ultimoDigito === 9) return inteiro + 9;
  return inteiro + (8 - ultimoDigito);
}

// Calcula 2 dias úteis à frente a partir de uma data base
function calcularDataPagamento(dataBase?: Date | string): string {
  const data = dataBase ? new Date(dataBase) : new Date();
  let diasAdicionados = 0;
  while (diasAdicionados < 2) {
    data.setDate(data.getDate() + 1);
    if (isBusinessDay(data)) {
      diasAdicionados++;
    }
  }
  return data.toISOString();
}

const formatMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

export function PopupConfirmacaoFinanceira({
  open,
  onOpenChange,
  fichaId,
  onConfirm,
}: PopupConfirmacaoFinanceiraProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pesquisando, setPesquisando] = useState(false);

  // Dados da ficha
  const [ficha, setFicha] = useState<any>(null);
  const [prestador, setPrestador] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [categoriaNome, setCategoriaNome] = useState<string>("");

  // Valores do serviço
  const [valorMaoObra, setValorMaoObra] = useState("0");
  const [valorMaterial, setValorMaterial] = useState("0");
  const [taxaVisita, setTaxaVisita] = useState("0");
  const [adiantamentoCliente, setAdiantamentoCliente] = useState("0");
  const [adiantamentoPrestador, setAdiantamentoPrestador] = useState("0");
  const [materialPago24help, setMaterialPago24help] = useState(false);

  // Cálculos
  const [margemPercentual, setMargemPercentual] = useState(23);
  const [valorCalculado, setValorCalculado] = useState(0);
  const [valorFinal, setValorFinal] = useState(0);
  const [lucroBruto, setLucroBruto] = useState(0);
  const [margemReal, setMargemReal] = useState(0);
  const [valorPagarPrestador, setValorPagarPrestador] = useState(0);

  // Adiantamentos e ajustes
  const [temAdiantamento, setTemAdiantamento] = useState(false);
  const [adiantamentos, setAdiantamentos] = useState<any[]>([]);
  const [totalAdiantamentos, setTotalAdiantamentos] = useState(0);

  // Saldo conta corrente
  const [saldoContaCorrente, setSaldoContaCorrente] = useState(0);

  // Pagamento
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Pesquisa de fichas
  const [mostrarPesquisa, setMostrarPesquisa] = useState(false);
  const [termoPesquisa, setTermoPesquisa] = useState("");
  const [fichasPesquisa, setFichasPesquisa] = useState<any[]>([]);

  // Carregar dados da ficha
  useEffect(() => {
    if (open && fichaId) {
      carregarDadosFicha();
    }
    // Reset state when closed
    if (!open) {
      setFicha(null);
      setPrestador(null);
      setCliente(null);
      setCategoriaNome("");
      setValorMaoObra("0");
      setValorMaterial("0");
      setTaxaVisita("0");
      setAdiantamentoCliente("0");
      setAdiantamentoPrestador("0");
      setMaterialPago24help(false);
      setMargemPercentual(23);
      setTemAdiantamento(false);
      setAdiantamentos([]);
      setTotalAdiantamentos(0);
      setSaldoContaCorrente(0);
      setFormaPagamento("");
      setObservacoes("");
      setMostrarPesquisa(false);
      setTermoPesquisa("");
      setFichasPesquisa([]);
    }
  }, [open, fichaId]);

  // Recalcular quando valores mudam
  const calcularValores = useCallback(() => {
    const maoObra = parseFloat(valorMaoObra) || 0;
    const material = parseFloat(valorMaterial) || 0;
    const visita = parseFloat(taxaVisita) || 0;
    const subtotal = maoObra + material + visita;
    const adCliente = parseFloat(adiantamentoCliente) || 0;
    const adPrestador = parseFloat(adiantamentoPrestador) || 0;

    // Valor ao cliente (descontando adiantamento do cliente)
    const baseCliente = subtotal - adCliente;
    const margem = margemPercentual / 100;
    const calculado = margem < 1 ? baseCliente / (1 - margem) : baseCliente;
    const final_ = arredondarPara8(calculado);

    // Lucro e margem real
    const lucro = final_ - subtotal;
    const margemRealCalc = final_ > 0 ? (lucro / final_) * 100 : 0;

    // Valor ao prestador
    let valorPrestador = materialPago24help ? (maoObra + visita) : subtotal;
    valorPrestador = valorPrestador - totalAdiantamentos - adPrestador;

    setValorCalculado(calculado);
    setValorFinal(final_);
    setLucroBruto(lucro);
    setMargemReal(margemRealCalc);
    setValorPagarPrestador(Math.max(0, valorPrestador));
  }, [valorMaoObra, valorMaterial, taxaVisita, adiantamentoCliente, adiantamentoPrestador, margemPercentual, materialPago24help, totalAdiantamentos]);

  useEffect(() => {
    calcularValores();
  }, [calcularValores]);

  async function carregarDadosFicha() {
    try {
      setLoading(true);

      // Buscar ficha
      const { data: fichaData, error: fichaError } = await supabase
        .from("fichas_de_servico")
        .select("*")
        .eq("id", fichaId)
        .single();

      if (fichaError) throw fichaError;
      setFicha(fichaData);

      // Buscar prestador pelo CPF (prestador_id na ficha = cpf do prestador)
      if (fichaData.prestador_id) {
        const { data: prestadorData } = await supabase
          .from("prestadores")
          .select("*")
          .eq("cpf", fichaData.prestador_id)
          .single();

        if (prestadorData) setPrestador(prestadorData);
      }

      // Buscar dados do cliente
      const { data: clienteData } = await supabase
        .from("clientes")
        .select("nome, telefone")
        .eq("telefone", fichaData.telefone_cliente)
        .single();

      if (clienteData) setCliente(clienteData);

      // Buscar categoria
      if (fichaData.categoria_id) {
        const { data: catData } = await supabase
          .from("categorias")
          .select("nome")
          .eq("id", fichaData.categoria_id)
          .single();

        if (catData) setCategoriaNome(catData.nome);
      }

      // Preencher valores iniciais da ficha
      setValorMaoObra(fichaData.valor_mao_obra?.toString() || "0");
      setValorMaterial(fichaData.valor_pecas?.toString() || "0"); // valor_pecas = material

      // Buscar adiantamentos pendentes para este prestador/ficha
      const { data: adiantamentosData } = await (supabase
        .from("adiantamentos" as any)
        .select("*")
        .eq("prestador_id", fichaData.prestador_id || "")
        .eq("status", "pendente") as any);

      if (adiantamentosData && adiantamentosData.length > 0) {
        setAdiantamentos(adiantamentosData);
        const total = adiantamentosData.reduce((sum: number, a: any) => sum + parseFloat(a.valor || 0), 0);
        setTotalAdiantamentos(total);
        setTemAdiantamento(true);
      }

      // Buscar saldo conta corrente
      const { data: ccData } = await (supabase
        .from("conta_corrente_prestador" as any)
        .select("saldo_atual")
        .eq("prestador_id", fichaData.prestador_id || "")
        .order("created_at", { ascending: false })
        .limit(1) as any);

      if (ccData && ccData.length > 0) {
        setSaldoContaCorrente(parseFloat(ccData[0].saldo_atual || 0));
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function pesquisarFichas() {
    if (!termoPesquisa.trim()) {
      setFichasPesquisa([]);
      return;
    }

    try {
      setPesquisando(true);
      const { data, error } = await supabase
        .from("fichas_de_servico")
        .select("id, telefone_cliente, nome_cliente, status, created_at, categoria_id")
        .or(`id.ilike.%${termoPesquisa}%,telefone_cliente.ilike.%${termoPesquisa}%`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setFichasPesquisa(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao pesquisar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPesquisando(false);
    }
  }

  async function confirmarEEnviar() {
    try {
      setLoading(true);

      if (!formaPagamento) {
        toast({
          title: "Forma de pagamento obrigatória",
          description: "Selecione como o cliente pagou",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const subtotal = (parseFloat(valorMaoObra) || 0) + (parseFloat(valorMaterial) || 0) + (parseFloat(taxaVisita) || 0);

      // Buscar data real de finalização do histórico de status
      const { data: histFinalizado } = await supabase
        .from("ficha_status_historico")
        .select("data_inicio")
        .eq("ficha_id", fichaId)
        .eq("status_novo", "Finalizado" as any)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      const dataExecucao = histFinalizado?.data_inicio
        ? new Date(histFinalizado.data_inicio)
        : new Date();
      const dataPagPrevista = calcularDataPagamento(dataExecucao);

      // Obter user autenticado
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Criar transação financeira
      const transacaoData = {
        ficha_id: fichaId,
        prestador_id: ficha?.prestador_id || "",
        cliente_id: ficha?.telefone_cliente || "",
        prestador_nome: prestador?.nome || "N/A",
        prestador_codigo: prestador?.id_crm || null,
        prestador_cpf: prestador?.cpf || null,
        prestador_cnpj: prestador?.cnpj || null,
        cliente_nome: cliente?.nome || ficha?.nome_cliente || ficha?.telefone_cliente || "Cliente",
        data_contratacao: ficha?.horario_agendamento || null,
        data_execucao: dataExecucao.toISOString(),
        data_pagamento_prevista: dataPagPrevista,
        valor_mao_obra: parseFloat(valorMaoObra) || 0,
        valor_material: parseFloat(valorMaterial) || 0,
        taxa_visita: parseFloat(taxaVisita) || 0,
        adiantamento_cliente: parseFloat(adiantamentoCliente) || 0,
        adiantamento_prestador: parseFloat(adiantamentoPrestador) || 0,
        valor_subtotal: subtotal,
        margem_percentual: margemPercentual,
        valor_cliente_calculado: valorCalculado,
        valor_cliente_final: valorFinal,
        valor_lucro_bruto: lucroBruto,
        margem_operacional_real: margemReal,
        material_pago_24help: materialPago24help,
        valor_a_pagar_prestador: valorPagarPrestador,
        forma_pagamento_cliente: formaPagamento,
        categoria: categoriaNome || null,
        tem_adiantamento: temAdiantamento,
        observacoes: observacoes || null,
        criado_por: user?.id || null,
      };

      const { data: transacao, error: transacaoError } = await (supabase
        .from("transacoes_financeiras" as any)
        .insert(transacaoData)
        .select()
        .single() as any);

      if (transacaoError) throw transacaoError;

      // 2. Compensar adiantamentos pendentes
      if (temAdiantamento && adiantamentos.length > 0) {
        for (const adiantamento of adiantamentos) {
          await (supabase
            .from("adiantamentos" as any)
            .update({
              status: "compensado",
              compensado_em: new Date().toISOString(),
              transacao_id: transacao.id,
            })
            .eq("id", adiantamento.id) as any);
        }
      }

      // 3. Registrar na conta corrente do prestador
      await (supabase.from("conta_corrente_prestador" as any).insert({
        prestador_id: ficha?.prestador_id || "",
        transacao_id: transacao.id,
        tipo: "credito",
        origem: "servico",
        valor: valorPagarPrestador,
        saldo_anterior: saldoContaCorrente,
        saldo_atual: saldoContaCorrente + valorPagarPrestador,
        descricao: `Pagamento serviço ${fichaId}`,
        data_movimentacao: new Date().toISOString(),
        criado_por: user?.id || null,
      }) as any);

      // 4. Enviar webhook via edge function
      const webhookPayload = {
        transacao_id: transacao.id,
        ficha_id: fichaId,
        id_servico: fichaId,
        prestador: {
          id: prestador?.cpf,
          nome: prestador?.nome,
          codigo: prestador?.id_crm,
          cpf: prestador?.cpf,
          cnpj: prestador?.cnpj,
        },
        cliente: {
          nome: cliente?.nome || ficha?.nome_cliente || ficha?.telefone_cliente,
          telefone: ficha?.telefone_cliente,
        },
        valores: {
          mao_obra: parseFloat(valorMaoObra) || 0,
          material: parseFloat(valorMaterial) || 0,
          taxa_visita: parseFloat(taxaVisita) || 0,
          adiantamento_cliente: parseFloat(adiantamentoCliente) || 0,
          adiantamento_prestador: parseFloat(adiantamentoPrestador) || 0,
          subtotal: subtotal,
          total_cliente: valorFinal,
          lucro_bruto: lucroBruto,
          margem_percentual: margemReal,
          valor_prestador: valorPagarPrestador,
        },
        datas: {
          contratacao: ficha?.horario_agendamento,
          execucao: new Date().toISOString(),
          pagamento_previsto: dataPagPrevista,
        },
        forma_pagamento: formaPagamento,
        categoria: categoriaNome,
        observacoes: observacoes,
      };

      try {
        await supabase.functions.invoke("webhook-financeiro", {
          body: webhookPayload,
        });
      } catch (webhookError) {
        console.error("Webhook error (não bloqueante):", webhookError);
      }

      toast({
        title: "✅ Transação criada com sucesso!",
        description: `Valor cliente: ${formatMoeda(valorFinal)} | Valor prestador: ${formatMoeda(valorPagarPrestador)}`,
      });

      onConfirm();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao criar transação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const subtotal = (parseFloat(valorMaoObra) || 0) + (parseFloat(valorMaterial) || 0) + (parseFloat(taxaVisita) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Confirmação Financeira
          </DialogTitle>
          <DialogDescription>
            Revise os valores antes de enviar para o financeiro
          </DialogDescription>
        </DialogHeader>

        {loading && !ficha ? (
          <div className="py-8 text-center flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando dados...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cabeçalho com info da ficha */}
            <Card className="p-4 bg-muted">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="font-semibold text-muted-foreground">ID Serviço:</span>
                  <div className="font-bold">{fichaId}</div>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Prestador:</span>
                  <div className="font-bold">{prestador?.nome || "N/A"}</div>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Código:</span>
                  <div>{prestador?.id_crm || "N/A"}</div>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">CPF:</span>
                  <div>{prestador?.cpf || "N/A"}</div>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">CNPJ:</span>
                  <div>{prestador?.cnpj || "N/A"}</div>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Cliente:</span>
                  <div>{cliente?.nome || ficha?.nome_cliente || ficha?.telefone_cliente}</div>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Telefone:</span>
                  <div>{ficha?.telefone_cliente}</div>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Categoria:</span>
                  <div>{categoriaNome || "N/A"}</div>
                </div>
              </div>
            </Card>

            {/* Botão de pesquisa */}
            <Button
              variant="outline"
              onClick={() => setMostrarPesquisa(!mostrarPesquisa)}
              className="w-full"
            >
              <Search className="h-4 w-4 mr-2" />
              {mostrarPesquisa ? "Ocultar Pesquisa" : "Pesquisar Outras Fichas"}
            </Button>

            {/* Pesquisa de fichas inline */}
            {mostrarPesquisa && (
              <Card className="p-4 space-y-3 border-dashed">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite ID ou telefone..."
                    value={termoPesquisa}
                    onChange={(e) => setTermoPesquisa(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && pesquisarFichas()}
                  />
                  <Button onClick={pesquisarFichas} disabled={pesquisando} size="sm">
                    {pesquisando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                  </Button>
                </div>
                {fichasPesquisa.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {fichasPesquisa.map((f) => (
                      <div
                        key={f.id}
                        className="p-2 border rounded cursor-pointer hover:bg-muted flex items-center justify-between"
                        onClick={() => window.open(`/fichas?id=${f.id}`, "_blank")}
                      >
                        <div>
                          <div className="font-semibold text-sm">{f.id}</div>
                          <div className="text-xs text-muted-foreground">
                            {f.nome_cliente || f.telefone_cliente} - {f.status}
                          </div>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Valores do serviço */}
            <div>
              <h3 className="font-semibold mb-3">Valores do Serviço</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maoObra">Mão de Obra (R$)</Label>
                  <Input
                    id="maoObra"
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorMaoObra}
                    onChange={(e) => setValorMaoObra(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="material">Material (R$)</Label>
                  <Input
                    id="material"
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorMaterial}
                    onChange={(e) => setValorMaterial(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxaVisita">Taxa de Visita (R$)</Label>
                  <Input
                    id="taxaVisita"
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxaVisita}
                    onChange={(e) => setTaxaVisita(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adiantamentoCliente">Adiantamento Cliente (R$)</Label>
                  <Input
                    id="adiantamentoCliente"
                    type="number"
                    step="0.01"
                    min="0"
                    value={adiantamentoCliente}
                    onChange={(e) => setAdiantamentoCliente(e.target.value)}
                    placeholder="Valor já pago pelo cliente"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adiantamentoPrestador">Adiantamento Prestador (R$)</Label>
                  <Input
                    id="adiantamentoPrestador"
                    type="number"
                    step="0.01"
                    min="0"
                    value={adiantamentoPrestador}
                    onChange={(e) => setAdiantamentoPrestador(e.target.value)}
                    placeholder="Valor já pago ao prestador"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="margem">Margem 24help (%)</Label>
                  <Input
                    id="margem"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={margemPercentual}
                    onChange={(e) => setMargemPercentual(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* Checkbox material */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="materialPago"
                checked={materialPago24help}
                onCheckedChange={(checked) => setMaterialPago24help(!!checked)}
              />
              <Label htmlFor="materialPago" className="cursor-pointer">
                24help pagou o material (prestador recebe só mão de obra + taxa visita)
              </Label>
            </div>

            <Separator />

            {/* Cálculos automáticos */}
            <Card className="p-4 space-y-3 border-2 border-primary/20 bg-primary/5">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Cálculos Automáticos
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Mão de Obra:</span>
                  <div className="font-semibold">{formatMoeda(parseFloat(valorMaoObra) || 0)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Material:</span>
                  <div className="font-semibold">{formatMoeda(parseFloat(valorMaterial) || 0)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Taxa Visita:</span>
                  <div className="font-semibold">{formatMoeda(parseFloat(taxaVisita) || 0)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Subtotal:</span>
                  <div className="font-bold">{formatMoeda(subtotal)}</div>
                </div>

                {(parseFloat(adiantamentoCliente) || 0) > 0 && (
                  <div>
                    <span className="text-muted-foreground">Adiantamento Cliente:</span>
                    <div className="font-semibold text-orange-600">
                      -{formatMoeda(parseFloat(adiantamentoCliente) || 0)}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-muted-foreground">Valor Calculado:</span>
                  <div className="font-semibold">{formatMoeda(valorCalculado)}</div>
                </div>

                <div className="col-span-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <span className="text-muted-foreground text-xs">Valor Final Cliente (arredondado):</span>
                  <div className="font-bold text-2xl text-green-700 dark:text-green-400">
                    {formatMoeda(valorFinal)}
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground">Lucro Bruto 24help:</span>
                  <div className="font-semibold">{formatMoeda(lucroBruto)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Margem Real:</span>
                  <div className="font-semibold">{margemReal.toFixed(2)}%</div>
                </div>

                {(parseFloat(adiantamentoPrestador) || 0) > 0 && (
                  <div>
                    <span className="text-muted-foreground">Adiantamento Prestador:</span>
                    <div className="font-semibold text-destructive">
                      -{formatMoeda(parseFloat(adiantamentoPrestador) || 0)}
                    </div>
                  </div>
                )}

                <div className="col-span-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <span className="text-muted-foreground text-xs">Valor a Pagar Prestador:</span>
                  <div className="font-bold text-2xl text-blue-700 dark:text-blue-400">
                    {formatMoeda(valorPagarPrestador)}
                  </div>
                </div>
              </div>
            </Card>

            {/* Adiantamentos pendentes */}
            {temAdiantamento && adiantamentos.length > 0 && (
              <Card className="p-4 space-y-2 border-2 border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30">
                <h3 className="font-semibold flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
                  <AlertTriangle className="h-4 w-4" />
                  Adiantamentos Pendentes (serão compensados)
                </h3>
                {adiantamentos.map((ad: any) => (
                  <div key={ad.id} className="flex justify-between text-sm">
                    <span>{new Date(ad.data_adiantamento).toLocaleDateString("pt-BR")}</span>
                    <span className="font-semibold">{formatMoeda(parseFloat(ad.valor))}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total Descontado:</span>
                  <span className="text-destructive">{formatMoeda(totalAdiantamentos)}</span>
                </div>
              </Card>
            )}

            {/* Saldo Conta Corrente */}
            {saldoContaCorrente !== 0 && (
              <Card className="p-3 border-2 border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/30">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Saldo Conta Corrente Prestador:</span>
                  <Badge variant={saldoContaCorrente > 0 ? "default" : "destructive"}>
                    {formatMoeda(saldoContaCorrente)}
                  </Badge>
                </div>
              </Card>
            )}

            {/* Forma de pagamento */}
            <div className="space-y-2">
              <Label htmlFor="formaPagamento">Forma de Pagamento Cliente *</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Adicione observações se necessário..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={confirmarEEnviar} disabled={loading || !formaPagamento || !ficha}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              "Confirmar e Enviar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
