import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, Download, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  PropostaDados, PropostaItem,
  calcSubtotal, calcTotalFinal8, formatBRL,
  gerarPropostaPDF, enviarPropostaWhatsApp,
} from "@/lib/proposta";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fichaId: string;
  telefoneCliente: string;
  clienteNome?: string;
}

export default function PropostaComercialModal({ open, onOpenChange, fichaId, telefoneCliente, clienteNome }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "baixar" | "enviar">(null);

  const [dados, setDados] = useState<PropostaDados>({
    cliente: { nome: clienteNome || "", cpf: "", telefone: telefoneCliente, endereco: "" },
    itens: [{ descricao: "Serviço técnico", quantidade: 1, valor_unitario: 0 }],
    desconto: 0,
    total: 0,
    prazo: "",
    garantia: "90 dias para serviços executados",
    validade_dias: 7,
    pagamento: "À vista no PIX ou cartão em até 10x",
    observacoes: "",
  });
  const [totalManual, setTotalManual] = useState(false);

  // Pré-preenche da ficha + cliente
  useEffect(() => {
    if (!open || !fichaId) return;
    let canceled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: ficha } = await supabase
          .from("fichas_de_servico")
          .select("nome_cliente, cpf, endereco, valor_total, valor_mao_obra, descricao, data_agendamento, horario_agendamento")
          .eq("id", fichaId)
          .maybeSingle();

        if (canceled) return;
        const f: any = ficha || {};
        const itens: PropostaItem[] = [];
        const valorMaoObra = Number(f.valor_mao_obra) || 0;
        const valorTotal = Number(f.valor_total) || 0;
        if (valorMaoObra > 0) {
          itens.push({ descricao: f.descricao || "Mão de obra", quantidade: 1, valor_unitario: valorMaoObra });
        } else if (valorTotal > 0) {
          itens.push({ descricao: f.descricao || "Serviço técnico", quantidade: 1, valor_unitario: valorTotal * 0.77 });
        } else {
          itens.push({ descricao: f.descricao || "Serviço técnico", quantidade: 1, valor_unitario: 0 });
        }

        const prazo = f.data_agendamento
          ? `Atendimento agendado para ${new Date(f.data_agendamento + "T00:00:00").toLocaleDateString("pt-BR")}${f.horario_agendamento ? ` às ${f.horario_agendamento}` : ""}`
          : "";

        setDados((d) => ({
          ...d,
          cliente: {
            nome: f.nome_cliente || clienteNome || "",
            cpf: f.cpf || "",
            telefone: telefoneCliente,
            endereco: f.endereco || "",
          },
          itens,
          prazo,
        }));
      } catch (e) {
        console.error("[PropostaModal] erro carregando ficha", e);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [open, fichaId, telefoneCliente, clienteNome]);

  const subtotal = useMemo(() => calcSubtotal(dados.itens), [dados.itens]);
  const totalCalc = useMemo(() => calcTotalFinal8(subtotal, dados.desconto || 0), [subtotal, dados.desconto]);
  const totalFinal = totalManual ? dados.total : totalCalc;

  useEffect(() => {
    if (!totalManual) setDados((d) => ({ ...d, total: totalCalc }));
  }, [totalCalc, totalManual]);

  const updateItem = (idx: number, patch: Partial<PropostaItem>) => {
    setDados((d) => ({ ...d, itens: d.itens.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  };
  const addItem = () => setDados((d) => ({ ...d, itens: [...d.itens, { descricao: "", quantidade: 1, valor_unitario: 0 }] }));
  const removeItem = (idx: number) => setDados((d) => ({ ...d, itens: d.itens.filter((_, i) => i !== idx) }));

  const handleGerar = async (modo: "baixar" | "enviar") => {
    setBusy(modo);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const criadoPorNome = user?.user_metadata?.full_name || user?.email || "Operador";
      const payload = { ficha_id: fichaId, dados: { ...dados, total: totalFinal }, criado_por: user?.id, criado_por_nome: criadoPorNome };
      const res = await gerarPropostaPDF(payload);
      toast({ title: `Proposta ${res.numero} gerada`, description: `v${res.versao}` });
      if (modo === "baixar") {
        window.open(res.pdf_url, "_blank");
      } else {
        await enviarPropostaWhatsApp({ proposta_id: res.id, telefone_cliente: telefoneCliente });
        toast({ title: "Enviada no WhatsApp", description: "PDF anexado à conversa do cliente" });
      }
      onOpenChange(false);
    } catch (e: any) {
      console.error("[PropostaModal] gerar erro:", e);
      toast({ title: "Erro ao gerar proposta", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Proposta Comercial</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-5">
            {/* Cliente */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-green-700">DADOS DO CLIENTE</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={dados.cliente.nome} onChange={(e) => setDados({ ...dados, cliente: { ...dados.cliente, nome: e.target.value } })} /></div>
                <div><Label>CPF/CNPJ</Label><Input value={dados.cliente.cpf || ""} onChange={(e) => setDados({ ...dados, cliente: { ...dados.cliente, cpf: e.target.value } })} /></div>
                <div><Label>Telefone</Label><Input value={dados.cliente.telefone || ""} onChange={(e) => setDados({ ...dados, cliente: { ...dados.cliente, telefone: e.target.value } })} /></div>
                <div className="md:col-span-2"><Label>Endereço</Label><Input value={dados.cliente.endereco || ""} onChange={(e) => setDados({ ...dados, cliente: { ...dados.cliente, endereco: e.target.value } })} /></div>
              </div>
            </section>

            {/* Itens */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-green-700">ESCOPO DO SERVIÇO</h3>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Item</Button>
              </div>
              <div className="space-y-2">
                {dados.itens.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-6"><Label className="text-xs">Descrição</Label><Input value={it.descricao} onChange={(e) => updateItem(idx, { descricao: e.target.value })} /></div>
                    <div className="col-span-2"><Label className="text-xs">Qtd</Label><Input type="number" min={1} value={it.quantidade} onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) })} /></div>
                    <div className="col-span-3"><Label className="text-xs">Unitário</Label><Input type="number" step="0.01" value={it.valor_unitario} onChange={(e) => updateItem(idx, { valor_unitario: Number(e.target.value) })} /></div>
                    <div className="col-span-1">
                      <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={dados.itens.length <= 1}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Condições */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-green-700">CONDIÇÕES</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2"><Label>Prazo de execução</Label><Input value={dados.prazo || ""} onChange={(e) => setDados({ ...dados, prazo: e.target.value })} /></div>
                <div><Label>Garantia</Label><Input value={dados.garantia || ""} onChange={(e) => setDados({ ...dados, garantia: e.target.value })} /></div>
                <div><Label>Validade (dias)</Label><Input type="number" min={1} value={dados.validade_dias || 7} onChange={(e) => setDados({ ...dados, validade_dias: Number(e.target.value) })} /></div>
                <div className="md:col-span-2"><Label>Forma de pagamento</Label><Input value={dados.pagamento || ""} onChange={(e) => setDados({ ...dados, pagamento: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>Observações</Label><Textarea rows={2} value={dados.observacoes || ""} onChange={(e) => setDados({ ...dados, observacoes: e.target.value })} /></div>
              </div>
            </section>

            {/* Totais */}
            <section className="rounded-md border bg-muted/30 p-3 space-y-1.5">
              <div className="flex justify-between text-sm"><span>Subtotal (custo)</span><span>{formatBRL(subtotal)}</span></div>
              <div className="flex justify-between text-sm items-center">
                <span>Desconto</span>
                <Input className="w-32 h-7 text-right" type="number" step="0.01" value={dados.desconto} onChange={(e) => setDados({ ...dados, desconto: Number(e.target.value) })} />
              </div>
              <div className="flex justify-between text-base font-bold text-green-700 items-center pt-1 border-t">
                <span>TOTAL ao cliente</span>
                {totalManual ? (
                  <Input className="w-40 h-9 text-right font-bold" type="number" step="0.01" value={dados.total} onChange={(e) => setDados({ ...dados, total: Number(e.target.value) })} />
                ) : (
                  <span>{formatBRL(totalFinal)}</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex justify-end">
                <button type="button" className="underline" onClick={() => { setTotalManual((m) => !m); if (!totalManual) setDados((d) => ({ ...d, total: totalCalc })); }}>
                  {totalManual ? "voltar p/ cálculo automático (margem 23%, final 8)" : "editar total manualmente"}
                </button>
              </div>
            </section>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!busy}>Cancelar</Button>
          <Button variant="secondary" onClick={() => handleGerar("baixar")} disabled={!!busy || loading}>
            {busy === "baixar" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            Baixar PDF
          </Button>
          <Button onClick={() => handleGerar("enviar")} disabled={!!busy || loading} className="bg-green-700 hover:bg-green-800">
            {busy === "enviar" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Gerar + Enviar no WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
