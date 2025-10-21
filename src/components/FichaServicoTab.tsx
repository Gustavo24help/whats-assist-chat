import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { debounce } from "lodash-es";

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

  // Auto-save debounced
  const autoSave = useCallback(
    debounce(async (fichaData: Ficha, dataAgend: string, horaAgend: string) => {
      // Combinar data e hora em formato ISO
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

        // Disparar webhook
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
      
      // Separar data e hora do agendamento
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
    
    // Combinar data e hora
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

      // Disparar webhook
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

  if (!ficha) return <div className="p-4">Carregando...</div>;

  return (
    <div className="relative h-full flex flex-col max-h-screen">
      <div className="flex-1 overflow-y-auto pb-24">
        <Accordion type="multiple" defaultValue={["geral", "agendamento", "valores"]} className="px-4 pt-4 pb-4">
        {/* 1. Informações Gerais */}
        <AccordionItem value="geral">
          <AccordionTrigger>Informações Gerais</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div>
              <Label htmlFor="nome_ficha">Nome da Ficha (ID)</Label>
              <Input
                id="nome_ficha"
                value={ficha.nome_ficha || ''}
                onChange={(e) => updateFicha({ nome_ficha: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="telefone_cliente">Telefone Cliente</Label>
              <Input
                id="telefone_cliente"
                value={ficha.telefone_cliente || ''}
                disabled
                className="bg-muted"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={ficha.status} onValueChange={(value) => updateFicha({ status: value })}>
                <SelectTrigger>
                  <SelectValue />
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
              <Label htmlFor="categoria_id">Categoria</Label>
              <Input
                id="categoria_id"
                type="number"
                value={ficha.categoria_id || ''}
                onChange={(e) => updateFicha({ categoria_id: parseInt(e.target.value) || null })}
              />
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={ficha.descricao || ''}
                onChange={(e) => updateFicha({ descricao: e.target.value })}
                rows={3}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 2. Agendamento */}
        <AccordionItem value="agendamento">
          <AccordionTrigger>Agendamento</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div>
              <Label htmlFor="prestador">Prestador</Label>
              <Select 
                value={ficha.prestador_id || ''} 
                onValueChange={(value) => updateFicha({ prestador_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um prestador" />
                </SelectTrigger>
                <SelectContent>
                  {prestadores.map((prestador) => (
                    <SelectItem key={prestador.cpf} value={prestador.cpf}>
                      {prestador.nome} - {prestador.cpf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="data_agendamento">Data do Agendamento</Label>
              <Input
                id="data_agendamento"
                type="date"
                value={dataAgendamento}
                onChange={(e) => updateDataAgendamento(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="hora_agendamento">Horário do Agendamento</Label>
              <Input
                id="hora_agendamento"
                type="time"
                value={horaAgendamento}
                onChange={(e) => updateHoraAgendamento(e.target.value)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3. Valores */}
        <AccordionItem value="valores">
          <AccordionTrigger>Valores</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div>
              <Label htmlFor="valor_total">Valor Total</Label>
              <Input
                id="valor_total"
                type="number"
                step="0.01"
                value={ficha.valor_total}
                onChange={(e) => updateFicha({ valor_total: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label htmlFor="valor_mao_obra">Valor Mão de Obra</Label>
              <Input
                id="valor_mao_obra"
                type="number"
                step="0.01"
                value={ficha.valor_mao_obra}
                onChange={(e) => updateFicha({ valor_mao_obra: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label htmlFor="valor_pecas">Valor Peças</Label>
              <Input
                id="valor_pecas"
                type="number"
                step="0.01"
                value={ficha.valor_pecas}
                onChange={(e) => updateFicha({ valor_pecas: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 4. Pagamento */}
        <AccordionItem value="pagamento">
          <AccordionTrigger>Pagamento</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="gerar_link"
                checked={ficha.pagamento_gerar_link}
                onCheckedChange={(checked) => updateFicha({ pagamento_gerar_link: checked as boolean })}
              />
              <Label htmlFor="gerar_link" className="cursor-pointer">Gerar Link de Pagamento</Label>
            </div>

            <div>
              <Label htmlFor="pagamento_tipo">Forma de Pagamento</Label>
              <Select 
                value={ficha.pagamento_tipo || ''} 
                onValueChange={(value) => updateFicha({ pagamento_tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="parcelas">Parcelamento</Label>
              <Input
                id="parcelas"
                type="number"
                min="1"
                value={ficha.pagamento_parcelas}
                onChange={(e) => updateFicha({ pagamento_parcelas: parseInt(e.target.value) || 1 })}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 5. Informações do Cliente */}
        <AccordionItem value="cliente">
          <AccordionTrigger>Informações do Cliente</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div>
              <Label htmlFor="cpf">CPF Cliente</Label>
              <Input
                id="cpf"
                value={ficha.cpf || ''}
                onChange={(e) => updateFicha({ cpf: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="endereco">Endereço</Label>
              <Textarea
                id="endereco"
                value={ficha.endereco || ''}
                onChange={(e) => updateFicha({ endereco: e.target.value })}
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="id_zoho">ID Zoho Ficha</Label>
              <Input
                id="id_zoho"
                value={ficha.id_zoho || ''}
                onChange={(e) => updateFicha({ id_zoho: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                value={ficha.notas || ''}
                onChange={(e) => updateFicha({ notas: e.target.value })}
                rows={3}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      </div>

      {/* Botão flutuante de salvar */}
      <div className="sticky bottom-0 left-0 right-0 p-3 bg-background border-t border-border z-10 shadow-lg">
        <Button onClick={salvarManualmente} className="w-full">
          💾 Salvar Ficha
        </Button>
      </div>
    </div>
  );
};
