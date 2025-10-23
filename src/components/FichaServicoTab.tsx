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
  tempo_servico: string | null;
  horario_agendamento: string | null;
  cpf: string | null;
  endereco: string | null;
  pagamento_tipo: string | null;
  pagamento_parcelas: number;
  pagamento_gerar_link: boolean;
  notas: string | null;
  categoria_id: number | null;
  id_zoho: string | null;
  data_visita_tecnica: string | null;
  horario_visita_tecnica: string | null;
  motivo_perda: string | null;
  created_at: string;
  updated_at: string;
}

interface Prestador {
  cpf: string;
  nome: string;
  id_crm: string | null;
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
  const [dataVisitaTecnica, setDataVisitaTecnica] = useState<string>('');
  const [horaVisitaTecnica, setHoraVisitaTecnica] = useState<string>('');
  const [statusAnterior, setStatusAnterior] = useState<string>('');

  // Função centralizada para enviar webhook
  const enviarWebhook = async (fichaData: Ficha, agendamentoISO: string | undefined, visitaTecnicaISO: string | undefined) => {
    const webhookUrl = localStorage.getItem('webhook_ficha_atualizada');
    if (!webhookUrl) {
      console.log("Webhook não configurado, pulando envio");
      return;
    }

    try {
      // Buscar id_crm do prestador
      let prestadorIdCrm = null;
      let prestadorCpf = null;
      
      if (fichaData.prestador_id) {
        const prestador = prestadores.find(p => p.cpf === fichaData.prestador_id);
        prestadorIdCrm = prestador?.id_crm || null;
        prestadorCpf = fichaData.prestador_id; // CPF é a chave primária
      }

      const webhookPayload = {
        // Todos os campos da ficha
        id: fichaData.id,
        telefone_cliente: fichaData.telefone_cliente,
        nome_ficha: fichaData.nome_ficha,
        status: fichaData.status,
        categoria_id: fichaData.categoria_id,
        descricao: fichaData.descricao,
        // Prestador: enviar tanto id_crm quanto cpf
        prestador_id_crm: prestadorIdCrm, // ID do CRM externo
        prestador_cpf: prestadorCpf, // CPF (chave primária no banco)
        // Valores
        valor_total: fichaData.valor_total,
        valor_mao_obra: fichaData.valor_mao_obra,
        valor_pecas: fichaData.valor_pecas,
        // Agendamentos
        horario_agendamento: agendamentoISO,
        data_visita_tecnica: fichaData.data_visita_tecnica,
        horario_visita_tecnica: visitaTecnicaISO,
        // Cliente
        cpf: fichaData.cpf,
        endereco: fichaData.endereco,
        // Pagamento
        pagamento_gerar_link: fichaData.pagamento_gerar_link ? "Sim" : "Não",
        pagamento_tipo: fichaData.pagamento_tipo,
        pagamento_parcelas: fichaData.pagamento_parcelas,
        // Outros
        id_zoho: fichaData.id_zoho,
        notas: fichaData.notas,
        motivo_perda: fichaData.motivo_perda,
        // Timestamps
        created_at: fichaData.created_at,
        updated_at: fichaData.updated_at,
        // Metadados do webhook
        timestamp_webhook: new Date().toISOString(),
        evento: 'ficha_atualizada',
      };

      console.log("Enviando webhook:", webhookUrl);
      console.log("Payload:", JSON.stringify(webhookPayload, null, 2));

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro no webhook (HTTP " + response.status + "):", errorText);
        toast.error("Webhook retornou erro: " + response.status);
      } else {
        console.log("Webhook enviado com sucesso");
      }
    } catch (webhookError) {
      console.error('Erro ao enviar webhook:', webhookError);
      const errorMessage = webhookError instanceof Error ? webhookError.message : 'Erro desconhecido';
      toast.error("Falha ao enviar webhook: " + errorMessage);
    }
  };

  // AutoSave SEM webhook - apenas salva no banco
  const autoSave = useCallback(
    debounce(async (fichaData: Ficha, dataAgend: string, horaAgend: string, dataVisita: string, horaVisita: string) => {
      let agendamentoISO: string | undefined;
      if (dataAgend && horaAgend) {
        agendamentoISO = `${dataAgend}T${horaAgend}:00`;
      } else if (dataAgend) {
        agendamentoISO = `${dataAgend}T00:00:00`;
      }

      let visitaTecnicaISO: string | undefined;
      if (dataVisita && horaVisita) {
        visitaTecnicaISO = `${dataVisita}T${horaVisita}:00`;
      } else if (dataVisita) {
        visitaTecnicaISO = `${dataVisita}T00:00:00`;
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
          tempo_servico: fichaData.tempo_servico,
          horario_agendamento: agendamentoISO,
            cpf: fichaData.cpf,
            endereco: fichaData.endereco,
            pagamento_tipo: fichaData.pagamento_tipo as any,
            pagamento_parcelas: fichaData.pagamento_parcelas,
            pagamento_gerar_link: fichaData.pagamento_gerar_link,
            notas: fichaData.notas,
            categoria_id: fichaData.categoria_id,
            id_zoho: fichaData.id_zoho,
            data_visita_tecnica: fichaData.data_visita_tecnica,
            horario_visita_tecnica: visitaTecnicaISO,
            motivo_perda: fichaData.motivo_perda,
          }] as any, { onConflict: 'id' });

        if (error) {
          console.error('Erro ao salvar ficha:', error);
          throw error;
        }
        console.log('Ficha salva automaticamente com sucesso');
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
      // Cast para any primeiro e depois para Ficha para incluir novos campos
      const fichaCompleta: Ficha = {
        ...(data as any),
        data_visita_tecnica: (data as any).data_visita_tecnica || null,
        horario_visita_tecnica: (data as any).horario_visita_tecnica || null,
        motivo_perda: (data as any).motivo_perda || null,
      };
      
      setFicha(fichaCompleta);
      setStatusAnterior(fichaCompleta.status);
      
      // Extrair data/hora do agendamento
      if (fichaCompleta.horario_agendamento) {
        const horarioStr = fichaCompleta.horario_agendamento;
        const partes = horarioStr.split('T');
        if (partes.length === 2) {
          const dataStr = partes[0];
          const horaStr = partes[1].substring(0, 5);
          setDataAgendamento(dataStr);
          setHoraAgendamento(horaStr);
        }
      }

      // Extrair data/hora da visita técnica
      if (fichaCompleta.horario_visita_tecnica) {
        const horarioStr = fichaCompleta.horario_visita_tecnica;
        const partes = horarioStr.split('T');
        if (partes.length === 2) {
          const dataStr = partes[0];
          const horaStr = partes[1].substring(0, 5);
          setDataVisitaTecnica(dataStr);
          setHoraVisitaTecnica(horaStr);
        }
      }
    }
  };

  const fetchPrestadores = async () => {
    const { data } = await supabase
      .from('prestadores')
      .select('cpf, nome, id_crm')
      .order('nome');

    if (data) setPrestadores(data as Prestador[]);
  };

  const updateFicha = async (updates: Partial<Ficha>) => {
    if (!ficha) return;
    const updatedFicha = { ...ficha, ...updates };
    setFicha(updatedFicha);
    
    // Se o status mudou, enviar webhook imediatamente
    if (updates.status && updates.status !== statusAnterior) {
      setStatusAnterior(updates.status);
      
      let agendamentoISO: string | undefined;
      if (dataAgendamento && horaAgendamento) {
        agendamentoISO = `${dataAgendamento}T${horaAgendamento}:00`;
      } else if (dataAgendamento) {
        agendamentoISO = `${dataAgendamento}T00:00:00`;
      }

      let visitaTecnicaISO: string | undefined;
      if (dataVisitaTecnica && horaVisitaTecnica) {
        visitaTecnicaISO = `${dataVisitaTecnica}T${horaVisitaTecnica}:00`;
      } else if (dataVisitaTecnica) {
        visitaTecnicaISO = `${dataVisitaTecnica}T00:00:00`;
      }
      
      // Salvar no banco
      await supabase
        .from('fichas_de_servico')
        .upsert([{
          id: updatedFicha.id,
          telefone_cliente: updatedFicha.telefone_cliente,
          nome_ficha: updatedFicha.nome_ficha,
          descricao: updatedFicha.descricao,
          status: updatedFicha.status as any,
          prestador_id: updatedFicha.prestador_id,
          valor_total: updatedFicha.valor_total,
          valor_mao_obra: updatedFicha.valor_mao_obra,
          valor_pecas: updatedFicha.valor_pecas,
          tempo_servico: updatedFicha.tempo_servico,
          horario_agendamento: agendamentoISO,
          cpf: updatedFicha.cpf,
          endereco: updatedFicha.endereco,
          pagamento_tipo: updatedFicha.pagamento_tipo as any,
          pagamento_parcelas: updatedFicha.pagamento_parcelas,
          pagamento_gerar_link: updatedFicha.pagamento_gerar_link,
          notas: updatedFicha.notas,
          categoria_id: updatedFicha.categoria_id,
          id_zoho: updatedFicha.id_zoho,
          data_visita_tecnica: updatedFicha.data_visita_tecnica,
          horario_visita_tecnica: visitaTecnicaISO,
          motivo_perda: updatedFicha.motivo_perda,
        }] as any, { onConflict: 'id' });
      
      // Enviar webhook
      await enviarWebhook(updatedFicha, agendamentoISO, visitaTecnicaISO);
      toast.success("Status alterado - Webhook enviado");
    } else {
      // Para outros campos, apenas autosave sem webhook
      autoSave(updatedFicha, dataAgendamento, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica);
    }
  };

  const updateDataAgendamento = (data: string) => {
    setDataAgendamento(data);
    if (ficha) {
      autoSave(ficha, data, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica);
    }
  };

  const updateHoraAgendamento = (hora: string) => {
    setHoraAgendamento(hora);
    if (ficha) {
      autoSave(ficha, dataAgendamento, hora, dataVisitaTecnica, horaVisitaTecnica);
    }
  };

  const updateDataVisitaTecnica = (data: string) => {
    setDataVisitaTecnica(data);
    if (ficha) {
      const updatedFicha = { ...ficha, data_visita_tecnica: data };
      setFicha(updatedFicha);
      autoSave(updatedFicha, dataAgendamento, horaAgendamento, data, horaVisitaTecnica);
    }
  };

  const updateHoraVisitaTecnica = (hora: string) => {
    setHoraVisitaTecnica(hora);
    if (ficha) {
      autoSave(ficha, dataAgendamento, horaAgendamento, dataVisitaTecnica, hora);
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

    let visitaTecnicaISO: string | undefined;
    if (dataVisitaTecnica && horaVisitaTecnica) {
      visitaTecnicaISO = `${dataVisitaTecnica}T${horaVisitaTecnica}:00`;
    } else if (dataVisitaTecnica) {
      visitaTecnicaISO = `${dataVisitaTecnica}T00:00:00`;
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
          tempo_servico: ficha.tempo_servico,
          horario_agendamento: agendamentoISO,
          cpf: ficha.cpf,
          endereco: ficha.endereco,
          pagamento_tipo: ficha.pagamento_tipo as any,
          pagamento_parcelas: ficha.pagamento_parcelas,
          pagamento_gerar_link: ficha.pagamento_gerar_link,
          notas: ficha.notas,
          categoria_id: ficha.categoria_id,
          id_zoho: ficha.id_zoho,
          data_visita_tecnica: ficha.data_visita_tecnica,
          horario_visita_tecnica: visitaTecnicaISO,
          motivo_perda: ficha.motivo_perda,
        }] as any);

      if (error) {
        console.error('Erro ao salvar ficha:', error);
        throw error;
      }

      console.log('Ficha salva manualmente com sucesso');

      // Enviar webhook ao salvar manualmente
      await enviarWebhook(ficha, agendamentoISO, visitaTecnicaISO);

      toast.success("Ficha salva com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar ficha:', error);
      toast.error("Erro ao salvar ficha");
    }
  };

  const sincronizarOrcamentos = async (prestadorCpf: string) => {
    if (!ficha || !ficha.valor_total || ficha.valor_total <= 0) return;

    try {
      // Verificar se existe orçamento do prestador
      const { data: orcamentos } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('ficha_nome', fichaId)
        .eq('prestador_cpf', prestadorCpf);

      if (orcamentos && orcamentos.length > 0) {
        // Aprovar orçamento do prestador
        const { error: aprovarError } = await supabase
          .from('orcamentos')
          .update({ status: 'aprovado' })
          .eq('ficha_nome', fichaId)
          .eq('prestador_cpf', prestadorCpf);

        if (aprovarError) throw aprovarError;

        // Reprovar outros orçamentos
        const { error: reprovarError } = await supabase
          .from('orcamentos')
          .update({ status: 'rejeitado' })
          .eq('ficha_nome', fichaId)
          .neq('prestador_cpf', prestadorCpf);

        if (reprovarError) throw reprovarError;

        toast.success("Orçamento aprovado automaticamente!");
      } else {
        // Criar e aprovar orçamento automaticamente
        const { error: criarError } = await supabase
          .from('orcamentos')
          .insert({
            ficha_nome: fichaId,
            prestador_cpf: prestadorCpf,
            valor_total: ficha.valor_total,
            valor_mao_obra: ficha.valor_mao_obra || 0,
            valor_pecas: ficha.valor_pecas || 0,
            status: 'aprovado',
            categoria: null,
            observacoes: 'Criado automaticamente pela ficha',
          });

        if (criarError) throw criarError;

        toast.success("Orçamento criado e aprovado automaticamente!");
      }
    } catch (error) {
      console.error('Erro ao sincronizar orçamentos:', error);
      toast.error("Erro ao sincronizar orçamentos");
    }
  };

  if (!ficha) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-8 space-y-8 pb-28">
      <Accordion type="single" collapsible defaultValue="" className="w-full space-y-6">
        <AccordionItem value="informacoes-gerais" className="border rounded-lg shadow-md bg-card">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg">Informações Gerais</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-5 pt-4">
              <div>
                <Label htmlFor="nome_ficha" className="text-sm font-medium">Nome da Ficha</Label>
                <Input
                  id="nome_ficha"
                  value={ficha?.nome_ficha || ""}
                  disabled
                  className="mt-2 bg-muted cursor-not-allowed"
                />
              </div>

              <div>
                <Label htmlFor="id_zoho" className="text-sm font-medium">ID Zoho</Label>
                <Input
                  id="id_zoho"
                  value={ficha?.id_zoho || ""}
                  disabled
                  placeholder="Não atribuído"
                  className="mt-2 bg-muted cursor-not-allowed"
                />
              </div>

              <div>
                <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                <Select
                  value={ficha?.status || "pendente"}
                  onValueChange={(value) => updateFicha({ status: value })}
                >
                  <SelectTrigger id="status" className="mt-2">
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
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="cpf" className="text-sm font-medium">CPF do Cliente</Label>
                <Input
                  id="cpf"
                  value={ficha?.cpf || ""}
                  onChange={(e) => updateFicha({ cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="endereco" className="text-sm font-medium">Endereço</Label>
                <Input
                  id="endereco"
                  value={ficha?.endereco || ""}
                  onChange={(e) => updateFicha({ endereco: e.target.value })}
                  placeholder="Endereço completo"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="motivo_perda" className="text-sm font-medium">Motivo de Perda</Label>
                <Input
                  id="motivo_perda"
                  value={ficha?.motivo_perda || ""}
                  onChange={(e) => updateFicha({ motivo_perda: e.target.value })}
                  placeholder="Motivo caso a venda seja perdida"
                  className="mt-2"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="agendamento" className="border rounded-lg shadow-md bg-card">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg">Agendamento</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-5 pt-4">
              <div>
                <Label htmlFor="prestador_id" className="text-sm font-medium">Prestador de Serviço</Label>
                <Select
                  value={ficha?.prestador_id || "nulo"}
                  onValueChange={(value) => updateFicha({ prestador_id: value === "nulo" ? null : value })}
                >
                  <SelectTrigger id="prestador_id" className="mt-2">
                    <SelectValue placeholder="Selecione o prestador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nulo">Nenhum (Nulo)</SelectItem>
                    {prestadores.map((prestador) => (
                      <SelectItem key={prestador.cpf} value={prestador.cpf}>
                        {prestador.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="data_agendamento" className="text-sm font-medium">Data do Agendamento</Label>
                <Input
                  id="data_agendamento"
                  type="date"
                  value={dataAgendamento}
                  onChange={(e) => updateDataAgendamento(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="hora_agendamento" className="text-sm font-medium">Horário do Agendamento</Label>
                <Input
                  id="hora_agendamento"
                  type="time"
                  value={horaAgendamento}
                  onChange={(e) => updateHoraAgendamento(e.target.value)}
                  className="mt-2 text-base px-4 py-2.5 rounded-lg border-input focus:ring-2 focus:ring-ring transition-all"
                />
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold mb-4 text-foreground">Visita Técnica</h4>
                <div className="space-y-5">
                  <div>
                    <Label htmlFor="data_visita_tecnica" className="text-sm font-medium">Data da Visita Técnica</Label>
                    <Input
                      id="data_visita_tecnica"
                      type="date"
                      value={dataVisitaTecnica}
                      onChange={(e) => updateDataVisitaTecnica(e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="hora_visita_tecnica" className="text-sm font-medium">Horário da Visita Técnica</Label>
                    <Input
                      id="hora_visita_tecnica"
                      type="time"
                      value={horaVisitaTecnica}
                      onChange={(e) => updateHoraVisitaTecnica(e.target.value)}
                      className="mt-2 text-base px-4 py-2.5 rounded-lg border-input focus:ring-2 focus:ring-ring transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="valores" className="border rounded-lg shadow-md bg-card">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg">Valores</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-5 pt-4">
              <div>
                <Label htmlFor="prestador_valores" className="text-sm font-medium">Prestador de Serviço</Label>
                <Select
                  value={ficha?.prestador_id || "nulo"}
                  onValueChange={(value) => {
                    const prestadorValue = value === "nulo" ? null : value;
                    updateFicha({ prestador_id: prestadorValue });
                    
                    // Sincronização automática de orçamentos
                    if (prestadorValue && ficha?.valor_total && ficha.valor_total > 0) {
                      sincronizarOrcamentos(prestadorValue);
                    }
                  }}
                >
                  <SelectTrigger id="prestador_valores" className="mt-2">
                    <SelectValue placeholder="Selecione o prestador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nulo">Nenhum (Nulo)</SelectItem>
                    {prestadores.map((prestador) => (
                      <SelectItem key={prestador.cpf} value={prestador.cpf}>
                        {prestador.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="valor_total" className="text-sm font-medium">Valor Total</Label>
                <Input
                  id="valor_total"
                  type="number"
                  step="0.01"
                  value={ficha?.valor_total || ""}
                  onChange={(e) => {
                    const novoValor = parseFloat(e.target.value) || 0;
                    updateFicha({ valor_total: novoValor });
                    
                    // Sincronização automática de orçamentos
                    if (ficha?.prestador_id && novoValor > 0) {
                      sincronizarOrcamentos(ficha.prestador_id);
                    }
                  }}
                  placeholder="0.00"
                  className="mt-2"
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
                  className="mt-2"
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
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="tempo_servico" className="text-sm font-medium">Tempo de Serviço</Label>
                <Input
                  id="tempo_servico"
                  value={ficha?.tempo_servico || ""}
                  onChange={(e) => updateFicha({ tempo_servico: e.target.value })}
                  placeholder="Ex: 2 horas"
                  className="mt-2"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pagamento" className="border rounded-lg shadow-md bg-card">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg">Pagamento</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-5 pt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pagamento_gerar_link"
                  checked={ficha?.pagamento_gerar_link ?? true}
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
                  <SelectTrigger id="pagamento_tipo" className="mt-2">
                    <SelectValue placeholder="Selecione a forma de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_credito">Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Débito</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
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
                  className="mt-2"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="informacoes-cliente" className="border rounded-lg shadow-md bg-card">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg">Informações do Cliente</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-5 pt-4">
              <div>
                <Label htmlFor="telefone_cliente" className="text-sm font-medium">Telefone do Cliente</Label>
                <Input
                  id="telefone_cliente"
                  value={ficha?.telefone_cliente || ""}
                  disabled
                  className="bg-muted mt-2 cursor-not-allowed"
                />
              </div>
              
              <div>
                <Label htmlFor="notas" className="text-sm font-medium">Notas Adicionais</Label>
                <Input
                  id="notas"
                  value={ficha?.notas || ""}
                  onChange={(e) => updateFicha({ notas: e.target.value })}
                  placeholder="Observações e anotações"
                  className="mt-2"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Button 
        onClick={salvarManualmente} 
        className="fixed bottom-8 right-8 shadow-2xl z-50 hover:shadow-3xl transition-shadow"
        size="lg"
      >
        <Save className="mr-2 h-5 w-5" />
        Salvar Ficha
      </Button>
    </div>
  );
};
