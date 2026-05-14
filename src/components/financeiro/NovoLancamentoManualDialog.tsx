import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { BuscarPrestadorCombobox, type PrestadorOption } from "./BuscarPrestadorCombobox";
import { BuscarFichaCombobox, type FichaOption } from "./BuscarFichaCombobox";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

const CATEGORIAS = ["Aluguel", "Fornecedor", "Imposto", "Salário", "Serviço", "Material", "Outros"];
const FORMAS = ["PIX", "Transferência", "Dinheiro", "Boleto", "Cartão de Crédito", "Cartão de Débito"];

export function NovoLancamentoManualDialog({ open, onOpenChange, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [beneficiarioNome, setBeneficiarioNome] = useState("");
  const [prestador, setPrestador] = useState<PrestadorOption | null>(null);
  const [ficha, setFicha] = useState<FichaOption | null>(null);
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const reset = () => {
    setDescricao(""); setCategoria(""); setBeneficiarioNome("");
    setPrestador(null); setFicha(null); setValor("");
    setDataVencimento(""); setFormaPagamento(""); setObservacoes("");
  };

  const handlePrestador = (p: PrestadorOption | null) => {
    setPrestador(p);
    if (p) setBeneficiarioNome(p.nome);
  };

  const handleSave = async () => {
    if (!descricao.trim()) { toast.error("Descrição é obrigatória"); return; }
    const nomeFinal = prestador ? prestador.nome : beneficiarioNome.trim();
    if (!nomeFinal) { toast.error("Beneficiário é obrigatório"); return; }
    const valorNum = parseFloat(valor.replace(",", "."));
    if (!valorNum || valorNum <= 0) { toast.error("Valor inválido"); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: inserted, error } = await (supabase as any).from("contas_pagar_manual").insert({
        descricao: descricao.trim(),
        categoria: categoria || null,
        beneficiario_nome: nomeFinal,
        beneficiario_tipo: prestador ? "prestador" : "externo",
        prestador_id: prestador?.cpf || null,
        ficha_id: ficha?.id || null,
        valor: valorNum,
        data_vencimento: dataVencimento || null,
        forma_pagamento: formaPagamento || null,
        observacoes: observacoes.trim() || null,
        criado_por: user?.id || null,
        status: "pendente",
      }).select().single();
      if (error) throw error;

      // Sincronizar com Google Sheets (não bloqueia o salvamento)
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        await fetch(`https://${projectId}.supabase.co/functions/v1/webhook-update-planilha`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acao: "lancamento_manual_criado",
            lancamento_id: inserted?.id,
            ficha_id: ficha?.id || null,
            descricao: descricao.trim(),
            categoria: categoria || null,
            beneficiario_nome: nomeFinal,
            beneficiario_tipo: prestador ? "prestador" : "externo",
            prestador_cpf: prestador?.cpf || null,
            valor: valorNum,
            data_vencimento: dataVencimento || null,
            forma_pagamento: formaPagamento || null,
            observacoes: observacoes.trim() || null,
            status: "pendente",
            created_at: new Date().toISOString(),
          }),
        });
      } catch (whErr) {
        console.error("[NovoLancamentoManual] webhook-update-planilha falhou:", whErr);
      }

      toast.success("Lançamento criado com sucesso");
      reset();
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lançamento Manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Descrição *</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Aluguel do escritório - Março/2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {FORMAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <Label className="text-xs text-muted-foreground">BENEFICIÁRIO</Label>
            <div>
              <Label className="text-xs">Buscar prestador cadastrado (opcional)</Label>
              <BuscarPrestadorCombobox value={prestador?.cpf} onChange={handlePrestador} />
            </div>
            <div>
              <Label className="text-xs">Nome do beneficiário *</Label>
              <Input
                value={beneficiarioNome}
                onChange={(e) => { setBeneficiarioNome(e.target.value); if (prestador) setPrestador(null); }}
                placeholder="Nome (livre se não for prestador)"
              />
            </div>
          </div>

          <div>
            <Label>Vincular a Ficha (opcional)</Label>
            <BuscarFichaCombobox value={ficha?.id} onChange={setFicha} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Data de Vencimento</Label>
              <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Lançamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
