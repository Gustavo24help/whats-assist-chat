import { useState, useEffect } from "react";
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
import { Calculator, AlertTriangle, CheckCircle2, Search } from "lucide-react";

interface PopupConfirmacaoFinanceiraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fichaId: string;
  onConfirm: () => void;
}

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
  }, [open, fichaId]);

  // Recalcular quando valores mudam
  useEffect(() => {
    calcularValores();
  }, [valorMaoObra, valorMaterial, taxaVisita, adiantamentoCliente, adiantamentoPrestador, margemPercentual, materialPago24help, totalAdiantamentos]);

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

      // Buscar prestador
      const { data: prestadorData, error: prestadorError } = await supabase
        .from("prestadores")
        .select("*")
        .eq("id", fichaData.prestador_responsavel_id)
        .single();

      if (prestadorError) throw prestadorError;
      setPrestador(prestadorData);

      // Buscar dados do cliente
      const { data: clienteData } = await supabase
        .from("clientes")
        .select("nome")
        .eq("telefone", fichaData.telefone_cliente)
        .single();

      if (clienteData) {
        setCliente(clienteData);
      }

      // Preencher valores iniciais
      setValorMaoObra(fichaData.valor_mao_obra?.toString() || "0");
      setValorMaterial(fichaData.valor_material?.toString() || "0");
      setTaxaVisita(fichaData.taxa_visita?.toString() || "0");

      // Buscar adiantamentos
      const { data: adiantamentosData } = await supabase
        .from("adiantamentos")
        .select("*")
        .eq("ficha_id", fichaId)
        .eq("status", "pendente");

      if (adiantamentosData && adiantamentosData.length > 0) {
        setAdiantamentos(adiantamentosData);
        const total = adiantamentosData.reduce((sum, a) => sum + parseFloat(a.valor), 0);
        setTotalAdiantamentos(total);
        setTemAdiantamento(true);
      }

      // Buscar saldo conta corrente
      const { data: saldoData } = await supabase
        .from("saldo_prestadores")
        .select("saldo_atual")
        .eq("prestador_id", fichaData.prestador_responsavel_id)
        .single();

      if (saldoData) {
        setSaldoContaCorrente(parseFloat(saldoData.saldo_atual));
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

  function calcularValores() {
    const maoObra = parseFloat(valorMaoObra) || 0;
    const material = parseFloat(valorMaterial) || 0;
    const visita = parseFloat(taxaVisita) || 0;
    const subtotal = maoObra + material + visita;
    
    // Calcular valor para cliente (menos adiantamento do cliente)
    const calculado = (subtotal - parseFloat(adiantamentoCliente || "0")) / (1 - margemPercentual / 100);
    const final = arredondarPara8(calculado);
    
    // Calcular lucro e margem real
    const lucro = final - subtotal;
    const margemRealCalc = final > 0 ? (lucro / final) * 100 : 0;
    
    // Calcular valor a pagar ao prestador
    let valorPrestador = materialPago24help ? (maoObra + visita) : subtotal;
    valorPrestador = valorPrestador - totalAdiantamentos - parseFloat(adiantamentoPrestador || "0");
    
    setValorCalculado(calculado);
    setValorFinal(final);
    setLucroBruto(lucro);
    setMargemReal(margemRealCalc);
    setValorPagarPrestador(Math.max(0, valorPrestador)); // Não pode ser negativo
  }

  function arredondarPara8(valor: number): number {
    const inteiro = Math.ceil(valor);
    const ultimoDigito = inteiro % 10;
    
    if (ultimoDigito === 8) return inteiro;
    if (ultimoDigito === 9) return inteiro + 9;
    return inteiro + (8 - ultimoDigito);
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
        .select("id, telefone_cliente, servico_categoria, status, created_at")
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

      // Validações
      if (!formaPagamento) {
        toast({
          title: "Forma de pagamento obrigatória",
          description: "Selecione como o cliente pagou",
          variant: "destructive",
        });
        return;
      }

      // Criar transação financeira
      const { data: transacao, error: transacaoError } = await supabase
        .from("transacoes_financeiras")
        .insert({
          ficha_id: fichaId,
          prestador_id: ficha.prestador_responsavel_id,
          cliente_id: ficha.telefone_cliente,
          prestador_nome: prestador.nome,
          prestador_codigo: prestador.codigo,
          prestador_cpf: prestador.cpf,
          prestador_cnpj: prestador.cnpj,
          cliente_nome: cliente?.nome || ficha.telefone_cliente,
          data_contratacao: ficha.data_agendamento,
          data_execucao: new Date().toISOString(),
          data_pagamento_prevista: calcularDataPagamento(),
          valor_mao_obra: parseFloat(valorMaoObra),
          valor_material: parseFloat(valorMaterial),
          taxa_visita: parseFloat(taxaVisita),
          adiantamento_cliente: parseFloat(adiantamentoCliente),
          adiantamento_prestador: parseFloat(adiantamentoPrestador),
          margem_percentual: margemPercentual,
          valor_cliente_calculado: valorCalculado,
          valor_cliente_final: valorFinal,
          material_pago_24help: materialPago24help,
          valor_a_pagar_prestador: valorPagarPrestador,
          forma_pagamento_cliente: formaPagamento,
          pix_prestador: prestador.pix,
          banco_prestador: prestador.banco,
          agencia_prestador: prestador.agencia,
          conta_prestador: prestador.conta,
          categoria: ficha.servico_categoria,
          tem_adiantamento: temAdiantamento,
          observacoes: observacoes,
        })
        .select()
        .single();

      if (transacaoError) throw transacaoError;

      // Compensar adiantamentos
      if (temAdiantamento && adiantamentos.length > 0) {
        for (const adiantamento of adiantamentos) {
          await supabase
            .from("adiantamentos")
            .update({
              status: "compensado",
              compensado_em: new Date().toISOString(),
              transacao_id: transacao.id,
            })
            .eq("id", adiantamento.id);
        }
      }

      // Registrar na conta corrente do prestador
      await supabase.from("conta_corrente_prestador").insert({
        prestador_id: ficha.prestador_responsavel_id,
        transacao_id: transacao.id,
        tipo: "credito",
        origem: "servico",
        valor: valorPagarPrestador,
        saldo_anterior: saldoContaCorrente,
        saldo_atual: saldoContaCorrente + valorPagarPrestador,
        descricao: `Pagamento serviço ${fichaId}`,
        data_movimentacao: new Date().toISOString(),
      });

      // Disparar integração Make.com (webhook)
      await fetch(process.env.NEXT_PUBLIC_MAKE_WEBHOOK_FINANCEIRO!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transacao_id: transacao.id,
          ficha_id: fichaId,
          id_servico: fichaId,
          prestador: {
            id: prestador.id,
            nome: prestador.nome,
            codigo: prestador.codigo,
            cpf: prestador.cpf,
            cnpj: prestador.cnpj,
            pix: prestador.pix,
          },
          cliente: {
            nome: cliente?.nome || ficha.telefone_cliente,
            telefone: ficha.telefone_cliente,
          },
          valores: {
            mao_obra: parseFloat(valorMaoObra),
            material: parseFloat(valorMaterial),
            taxa_visita: parseFloat(taxaVisita),
            adiantamento_cliente: parseFloat(adiantamentoCliente),
            adiantamento_prestador: parseFloat(adiantamentoPrestador),
            subtotal: parseFloat(valorMaoObra) + parseFloat(valorMaterial) + parseFloat(taxaVisita),
            total_cliente: valorFinal,
            lucro_bruto: lucroBruto,
            margem_percentual: margemReal,
            valor_prestador: valorPagarPrestador,
          },
          datas: {
            contratacao: ficha.data_agendamento,
            execucao: new Date().toISOString(),
            pagamento_previsto: calcularDataPagamento(),
          },
          forma_pagamento: formaPagamento,
          categoria: ficha.servico_categoria,
          observacoes: observacoes,
        }),
      });

      toast({
        title: "Transação criada com sucesso!",
        description: "Dados enviados para o financeiro e Make.com",
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

  function calcularDataPagamento(): string {
    // 2 dias úteis após hoje
    let data = new Date();
    let diasAdicionados = 0;

    while (diasAdicionados < 2) {
      data.setDate(data.getDate() + 1);
      const diaSemana = data.getDay();
      if (diaSemana !== 0 && diaSemana !== 6) {
        diasAdicionados++;
      }
    }

    return data.toISOString();
  }

  const formatMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

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
          <div className="py-8 text-center">Carregando dados...</div>
        ) : (
          <div className="space-y-6">
            {/* Cabeçalho com info da ficha */}
            <Card className="p-4 bg-muted">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-semibold">ID Serviço:</span> {fichaId}
                </div>
                <div>
                  <span className="font-semibold">Prestador:</span> {prestador?.nome}
                </div>
                <div>
                  <span className="font-semibold">Código Prestador:</span> {prestador?.codigo || "N/A"}
                </div>
                <div>
                  <span className="font-semibold">CPF:</span> {prestador?.cpf || "N/A"}
                </div>
                <div>
                  <span className="font-semibold">CNPJ:</span> {prestador?.cnpj || "N/A"}
                </div>
                <div>
                  <span className="font-semibold">Cliente:</span> {cliente?.nome || ficha?.telefone_cliente}
                </div>
                <div>
                  <span className="font-semibold">Telefone:</span> {ficha?.telefone_cliente}
                </div>
                <div>
                  <span className="font-semibold">Categoria:</span> {ficha?.servico_categoria}
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

            {/* Pesquisa de fichas */}
            {mostrarPesquisa && (
              <Card className="p-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite ID ou telefone..."
                    value={termoPesquisa}
                    onChange={(e) => setTermoPesquisa(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && pesquisarFichas()}
                  />
                  <Button onClick={pesquisarFichas} disabled={pesquisando}>
                    Buscar
                  </Button>
                </div>
                {fichasPesquisa.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {fichasPesquisa.map((f) => (
                      <div
                        key={f.id}
                        className="p-2 border rounded cursor-pointer hover:bg-muted"
                        onClick={() => window.open(`/fichas/${f.id}`, "_blank")}
                      >
                        <div className="font-semibold">{f.id}</div>
                        <div className="text-sm text-muted-foreground">
                          {f.telefone_cliente} - {f.servico_categoria}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Valores do serviço */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maoObra">Mão de Obra (R$)</Label>
                <Input
                  id="maoObra"
                  type="number"
                  step="0.01"
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
                  value={adiantamentoPrestador}
                  onChange={(e) => setAdiantamentoPrestador(e.target.value)}
                  placeholder="Valor já pago ao prestador"
                />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="materialPago"
                checked={materialPago24help}
                onCheckedChange={(checked) => setMaterialPago24help(!!checked)}
              />
              <Label htmlFor="materialPago" className="cursor-pointer">
                24help pagou o material (valor a pagar = só mão de obra)
              </Label>
            </div>

            {/* Margem */}
            <div className="space-y-2">
              <Label htmlFor="margem">Margem 24help (%)</Label>
              <Input
                id="margem"
                type="number"
                step="0.01"
                value={margemPercentual}
                onChange={(e) => setMargemPercentual(parseFloat(e.target.value))}
              />
            </div>

            <Separator />

            {/* Cálculos automáticos */}
            <Card className="p-4 space-y-3 bg-blue-50 dark:bg-blue-950">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Cálculos Automáticos
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Mão de Obra:</span>
                  <div className="font-semibold">{formatMoeda(parseFloat(valorMaoObra))}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Material:</span>
                  <div className="font-semibold">{formatMoeda(parseFloat(valorMaterial))}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Taxa Visita:</span>
                  <div className="font-semibold">{formatMoeda(parseFloat(taxaVisita))}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Subtotal:</span>
                  <div className="font-semibold">
                    {formatMoeda(parseFloat(valorMaoObra) + parseFloat(valorMaterial) + parseFloat(taxaVisita))}
                  </div>
                </div>
                {parseFloat(adiantamentoCliente) > 0 && (
                  <div>
                    <span className="text-muted-foreground">Adiantamento Cliente:</span>
                    <div className="font-semibold text-orange-600">
                      -{formatMoeda(parseFloat(adiantamentoCliente))}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Valor Calculado:</span>
                  <div className="font-semibold">{formatMoeda(valorCalculado)}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Valor Final Cliente (arredondado):</span>
                  <div className="font-bold text-xl text-green-600">
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
                {parseFloat(adiantamentoPrestador) > 0 && (
                  <div>
                    <span className="text-muted-foreground">Adiantamento Prestador:</span>
                    <div className="font-semibold text-red-600">
                      -{formatMoeda(parseFloat(adiantamentoPrestador))}
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-muted-foreground">Valor a Pagar Prestador:</span>
                  <div className="font-bold text-xl text-blue-600">
                    {formatMoeda(valorPagarPrestador)}
                  </div>
                </div>
              </div>
            </Card>

            {/* Adiantamentos */}
            {temAdiantamento && (
              <Card className="p-4 space-y-2 bg-yellow-50 dark:bg-yellow-950">
                <h3 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Adiantamentos Pendentes
                </h3>
                {adiantamentos.map((ad) => (
                  <div key={ad.id} className="flex justify-between text-sm">
                    <span>{new Date(ad.data_adiantamento).toLocaleDateString("pt-BR")}</span>
                    <span className="font-semibold">{formatMoeda(ad.valor)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total Descontado:</span>
                  <span className="text-red-600">{formatMoeda(totalAdiantamentos)}</span>
                </div>
              </Card>
            )}

            {/* Saldo Conta Corrente */}
            {saldoContaCorrente !== 0 && (
              <Card className="p-3 bg-purple-50 dark:bg-purple-950">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Saldo Conta Corrente:</span>
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
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={confirmarEEnviar} disabled={loading || !formaPagamento}>
            {loading ? "Enviando..." : "Confirmar e Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
