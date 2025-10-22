import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Save, FileText, DollarSign, Calendar, CreditCard, User } from "lucide-react";
import { toast } from "sonner";
import debounce from "lodash-es/debounce";

interface FichaServicoTabProps {
  fichaId: string;
}

interface Ficha {
  id: string;
  telefone_cliente: string;
  nome_ficha: string | null;
  descricao: string | null;
  status: string;
  prestador_id: string | null;
  valor_total: number;
  valor_mao_obra: number;
  valor_pecas: number;
  horario_agendamento: string | null;
  cpf: string | null;
  endereco: string | null;
  pagamento_tipo: string | null;
  pagamento_parcelas: number;
  pagamento_gerar_link: boolean;
  notas: string | null;
  categoria_id: number | null;
  id_zoho: string | null;
}

interface Prestador {
  cpf: string;
  nome: string;
}

const STATUS_OPTIONS = [
  "Não foi adiante",
  "Ficha Criada",
  "Contato Inicial",
  "Dúvida Prestador",
  "Orçamento Enviado",
  "Negociação",
  "Visita Técnica",
  "Orçamento Aprovado / Agendamento",
  "Orçamento Não Aprovado",
  "Agendado",
  "Em andamento",
  "Finalizado",
  "Garantia",
  "Perdido"
];

