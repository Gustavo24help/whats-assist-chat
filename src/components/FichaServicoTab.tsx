import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Save, FileText, DollarSign, Calendar, CreditCard, User, Clock } from "lucide-react";
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

const VALID_PAGAMENTO_TIPOS = [
  "pix",
  "cartao_credito",
  "cartao_debito",
  "dinheiro",
  "boleto",
  "transferencia"
];

export const FichaServicoTab = ({ fichaId }: FichaServicoTabProps) => {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [searchPrestadorAgendamento, setSearchPrestadorAgendamento] = useState<string>('');
  const [searchPrestadorValores, setSearchPrestadorValores] = useState<string>('');
  const [dataAgendamento, setDataAgendamento] = useState<string>('');
  const [horaAgendamento, setHoraAgendamento] = useState<string>('');
  const [dataVisitaTecnica, setDataVisitaTecnica] = useState<string>('');
  const [horaVisitaTecnica, setHoraVisitaTecnica] = useState<string>('');
  const [statusAnterior, setStatusAnterior] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Função de validação de dados
  const validarDadosFicha = (fichaData: Ficha): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (fichaData.status && !STATUS_OPTIONS.includes(fichaData.status)) {
      errors.push(`Status inválido: ${fichaData.status}`);
    }
    
    if (fichaData.pagamento_tipo && !VALID_PAGAMENTO_TIPOS.includes(fichaData.pagamento_tipo)) {
      errors.push(`Tipo de pagamento inválido: ${fichaData.pagamento_tipo}`);
    }
    
    if (fichaData.motivo_perda && fichaData.motivo_perda.length > 500) {
      errors.push(`Motivo de perda muito longo (máx 500 caracteres)`);
    }
    
    if (fichaData.valor_total < 0 || fichaData.valor_mao_obra < 0 || fichaData.valor_pecas < 0) {
      errors.push(`Valores não podem ser negativos`);
    }
    
    return { valid: errors.length === 0, errors };
  };

  // Função centralizada para enviar webhook
  const enviarWebhook = async (fichaData: Ficha, agendamentoISO: string | undefined, visitaTecnicaISO: string | undefined) => {
    const webhookUrl = localStorage.getItem('webhook_ficha_atualizada');
    if (!webhookUrl) {
      console.warn("⚠️ WEBHOOK NÃO CONFIGURADO - Ficha salva mas webhook não enviado");
      toast.warning("Webhook não configurado. Configure em Configurações.");
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

      // Buscar nome do cliente
      let nomeCliente = 'Desconhecido';
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nome')
        .eq('telefone', fichaData.telefone_cliente)
        .single();
      
      if (clienteData) {
        nomeCliente = clienteData.nome;
      }

      const webhookPayload = {
        // Todos os campos da ficha
        id: fichaData.id,
        telefone_cliente: fichaData.telefone_cliente,
        nome_cliente: nomeCliente,
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
        console.error("❌ ERRO NO WEBHOOK:", {
          status: response.status,
          statusText: response.statusText,
          url: webhookUrl,
          error: errorText
        });
        toast.error(`Webhook falhou (${response.status}): ${errorText.substring(0, 100)}`);
        throw new Error(`Webhook error: ${response.status}`);
      } else {
        console.log("✅ WEBHOOK ENVIADO COM SUCESSO:", {
          url: webhookUrl,
          timestamp: new Date().toISOString()
        });
        toast.success("Webhook enviado com sucesso!");
      }
    } catch (webhookError) {
      console.error('Erro ao enviar webhook:', webhookError);
      const errorMessage = webhookError instanceof Error ? webhookError.message : 'Erro desconhecido';
      toast.error("Falha ao enviar webhook: " + errorMessage);
    }
  };

  // AutoSave SEM webhook - apenas salva no banco
  const autoSave = useMemo(
    () =>
      debounce(async (
        targetFichaId: string,
        fichaData: Ficha,
        dataAgend: string,
        horaAgend: string,
        dataVisita: string,
        horaVisita: string
      ) => {
        // Validar fichaId
        if (!targetFichaId) {
          console.error('❌ AutoSave: fichaId inválido');
          toast.error('Erro: ID da ficha não encontrado');
          return;
        }

        // Prevenir salvamentos concorrentes
        if (isSaving) {
          console.log('⏳ AutoSave cancelado: já existe um salvamento em andamento');
          return;
        }

        setIsSaving(true);

        try {
          // Validar dados
          const validation = validarDadosFicha(fichaData);
          if (!validation.valid) {
            console.error('❌ Dados inválidos:', validation.errors);
            toast.error(`Dados inválidos: ${validation.errors.join(', ')}`);
            setIsSaving(false);
            return;
          }

          // Preparar horários ISO
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

          console.log(`🔄 AutoSave iniciado para ficha ${targetFichaId}`);

          // Preparar dados limpos (trim em strings)
          const updateData = {
            nome_ficha: fichaData.nome_ficha?.trim() || null,
            descricao: fichaData.descricao?.trim() || null,
            status: fichaData.status as any,
            prestador_id: fichaData.prestador_id,
            valor_total: fichaData.valor_total,
            valor_mao_obra: fichaData.valor_mao_obra,
            valor_pecas: fichaData.valor_pecas,
            tempo_servico: fichaData.tempo_servico?.trim() || null,
            horario_agendamento: agendamentoISO,
            cpf: fichaData.cpf?.trim() || null,
            endereco: fichaData.endereco?.trim() || null,
            pagamento_tipo: fichaData.pagamento_tipo as any,
            pagamento_parcelas: fichaData.pagamento_parcelas,
            pagamento_gerar_link: fichaData.pagamento_gerar_link,
            notas: fichaData.notas?.trim() || null,
            categoria_id: fichaData.categoria_id,
            id_zoho: fichaData.id_zoho?.trim() || null,
            data_visita_tecnica: fichaData.data_visita_tecnica,
            horario_visita_tecnica: visitaTecnicaISO,
            motivo_perda: fichaData.motivo_perda?.trim()?.substring(0, 500) || null,
          };

          // Salvar no banco COM VALIDAÇÃO DE ID
          const { data: updatedData, error } = await supabase
            .from('fichas_de_servico')
            .update(updateData)
            .eq('id', targetFichaId)
            .select()
            .single();

          if (error) {
            console.error('❌ Erro detalhado ao salvar ficha:', {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
              fichaId: targetFichaId,
            });
            
            // Mensagem específica baseada no erro
            let errorMsg = 'Erro ao salvar ficha';
            if (error.message.includes('violates check constraint')) {
              errorMsg = 'Valor inválido em um dos campos';
            } else if (error.message.includes('violates foreign key')) {
              errorMsg = 'Referência inválida (prestador ou categoria)';
            } else if (error.code === '23505') {
              errorMsg = 'Valor duplicado';
            }
            
            toast.error(errorMsg);
            throw error;
          }

          // Verificar se atualizou a ficha correta
          if (updatedData && updatedData.id !== targetFichaId) {
            console.error('⚠️ AVISO: Ficha atualizada diferente da esperada!', {
              esperado: targetFichaId,
              atualizado: updatedData.id
            });
            toast.error('Erro de sincronização - recarregue a página');
          }

          console.log('✅ AutoSave concluído com sucesso para ficha:', targetFichaId);
        } catch (error) {
          console.error('❌ Erro no AutoSave:', error);
        } finally {
          setIsSaving(false);
        }
      }, 2000),
    [isSaving]
  );

  useEffect(() => {
    // ✅ Limpar IMEDIATAMENTE ao trocar de ficha
    console.log(`🔄 Trocando para ficha ${fichaId} - limpando estados`);
    setDataAgendamento('');
    setHoraAgendamento('');
    setDataVisitaTecnica('');
    setHoraVisitaTecnica('');
    setFicha(null); // Limpar ficha também
    
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
      
      // ✅ SEMPRE LIMPAR TODOS OS ESTADOS DE HORÁRIO PRIMEIRO
      console.log(`🧹 Limpando estados de horário para ficha ${fichaId}`);
      setDataAgendamento('');
      setHoraAgendamento('');
      setDataVisitaTecnica('');
      setHoraVisitaTecnica('');
      
      // ✅ DEPOIS setar apenas se existirem valores
      // Extrair data/hora do agendamento
      if (fichaCompleta.horario_agendamento) {
        const horarioStr = fichaCompleta.horario_agendamento;
        const partes = horarioStr.split('T');
        if (partes.length === 2) {
          const dataStr = partes[0];
          const horaStr = partes[1].substring(0, 5);
          console.log(`📅 Setando horário de agendamento: ${dataStr} ${horaStr}`);
          setDataAgendamento(dataStr);
          setHoraAgendamento(horaStr);
        }
      } else {
        console.log(`✅ Ficha ${fichaId} não tem horário de agendamento`);
      }

      // Extrair data/hora da visita técnica
      if (fichaCompleta.horario_visita_tecnica) {
        const horarioStr = fichaCompleta.horario_visita_tecnica;
        const partes = horarioStr.split('T');
        if (partes.length === 2) {
          const dataStr = partes[0];
          const horaStr = partes[1].substring(0, 5);
          console.log(`🔧 Setando horário de visita técnica: ${dataStr} ${horaStr}`);
          setDataVisitaTecnica(dataStr);
          setHoraVisitaTecnica(horaStr);
        }
      } else {
        console.log(`✅ Ficha ${fichaId} não tem horário de visita técnica`);
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
    if (!ficha || !fichaId) {
      console.error('❌ UpdateFicha: ficha ou fichaId inválido');
      return;
    }
    
    // Validar se é a ficha correta
    if (ficha.id !== fichaId) {
      console.error('⚠️ AVISO: ID da ficha não corresponde!', {
        fichaId,
        ficha_id: ficha.id
      });
      toast.error('Erro de sincronização - recarregue a página');
      return;
    }
    
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
      
      // Salvar no banco usando UPDATE com WHERE específico
      await supabase
        .from('fichas_de_servico')
        .update({
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
        })
        .eq('id', fichaId);
      
      // Enviar webhook
      await enviarWebhook(updatedFicha, agendamentoISO, visitaTecnicaISO);
      toast.success("Status alterado - Webhook enviado");
    } else {
      // Para outros campos, apenas autosave sem webhook
      autoSave(fichaId, updatedFicha, dataAgendamento, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica);
    }
  };

  const updateDataAgendamento = (data: string) => {
    setDataAgendamento(data);
    if (ficha) {
      autoSave(fichaId, ficha, data, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica);
    }
  };

  const updateHoraAgendamento = (hora: string) => {
    setHoraAgendamento(hora);
    if (ficha) {
      autoSave(fichaId, ficha, dataAgendamento, hora, dataVisitaTecnica, horaVisitaTecnica);
    }
  };

  const updateDataVisitaTecnica = (data: string) => {
    setDataVisitaTecnica(data);
    if (ficha) {
      const updatedFicha = { ...ficha, data_visita_tecnica: data };
      setFicha(updatedFicha);
      autoSave(fichaId, updatedFicha, dataAgendamento, horaAgendamento, data, horaVisitaTecnica);
    }
  };

  const updateHoraVisitaTecnica = (hora: string) => {
    setHoraVisitaTecnica(hora);
    if (ficha) {
      autoSave(fichaId, ficha, dataAgendamento, horaAgendamento, dataVisitaTecnica, hora);
    }
  };

  const salvarManualmente = async () => {
    if (!ficha || !fichaId) {
      console.error('❌ SalvarManualmente: ficha ou fichaId inválido');
      toast.error('Erro: ID da ficha não encontrado');
      return;
    }

    // Validar se é a ficha correta
    if (ficha.id !== fichaId) {
      console.error('⚠️ AVISO: ID da ficha não corresponde!', {
        fichaId,
        ficha_id: ficha.id
      });
      toast.error('Erro de sincronização - recarregue a página');
      return;
    }

    // Prevenir salvamentos concorrentes
    if (isSaving) {
      console.log('⏳ SalvarManualmente cancelado: já existe um salvamento em andamento');
      toast.warning('Aguarde o salvamento anterior finalizar');
      return;
    }

    setIsSaving(true);

    try {
      // Validar dados
      const validation = validarDadosFicha(ficha);
      if (!validation.valid) {
        console.error('❌ Dados inválidos:', validation.errors);
        toast.error(`Dados inválidos: ${validation.errors.join(', ')}`);
        setIsSaving(false);
        return;
      }

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
      
      console.log(`💾 Salvamento manual para ficha ${fichaId}:`, { agendamentoISO, visitaTecnicaISO });
      
      // Preparar dados limpos (trim em strings)
      const updateData = {
        nome_ficha: ficha.nome_ficha?.trim() || null,
        descricao: ficha.descricao?.trim() || null,
        status: ficha.status as any,
        prestador_id: ficha.prestador_id,
        valor_total: ficha.valor_total,
        valor_mao_obra: ficha.valor_mao_obra,
        valor_pecas: ficha.valor_pecas,
        tempo_servico: ficha.tempo_servico?.trim() || null,
        horario_agendamento: agendamentoISO,
        cpf: ficha.cpf?.trim() || null,
        endereco: ficha.endereco?.trim() || null,
        pagamento_tipo: ficha.pagamento_tipo as any,
        pagamento_parcelas: ficha.pagamento_parcelas,
        pagamento_gerar_link: ficha.pagamento_gerar_link,
        notas: ficha.notas?.trim() || null,
        categoria_id: ficha.categoria_id,
        id_zoho: ficha.id_zoho?.trim() || null,
        data_visita_tecnica: ficha.data_visita_tecnica,
        horario_visita_tecnica: visitaTecnicaISO,
        motivo_perda: ficha.motivo_perda?.trim()?.substring(0, 500) || null,
      };

      const { data: updatedData, error } = await supabase
        .from('fichas_de_servico')
        .update(updateData)
        .eq('id', fichaId)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro detalhado ao salvar ficha:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          fichaId: fichaId,
        });
        
        // Mensagem específica baseada no erro
        let errorMsg = 'Erro ao salvar ficha';
        if (error.message.includes('violates check constraint')) {
          errorMsg = 'Valor inválido em um dos campos';
        } else if (error.message.includes('violates foreign key')) {
          errorMsg = 'Referência inválida (prestador ou categoria)';
        } else if (error.code === '23505') {
          errorMsg = 'Valor duplicado';
        }
        
        toast.error(errorMsg);
        throw error;
      }

      // Verificar se atualizou a ficha correta
      if (updatedData && updatedData.id !== fichaId) {
        console.error('⚠️ AVISO: Ficha atualizada diferente da esperada!', {
          esperado: fichaId,
          atualizado: updatedData.id
        });
        toast.error('Erro de sincronização - recarregue a página');
      }

      console.log('✅ Ficha salva manualmente com sucesso');

      // Enviar webhook ao salvar manualmente
      await enviarWebhook(ficha, agendamentoISO, visitaTecnicaISO);

      toast.success("Ficha salva com sucesso!");
    } catch (error) {
      console.error('❌ Erro ao salvar ficha:', error);
    } finally {
      setIsSaving(false);
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

  const filteredPrestadoresAgendamento = prestadores.filter(p => 
    p.nome.toLowerCase().includes(searchPrestadorAgendamento.toLowerCase())
  );

  const filteredPrestadoresValores = prestadores.filter(p => 
    p.nome.toLowerCase().includes(searchPrestadorValores.toLowerCase())
  );

  return (
    <div className="space-y-3 pb-20 px-3">
      {/* Status fora das sanfonas */}
      <div className="bg-card border rounded-lg shadow-sm p-2.5 hover:bg-muted/20 transition-colors w-full max-w-[380px]">
        <Label htmlFor="status" className="text-xs font-medium text-gray-600">Status do Serviço</Label>
        <Select
          value={ficha?.status || "Ficha Criada"}
          onValueChange={(value) => updateFicha({ status: value })}
        >
          <SelectTrigger id="status" className="mt-1.5 h-9 text-sm focus:ring-2 focus:ring-primary/20">
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

      <Accordion type="single" collapsible defaultValue="" className="w-full max-w-[380px] space-y-2">
        <AccordionItem value="informacoes-gerais" className="border rounded-lg shadow-sm bg-card hover:bg-muted/20 transition-colors">
          <AccordionTrigger className="px-2.5 py-2.5 hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-gray-700">Informações Gerais</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-2.5 pb-2.5">
            <div className="space-y-2 w-full">
              <div>
                <Label htmlFor="nome_ficha" className="text-xs font-medium text-gray-600">Nome da Ficha</Label>
                <Input
                  id="nome_ficha"
                  value={ficha?.nome_ficha || ""}
                  disabled
                  className="mt-1 h-9 text-sm bg-muted cursor-not-allowed"
                />
              </div>

              <div>
                <Label htmlFor="id_zoho" className="text-xs font-medium text-gray-600">ID Zoho</Label>
                <Input
                  id="id_zoho"
                  value={ficha?.id_zoho || ""}
                  disabled
                  placeholder="Não atribuído"
                  className="mt-1 h-9 text-sm bg-muted cursor-not-allowed"
                />
              </div>

              <div>
                <Label htmlFor="descricao" className="text-xs font-medium text-gray-600">Descrição</Label>
                <Input
                  id="descricao"
                  value={ficha?.descricao || ""}
                  onChange={(e) => updateFicha({ descricao: e.target.value })}
                  placeholder="Descrição do serviço"
                  className="mt-1 h-9 text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <Label htmlFor="motivo_perda" className="text-xs font-medium text-gray-600">Motivo de Perda</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Input
                      id="motivo_perda"
                      value={ficha?.motivo_perda || ""}
                      onChange={(e) => updateFicha({ motivo_perda: e.target.value })}
                      placeholder="Digite ou selecione um motivo"
                      className="mt-1 h-9 text-sm focus:ring-2 focus:ring-primary/20 cursor-text"
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-[340px] p-0" align="start">
                    <Command>
                      <CommandGroup>
                        <CommandItem 
                          onSelect={() => updateFicha({ motivo_perda: "Valor (Muito caro)" })}
                          className="cursor-pointer"
                        >
                          Valor (Muito caro)
                        </CommandItem>
                        <CommandItem 
                          onSelect={() => updateFicha({ motivo_perda: "Não temos a especialidade" })}
                          className="cursor-pointer"
                        >
                          Não temos a especialidade
                        </CommandItem>
                        <CommandItem 
                          onSelect={() => updateFicha({ motivo_perda: "Demora de resposta" })}
                          className="cursor-pointer"
                        >
                          Demora de resposta
                        </CommandItem>
                        <CommandItem 
                          onSelect={() => updateFicha({ motivo_perda: "Fechou com outra pessoa" })}
                          className="cursor-pointer"
                        >
                          Fechou com outra pessoa
                        </CommandItem>
                        <CommandItem 
                          onSelect={() => updateFicha({ motivo_perda: "Sumiu após orçamento" })}
                          className="cursor-pointer"
                        >
                          Sumiu após orçamento
                        </CommandItem>
                        <CommandItem 
                          onSelect={() => updateFicha({ motivo_perda: "Outro motivo" })}
                          className="cursor-pointer"
                        >
                          Outro motivo
                        </CommandItem>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="agendamento" className="border rounded-lg shadow-sm bg-card hover:bg-muted/20 transition-colors">
          <AccordionTrigger className="px-2.5 py-2.5 hover:no-underline">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-gray-700">Agendamento</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-2.5 pb-2.5">
            <div className="space-y-2 w-full">
              <div className="space-y-1.5">
                <Label htmlFor="prestador_id" className="text-xs font-medium text-gray-600">Prestador de Serviço</Label>
                <Select
                  value={ficha?.prestador_id || "nulo"}
                  onValueChange={(value) => updateFicha({ prestador_id: value === "nulo" ? null : value })}
                >
                  <SelectTrigger id="prestador_id" className="h-9 text-sm focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Selecione o prestador" />
                  </SelectTrigger>
                  <SelectContent className="z-[100] bg-popover max-h-[300px]">
                    <div className="sticky top-0 bg-popover z-10 p-2 border-b">
                      <Input
                        type="text"
                        placeholder="Pesquisar prestador..."
                        value={searchPrestadorAgendamento}
                        onChange={(e) => setSearchPrestadorAgendamento(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        autoFocus={false}
                        className="h-8 text-sm bg-popover border focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <SelectItem value="nulo">Nenhum (Nulo)</SelectItem>
                    {filteredPrestadoresAgendamento.length > 0 ? (
                      filteredPrestadoresAgendamento.map((prestador) => (
                        <SelectItem key={prestador.cpf} value={prestador.cpf}>
                          {prestador.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                        Nenhum prestador encontrado
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Agendamento do Serviço
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <div>
                    <Label htmlFor="data_agendamento" className="text-[10px] text-muted-foreground">Data</Label>
                    <Input
                      id="data_agendamento"
                      type="date"
                      value={dataAgendamento}
                      onChange={(e) => updateDataAgendamento(e.target.value)}
                      className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hora_agendamento" className="text-[10px] text-muted-foreground">Horário</Label>
                    <Input
                      id="hora_agendamento"
                      type="time"
                      value={horaAgendamento}
                      onChange={(e) => updateHoraAgendamento(e.target.value)}
                      className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t">
                <Label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Visita Técnica
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <div>
                    <Label htmlFor="data_visita_tecnica" className="text-[10px] text-muted-foreground">Data</Label>
                    <Input
                      id="data_visita_tecnica"
                      type="date"
                      value={dataVisitaTecnica}
                      onChange={(e) => updateDataVisitaTecnica(e.target.value)}
                      className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hora_visita_tecnica" className="text-[10px] text-muted-foreground">Horário</Label>
                    <Input
                      id="hora_visita_tecnica"
                      type="time"
                      value={horaVisitaTecnica}
                      onChange={(e) => updateHoraVisitaTecnica(e.target.value)}
                      className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="valores" className="border rounded-lg shadow-sm bg-card hover:bg-muted/20 transition-colors">
          <AccordionTrigger className="px-2.5 py-2.5 hover:no-underline">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-gray-700">Valores</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-2.5 pb-2.5">
            <div className="space-y-2 w-full">
              <div className="space-y-1.5">
                <Label htmlFor="prestador_valores" className="text-xs font-medium text-gray-600">Prestador de Serviço</Label>
                <Select
                  value={ficha?.prestador_id || "nulo"}
                  onValueChange={(value) => {
                    const prestadorValue = value === "nulo" ? null : value;
                    updateFicha({ prestador_id: prestadorValue });
                    
                    if (prestadorValue && ficha?.valor_total && ficha.valor_total > 0) {
                      sincronizarOrcamentos(prestadorValue);
                    }
                  }}
                >
                  <SelectTrigger id="prestador_valores" className="h-9 text-sm focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Selecione o prestador" />
                  </SelectTrigger>
                  <SelectContent className="z-[100] bg-popover max-h-[300px]">
                    <div className="sticky top-0 bg-popover z-10 p-2 border-b">
                      <Input
                        type="text"
                        placeholder="Pesquisar prestador..."
                        value={searchPrestadorValores}
                        onChange={(e) => setSearchPrestadorValores(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        autoFocus={false}
                        className="h-8 text-sm bg-popover border focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <SelectItem value="nulo">Nenhum (Nulo)</SelectItem>
                    {filteredPrestadoresValores.length > 0 ? (
                      filteredPrestadoresValores.map((prestador) => (
                        <SelectItem key={prestador.cpf} value={prestador.cpf}>
                          {prestador.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                        Nenhum prestador encontrado
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="valor_total" className="text-xs font-medium text-gray-600">Valor Total</Label>
                <Input
                  id="valor_total"
                  type="number"
                  step="0.01"
                  value={ficha?.valor_total || ""}
                  onChange={(e) => {
                    const novoValor = parseFloat(e.target.value) || 0;
                    updateFicha({ valor_total: novoValor });
                    
                    if (ficha?.prestador_id && novoValor > 0) {
                      sincronizarOrcamentos(ficha.prestador_id);
                    }
                  }}
                  placeholder="0.00"
                  className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="valor_mao_obra" className="text-xs font-medium text-gray-600">Valor Mão de Obra</Label>
                <Input
                  id="valor_mao_obra"
                  type="number"
                  step="0.01"
                  value={ficha?.valor_mao_obra || ""}
                  onChange={(e) => updateFicha({ valor_mao_obra: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="valor_pecas" className="text-xs font-medium text-gray-600">Valor Peças</Label>
                <Input
                  id="valor_pecas"
                  type="number"
                  step="0.01"
                  value={ficha?.valor_pecas || ""}
                  onChange={(e) => updateFicha({ valor_pecas: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tempo_servico" className="text-xs font-medium text-gray-600">Tempo de Serviço</Label>
                <Input
                  id="tempo_servico"
                  value={ficha?.tempo_servico || ""}
                  onChange={(e) => updateFicha({ tempo_servico: e.target.value })}
                  placeholder="Ex: 2 horas"
                  className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pagamento" className="border rounded-lg shadow-sm bg-card hover:bg-muted/20 transition-colors">
          <AccordionTrigger className="px-2.5 py-2.5 hover:no-underline">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-gray-700">Pagamento</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-2.5 pb-2.5">
            <div className="space-y-2 w-full">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pagamento_gerar_link"
                  checked={ficha?.pagamento_gerar_link ?? true}
                  onCheckedChange={(checked) => updateFicha({ pagamento_gerar_link: checked as boolean })}
                />
                <Label htmlFor="pagamento_gerar_link" className="cursor-pointer text-xs font-medium text-gray-600">
                  Gerar link de pagamento
                </Label>
              </div>

              <div>
                <Label htmlFor="pagamento_tipo" className="text-xs font-medium text-gray-600">Forma de Pagamento</Label>
                <Select
                  value={ficha?.pagamento_tipo || ""}
                  onValueChange={(value) => updateFicha({ pagamento_tipo: value })}
                >
                  <SelectTrigger id="pagamento_tipo" className="mt-1 h-9 text-sm focus:ring-2 focus:ring-primary/20">
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
                <Label htmlFor="pagamento_parcelas" className="text-xs font-medium text-gray-600">Número de Parcelas</Label>
                <Input
                  id="pagamento_parcelas"
                  type="number"
                  min="1"
                  value={ficha?.pagamento_parcelas || 1}
                  onChange={(e) => updateFicha({ pagamento_parcelas: parseInt(e.target.value) || 1 })}
                  className="mt-1 h-9 text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="informacoes-cliente" className="border rounded-lg shadow-sm bg-card hover:bg-muted/20 transition-colors">
          <AccordionTrigger className="px-2.5 py-2.5 hover:no-underline">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-gray-700">Informações do Cliente</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-2.5 pb-2.5">
            <div className="space-y-2 w-full">
              <div>
                <Label htmlFor="telefone_cliente" className="text-xs font-medium text-gray-600">Telefone do Cliente</Label>
                <Input
                  id="telefone_cliente"
                  value={ficha?.telefone_cliente || ""}
                  disabled
                  className="bg-muted mt-1 h-9 text-sm cursor-not-allowed"
                />
              </div>

              <div>
                <Label htmlFor="cpf" className="text-xs font-medium text-gray-600">CPF do Cliente</Label>
                <Input
                  id="cpf"
                  value={ficha?.cpf || ""}
                  onChange={(e) => updateFicha({ cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="mt-1 h-9 text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <Label htmlFor="endereco" className="text-xs font-medium text-gray-600">Endereço</Label>
                <Input
                  id="endereco"
                  value={ficha?.endereco || ""}
                  onChange={(e) => updateFicha({ endereco: e.target.value })}
                  placeholder="Endereço completo"
                  className="mt-1 h-9 text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>
              
              <div>
                <Label htmlFor="notas" className="text-xs font-medium text-gray-600">Notas Adicionais</Label>
                <Input
                  id="notas"
                  value={ficha?.notas || ""}
                  onChange={(e) => updateFicha({ notas: e.target.value })}
                  placeholder="Observações e anotações"
                  className="mt-1 h-9 text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Button 
        onClick={salvarManualmente} 
        className="fixed bottom-6 right-6 shadow-2xl z-50 hover:scale-[0.98] active:scale-95 active:animate-pulse transition-all h-10 text-sm"
      >
        <Save className="mr-2 h-4 w-4" />
        Salvar Ficha
      </Button>
    </div>
  );
};
