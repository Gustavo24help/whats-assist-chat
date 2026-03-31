import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Copy, Pencil, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AprovacaoOrcamentoDialog } from "./AprovacaoOrcamentoDialog";

interface OrcamentosTabProps {
  fichaId: string;
}

interface Orcamento {
  id: string;
  prestador_cpf: string;
  ficha_nome: string;
  valor_total: number | null;
  valor_mao_obra: number | null;
  valor_pecas: number | null;
  tempo_servico: string | null;
  observacoes: string | null;
  categoria: string | null;
  status: string;
  data_criacao: string;
  pode_horario: boolean | null;
  horario_sugerido: string | null;
  prestador_nome?: string;
}

export const OrcamentosTab = ({ fichaId }: OrcamentosTabProps) => {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [editingOrcamento, setEditingOrcamento] = useState<Orcamento | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAprovacaoDialogOpen, setIsAprovacaoDialogOpen] = useState(false);
  const [orcamentoParaAprovar, setOrcamentoParaAprovar] = useState<Orcamento | null>(null);
  const [isAprovando, setIsAprovando] = useState(false);
  const [editFormData, setEditFormData] = useState({
    valor_total: 0,
    valor_mao_obra: 0,
    valor_pecas: 0,
    tempo_servico: "",
    observacoes: "",
  });

  useEffect(() => {
    fetchOrcamentos();
    fetchClienteTelefone();

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

  const fetchClienteTelefone = async () => {
    const { data } = await supabase
      .from('fichas_de_servico')
      .select('telefone_cliente')
      .eq('id', fichaId)
      .maybeSingle();

    if (data) {
      setClienteTelefone(data.telefone_cliente);
    }
  };

  const fetchOrcamentos = async () => {
    const { data } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('ficha_nome', fichaId)
      .order('data_criacao', { ascending: false });

    if (data) {
      // ✅ Buscar TODOS os prestadores de uma vez (batch query)
      const cpfs = [...new Set(data.map(o => o.prestador_cpf))];
      const { data: prestadores } = await supabase
        .from('prestadores')
        .select('cpf, nome')
        .in('cpf', cpfs);

      // Criar mapa
      const prestadoresMap = new Map();
      prestadores?.forEach(p => prestadoresMap.set(p.cpf, p.nome));

      // ✅ Combinar SEM QUERIES EXTRAS
      const orcamentosComNome = data.map(orc => ({
        ...orc,
        prestador_nome: prestadoresMap.get(orc.prestador_cpf) || orc.prestador_cpf
      }));

      setOrcamentos(orcamentosComNome);
    }
  };

  const copiarLinkOrcamento = (fichaNome: string) => {
    const link = `https://chat.24help.com.br/orcamento?ficha=${encodeURIComponent(fichaNome)}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado para a área de transferência!");
  };

  const handleEditarOrcamento = (orc: Orcamento) => {
    setEditingOrcamento(orc);
    setEditFormData({
      valor_total: orc.valor_total || 0,
      valor_mao_obra: orc.valor_mao_obra || 0,
      valor_pecas: orc.valor_pecas || 0,
      tempo_servico: orc.tempo_servico || "",
      observacoes: orc.observacoes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSalvarEdicao = async () => {
    if (!editingOrcamento) return;

    try {
      const { error } = await supabase
        .from('orcamentos')
        .update({
          valor_total: editFormData.valor_total,
          valor_mao_obra: editFormData.valor_mao_obra,
          valor_pecas: editFormData.valor_pecas,
          tempo_servico: editFormData.tempo_servico || null,
          observacoes: editFormData.observacoes || null,
        })
        .eq('id', editingOrcamento.id);

      if (error) throw error;

      toast.success("Orçamento atualizado com sucesso!");
      setIsEditDialogOpen(false);
      fetchOrcamentos();
    } catch (error) {
      console.error('Erro ao atualizar orçamento:', error);
      toast.error("Erro ao atualizar orçamento");
    }
  };

  const iniciarAprovacao = (orc: Orcamento) => {
    if (isAprovando) return; // Já tem aprovação em andamento
    setOrcamentoParaAprovar(orc);
    setIsAprovacaoDialogOpen(true);
  };

  const aprovarOrcamento = async () => {
    if (!orcamentoParaAprovar || isAprovando) return;
    setIsAprovando(true);

    const orc = orcamentoParaAprovar;

    try {
      // Reprovar outros orçamentos
      await supabase
        .from('orcamentos')
        .update({ status: 'rejeitado' })
        .eq('ficha_nome', fichaId)
        .neq('id', orc.id);

      // Aprovar este orçamento
      await supabase
        .from('orcamentos')
        .update({ status: 'aprovado' })
        .eq('id', orc.id);

      // Atualizar ficha - isso vai disparar o webhook automaticamente
      const { error: fichaError } = await supabase
        .from('fichas_de_servico')
        .update({
          status: 'Orçamento Enviado',
          valor_total: orc.valor_total || 0,
          valor_mao_obra: orc.valor_mao_obra || 0,
          valor_pecas: orc.valor_pecas || 0,
          tempo_servico: orc.tempo_servico,
          prestador_id: orc.prestador_cpf
        })
        .eq('id', fichaId);

      if (fichaError) throw fichaError;

      // Buscar ficha atualizada e enviar webhook
      const { data: fichaAtualizada } = await supabase
        .from('fichas_de_servico')
        .select('*')
        .eq('id', fichaId)
        .single();

      if (fichaAtualizada) {
        const { data: prestadorData } = await supabase
          .from('prestadores')
          .select('id_crm, cpf')
          .eq('cpf', orc.prestador_cpf)
          .maybeSingle();

        const { data: clienteData } = await supabase
          .from('clientes')
          .select('nome')
          .eq('telefone', fichaAtualizada.telefone_cliente)
          .maybeSingle();

        // Buscar webhook do banco
        const { data: webhookConfig } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'webhook_ficha_atualizada')
          .single();

        const webhookUrl = webhookConfig?.valor;

        if (webhookUrl) {
          const webhookPayload = {
            ...fichaAtualizada,
            nome_cliente: clienteData?.nome || 'Desconhecido',
            prestador_id_crm: prestadorData?.id_crm || null,
            prestador_cpf: prestadorData?.cpf || orc.prestador_cpf,
            pagamento_gerar_link: fichaAtualizada.pagamento_gerar_link ? "Sim" : "Não",
            timestamp_webhook: new Date().toISOString(),
            evento: 'orcamento_aprovado',
          };

          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
          });
          
          console.log("✅ Webhook enviado após aprovar orçamento");
        }
      }

      toast.success("Orçamento aprovado! Valores atualizados na ficha.");
      fetchOrcamentos();
    } catch (error) {
      console.error('Erro ao aprovar orçamento:', error);
      toast.error("Erro ao aprovar orçamento");
    } finally {
      setIsAprovando(false);
      setOrcamentoParaAprovar(null);
    }
  };

  const desaprovarOrcamento = async (orcId: string) => {
    try {
      const { error } = await supabase
        .from('orcamentos')
        .update({ status: 'pendente' })
        .eq('id', orcId);

      if (error) throw error;

      // Limpar valores da ficha
      const { error: fichaError } = await supabase
        .from('fichas_de_servico')
        .update({
          valor_total: 0,
          valor_mao_obra: 0,
          valor_pecas: 0,
          prestador_id: null,
        })
        .eq('id', fichaId);

      if (fichaError) throw fichaError;

      toast.success("Orçamento desaprovado com sucesso!");
      fetchOrcamentos();
    } catch (error) {
      console.error('Erro ao desaprovar orçamento:', error);
      toast.error("Erro ao desaprovar orçamento");
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-foreground">Orçamentos</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copiarLinkOrcamento(fichaId)}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copiar Link Orçamento
        </Button>
      </div>
      
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
                    variant={
                      orc.status === 'aprovado' 
                        ? 'default' 
                        : orc.status === 'rejeitado' 
                          ? 'destructive' 
                          : 'secondary'
                    }
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

                {orc.tempo_servico && (
                  <div className="text-sm">
                    <span className="font-medium text-foreground">Tempo de Serviço:</span> 
                    <span className="text-muted-foreground ml-1">{orc.tempo_servico}</span>
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
                
                {orc.pode_horario !== null && (
                  <div className="text-sm">
                    <span className="font-medium text-foreground">Disponibilidade no Horário:</span>
                    <span className="text-muted-foreground ml-1">
                      {orc.pode_horario ? "Sim, pode no horário solicitado" : "Não pode no horário solicitado"}
                    </span>
                  </div>
                )}
                
                {!orc.pode_horario && orc.horario_sugerido && (
                  <div className="text-sm">
                    <span className="font-medium text-foreground">Horário Sugerido:</span>
                    <span className="text-muted-foreground ml-1">
                      {format(new Date(orc.horario_sugerido), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    Criado em: {format(new Date(orc.data_criacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditarOrcamento(orc)}
                    >
                      <Pencil className="mr-1 h-4 w-4" />
                      Editar
                    </Button>

                    {orc.status === 'aprovado' ? (
                      <Button 
                        variant="destructive"
                        size="sm"
                        onClick={() => desaprovarOrcamento(orc.id)}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Desaprovar
                      </Button>
                    ) : (
                      <Button 
                        variant="secondary"
                        size="sm"
                        className="shadow-sm hover:shadow-md transition-shadow"
                        onClick={() => iniciarAprovacao(orc)}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Aprovar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Orçamento</DialogTitle>
            <DialogDescription>
              Atualize os valores e informações do orçamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_valor_total">Valor Total</Label>
              <Input
                id="edit_valor_total"
                type="number"
                step="0.01"
                value={editFormData.valor_total}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, valor_total: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_valor_mao_obra">Valor Mão de Obra</Label>
              <Input
                id="edit_valor_mao_obra"
                type="number"
                step="0.01"
                value={editFormData.valor_mao_obra}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, valor_mao_obra: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_valor_pecas">Valor Peças</Label>
              <Input
                id="edit_valor_pecas"
                type="number"
                step="0.01"
                value={editFormData.valor_pecas}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, valor_pecas: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_tempo_servico">Tempo de Serviço</Label>
              <Input
                id="edit_tempo_servico"
                placeholder="Ex: 2 horas"
                value={editFormData.tempo_servico}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, tempo_servico: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_observacoes">Observações</Label>
              <Textarea
                id="edit_observacoes"
                rows={4}
                value={editFormData.observacoes}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, observacoes: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarEdicao}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Aprovação */}
      {orcamentoParaAprovar && (
        <AprovacaoOrcamentoDialog
          open={isAprovacaoDialogOpen}
          onOpenChange={setIsAprovacaoDialogOpen}
          onConfirm={aprovarOrcamento}
          orcamento={orcamentoParaAprovar}
          fichaNome={fichaId}
          clienteTelefone={clienteTelefone}
        />
      )}
    </div>
  );
};