export const FichaServicoTab = ({ fichaId }: FichaServicoTabProps) => {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [dataAgendamento, setDataAgendamento] = useState<string>('');
  const [horaAgendamento, setHoraAgendamento] = useState<string>('');

  const autoSave = useCallback(
    debounce(async (fichaData: Ficha, dataAgend: string, horaAgend: string) => {
      let agendamentoISO: string | undefined;
      if (dataAgend && horaAgend) {
        agendamentoISO = `${dataAgend}T${horaAgend}:00`;
      } else if (dataAgend) {
        agendamentoISO = `${dataAgend}T00:00:00`;
      }
      try {
        const { error } = await supabase
          .from('fichas_de_servico')
          .upsert([{
            id: fichaData.id,
            telefone_cliente: fichaData.telefone_cliente,
            nome_ficha: fichaData.nome_ficha,
            descricao: fichaData.descricao,
            status: fichaData.status as any,
            prestador_id: fichaData.prestador_id,
            valor_total: fichaData.valor_total,
            valor_mao_obra: fichaData.valor_mao_obra,
            valor_pecas: fichaData.valor_pecas,
            horario_agendamento: agendamentoISO,
            cpf: fichaData.cpf,
            endereco: fichaData.endereco,
            pagamento_tipo: fichaData.pagamento_tipo as any,
            pagamento_parcelas: fichaData.pagamento_parcelas,
            pagamento_gerar_link: fichaData.pagamento_gerar_link,
            notas: fichaData.notas,
            categoria_id: fichaData.categoria_id,
            id_zoho: fichaData.id_zoho,
          }] as any, { onConflict: 'id' });

        if (error) throw error;

        const webhookUrl = localStorage.getItem('webhook_ficha_atualizada');
        if (webhookUrl) {
          try {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: fichaData.id,
                telefone_cliente: fichaData.telefone_cliente,
                nome_ficha: fichaData.nome_ficha,
                status: fichaData.status,
                categoria_id: fichaData.categoria_id,
                descricao: fichaData.descricao,
                prestador_id: fichaData.prestador_id,
                valor_total: fichaData.valor_total,
                valor_mao_obra: fichaData.valor_mao_obra,
                valor_pecas: fichaData.valor_pecas,
                horario_agendamento: agendamentoISO,
                cpf: fichaData.cpf,
                endereco: fichaData.endereco,
                pagamento_gerar_link: fichaData.pagamento_gerar_link,
                pagamento_tipo: fichaData.pagamento_tipo,
                pagamento_parcelas: fichaData.pagamento_parcelas,
                id_zoho: fichaData.id_zoho,
                notas: fichaData.notas,
              }),
            });
          } catch (webhookError) {
            console.error('Erro ao enviar webhook:', webhookError);
          }
        }
      } catch (error) {
        console.error('Erro ao salvar ficha:', error);
        toast.error("Erro ao salvar ficha");
      }
    }, 1000),
    []
  );

  useEffect(() => {
    fetchFicha();
    fetchPrestadores();

    const channel = supabase
      .channel(`ficha-${fichaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fichas_de_servico',
          filter: `id=eq.${fichaId}`
        },
        () => fetchFicha()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fichaId]);

  const fetchFicha = async () => {
    const { data, error } = await supabase
      .from('fichas_de_servico')
      .select('*')
      .eq('id', fichaId)
      .maybeSingle();

    if (!error && data) {
      setFicha(data);
      
      if (data.horario_agendamento) {
        const dataHora = new Date(data.horario_agendamento);
        const ano = dataHora.getFullYear();
        const mes = String(dataHora.getMonth() + 1).padStart(2, '0');
        const dia = String(dataHora.getDate()).padStart(2, '0');
        const hora = String(dataHora.getHours()).padStart(2, '0');
        const min = String(dataHora.getMinutes()).padStart(2, '0');
        
        setDataAgendamento(`${ano}-${mes}-${dia}`);
        setHoraAgendamento(`${hora}:${min}`);
      }
    }
  };

  const fetchPrestadores = async () => {
    const { data } = await supabase
      .from('prestadores')
      .select('cpf, nome')
      .order('nome');

    if (data) setPrestadores(data as Prestador[]);
  };

  const updateFicha = (updates: Partial<Ficha>) => {
    if (!ficha) return;
    const updatedFicha = { ...ficha, ...updates };
    setFicha(updatedFicha);
    autoSave(updatedFicha, dataAgendamento, horaAgendamento);
  };

  const updateDataAgendamento = (data: string) => {
    setDataAgendamento(data);
    if (ficha) {
      autoSave(ficha, data, horaAgendamento);
    }
  };

  const updateHoraAgendamento = (hora: string) => {
    setHoraAgendamento(hora);
    if (ficha) {
      autoSave(ficha, dataAgendamento, hora);
    }
  };

  const salvarManualmente = async () => {
    if (!ficha) return;
    
    let agendamentoISO: string | undefined;
    if (dataAgendamento && horaAgendamento) {
      agendamentoISO = `${dataAgendamento}T${horaAgendamento}:00`;
    } else if (dataAgendamento) {
      agendamentoISO = `${dataAgendamento}T00:00:00`;
    }
    
    try {
      const { error } = await supabase
        .from('fichas_de_servico')
        .upsert([{
          id: ficha.id,
          telefone_cliente: ficha.telefone_cliente,
          nome_ficha: ficha.nome_ficha,
          descricao: ficha.descricao,
          status: ficha.status as any,
          prestador_id: ficha.prestador_id,
          valor_total: ficha.valor_total,
          valor_mao_obra: ficha.valor_mao_obra,
          valor_pecas: ficha.valor_pecas,
          horario_agendamento: agendamentoISO,
          cpf: ficha.cpf,
          endereco: ficha.endereco,
          pagamento_tipo: ficha.pagamento_tipo as any,
          pagamento_parcelas: ficha.pagamento_parcelas,
          pagamento_gerar_link: ficha.pagamento_gerar_link,
          notas: ficha.notas,
          categoria_id: ficha.categoria_id,
          id_zoho: ficha.id_zoho,
        }] as any);

      if (error) throw error;

      const webhookUrl = localStorage.getItem('webhook_ficha_atualizada');
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: ficha.id,
              telefone_cliente: ficha.telefone_cliente,
              nome_ficha: ficha.nome_ficha,
              status: ficha.status,
              categoria_id: ficha.categoria_id,
              descricao: ficha.descricao,
              prestador_id: ficha.prestador_id,
              valor_total: ficha.valor_total,
              valor_mao_obra: ficha.valor_mao_obra,
              valor_pecas: ficha.valor_pecas,
              horario_agendamento: agendamentoISO,
              cpf: ficha.cpf,
              endereco: ficha.endereco,
              pagamento_gerar_link: ficha.pagamento_gerar_link,
              pagamento_tipo: ficha.pagamento_tipo,
              pagamento_parcelas: ficha.pagamento_parcelas,
              id_zoho: ficha.id_zoho,
              notas: ficha.notas,
            }),
          });
        } catch (webhookError) {
          console.error('Erro ao enviar webhook:', webhookError);
        }
      }

      toast.success("Ficha salva com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar ficha:', error);
      toast.error("Erro ao salvar ficha");
    }
  };

  if (!ficha) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 space-y-6 pb-24 overflow-y-auto">
      <Accordion type="multiple" defaultValue={["informacoes-gerais", "agendamento", "valores"]} className="w-full space-y-4">
        <AccordionItem value="informacoes-gerais" className="border rounded-lg shadow-sm bg-card">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-semibold">Informações Gerais</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="nome_ficha" className="text-sm font-medium">Nome da Ficha</Label>
                <Input
                  id="nome_ficha"
                  value={ficha?.nome_ficha || ""}
                  onChange={(e) => updateFicha({ nome_ficha: e.target.value })}
                  placeholder="Identificação da ficha"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                <Select
                  value={ficha?.status || "pendente"}
                  onValueChange={(value) => updateFicha({ status: value })}
                >
                  <SelectTrigger id="status" className="mt-1.5">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="descricao" className="text-sm font-medium">Descrição</Label>
                <Input
                  id="descricao"
                  value={ficha?.descricao || ""}
                  onChange={(e) => updateFicha({ descricao: e.target.value })}
                  placeholder="Descrição do serviço"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="cpf" className="text-sm font-medium">CPF do Cliente</Label>
                <Input
                  id="cpf"
                  value={ficha?.cpf || ""}
                  onChange={(e) => updateFicha({ cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="endereco" className="text-sm font-medium">Endereço</Label>
                <Input
                  id="endereco"
                  value={ficha?.endereco || ""}
                  onChange={(e) => updateFicha({ endereco: e.target.value })}
                  placeholder="Endereço completo"
                  className="mt-1.5"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="agendamento" className="border rounded-lg shadow-sm bg-card">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-semibold">Agendamento</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="data_agendamento" className="text-sm font-medium">Data do Agendamento</Label>
                <Input
                  id="data_agendamento"
                  type="date"
                  value={dataAgendamento}
                  onChange={(e) => updateDataAgendamento(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="hora_agendamento" className="text-sm font-medium">Horário do Agendamento</Label>
                <Input
                  id="hora_agendamento"
                  type="time"
                  value={horaAgendamento}
                  onChange={(e) => updateHoraAgendamento(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="prestador_id" className="text-sm font-medium">Prestador de Serviço</Label>
                <Select
                  value={ficha?.prestador_id || ""}
                  onValueChange={(value) => updateFicha({ prestador_id: value })}
                >
                  <SelectTrigger id="prestador_id" className="mt-1.5">
                    <SelectValue placeholder="Selecione o prestador" />
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
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="valores" className="border rounded-lg shadow-sm bg-card">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="font-semibold">Valores</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="valor_total" className="text-sm font-medium">Valor Total</Label>
                <Input
                  id="valor_total"
                  type="number"
                  step="0.01"
                  value={ficha?.valor_total || ""}
                  onChange={(e) => updateFicha({ valor_total: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="valor_mao_obra" className="text-sm font-medium">Valor Mão de Obra</Label>
                <Input
                  id="valor_mao_obra"
                  type="number"
                  step="0.01"
                  value={ficha?.valor_mao_obra || ""}
                  onChange={(e) => updateFicha({ valor_mao_obra: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="valor_pecas" className="text-sm font-medium">Valor Peças</Label>
                <Input
                  id="valor_pecas"
                  type="number"
                  step="0.01"
                  value={ficha?.valor_pecas || ""}
                  onChange={(e) => updateFicha({ valor_pecas: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="mt-1.5"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pagamento" className="border rounded-lg shadow-sm bg-card">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="font-semibold">Pagamento</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pagamento_gerar_link"
                  checked={ficha?.pagamento_gerar_link || false}
                  onCheckedChange={(checked) => updateFicha({ pagamento_gerar_link: checked as boolean })}
                />
                <Label htmlFor="pagamento_gerar_link" className="cursor-pointer text-sm font-medium">
                  Gerar link de pagamento
                </Label>
              </div>

              <div>
                <Label htmlFor="pagamento_tipo" className="text-sm font-medium">Forma de Pagamento</Label>
                <Select
                  value={ficha?.pagamento_tipo || ""}
                  onValueChange={(value) => updateFicha({ pagamento_tipo: value })}
                >
                  <SelectTrigger id="pagamento_tipo" className="mt-1.5">
                    <SelectValue placeholder="Selecione a forma de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                    <SelectItem value="debito">Débito</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="pagamento_parcelas" className="text-sm font-medium">Número de Parcelas</Label>
                <Input
                  id="pagamento_parcelas"
                  type="number"
                  min="1"
                  value={ficha?.pagamento_parcelas || 1}
                  onChange={(e) => updateFicha({ pagamento_parcelas: parseInt(e.target.value) || 1 })}
                  className="mt-1.5"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="informacoes-cliente" className="border rounded-lg shadow-sm bg-card">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-semibold">Informações do Cliente</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="telefone_cliente" className="text-sm font-medium">Telefone do Cliente</Label>
                <Input
                  id="telefone_cliente"
                  value={ficha?.telefone_cliente || ""}
                  disabled
                  className="bg-muted mt-1.5"
                />
              </div>
              
              <div>
                <Label htmlFor="notas" className="text-sm font-medium">Notas Adicionais</Label>
                <Input
                  id="notas"
                  value={ficha?.notas || ""}
                  onChange={(e) => updateFicha({ notas: e.target.value })}
                  placeholder="Observações e anotações"
                  className="mt-1.5"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Button 
        onClick={salvarManualmente} 
        className="fixed bottom-6 right-6 shadow-lg z-50"
        size="lg"
      >
        <Save className="mr-2 h-4 w-4" />
        Salvar Ficha
      </Button>
    </div>
  );
};
