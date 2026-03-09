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
import { Save, FileText, DollarSign, Calendar, CreditCard, User, Clock, X, Copy, Check, XCircle, Loader2, Link } from "lucide-react";
import { toast } from "sonner";
import debounce from "lodash-es/debounce";
import { ReciboGenerator } from "@/components/ReciboGenerator";
import { ResumoConversaDialog } from "@/components/ResumoConversaDialog";
import { PopupConfirmacaoFinanceira } from "@/components/PopupConfirmacaoFinanceira";

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
  bairro: string | null;
  cidade: string | null;
  nome_cliente: string | null;
  pagamento_tipo: string | null;
  pagamento_parcelas: number;
  pagamento_gerar_link: boolean;
  pagamento_link: string | null;
  pagamento_realizado: boolean;
  notas: string | null;
  categoria_id: number | null;
  id_zoho: string | null;
  data_visita_tecnica: string | null;
  horario_visita_tecnica: string | null;
  motivo_perda: string | null;
  preferencia_horario_cliente: string | null;
  recibo_url: string | null;
  comparecimento_prestador: string | null;
  created_at: string;
  updated_at: string;
  data_version: number | null; // 1=formato antigo, 2=formato novo com timezone
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

const COMPARECIMENTO_PRESTADOR_OPTIONS = [
  "Foi",
  "Atrasou",
  "Atrasou e avisou",
  "Não foi",
  "Não foi e avisou"
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
  const [nomeCliente, setNomeCliente] = useState<string>('');
  const [financeiroOpen, setFinanceiroOpen] = useState(false);
  const [gerandoLink, setGerandoLink] = useState(false);

  // Função de validação de dados
  const validarDadosFicha = (fichaData: Ficha): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (fichaData.status && !STATUS_OPTIONS.includes(fichaData.status)) {
      errors.push(`Status inválido: ${fichaData.status}`);
    }
    
    if (fichaData.pagamento_tipo && !VALID_PAGAMENTO_TIPOS.includes(fichaData.pagamento_tipo)) {
      errors.push(`Tipo de pagamento inválido: ${fichaData.pagamento_tipo}`);
    }

    if (
      fichaData.comparecimento_prestador &&
      !COMPARECIMENTO_PRESTADOR_OPTIONS.includes(fichaData.comparecimento_prestador)
    ) {
      errors.push(`Comparecimento do prestador inválido: ${fichaData.comparecimento_prestador}`);
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
    // Buscar webhook do banco
    const { data: config } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'webhook_ficha_atualizada')
      .single();
    
    const webhookUrl = config?.valor;
    
    if (!webhookUrl) {
      console.warn("⚠️ WEBHOOK NÃO CONFIGURADO - Ficha salva mas webhook não enviado");
      toast.warning("Webhook não configurado. Configure em Configurações.");
      return;
    }

    try {
      // Buscar id_crm do prestador diretamente do banco
      let prestadorIdCrm = null;
      let prestadorCpf = null;
      
      if (fichaData.prestador_id) {
        prestadorCpf = fichaData.prestador_id; // CPF é a chave primária
        
        console.log('🔍 Buscando id_crm do prestador no banco:', prestadorCpf);
        
        const { data: prestadorData, error: prestadorError } = await supabase
          .from('prestadores')
          .select('id_crm')
          .eq('cpf', fichaData.prestador_id)
          .single();
        
        if (prestadorError) {
          console.error('❌ Erro ao buscar prestador:', prestadorError);
        }
        
        if (prestadorData) {
          prestadorIdCrm = prestadorData.id_crm;
          console.log('✅ ID CRM encontrado:', prestadorIdCrm);
          
          if (!prestadorIdCrm) {
            console.warn('⚠️ AVISO: Prestador não tem id_crm cadastrado!', {
              cpf: prestadorCpf,
              fichaId: fichaData.id
            });
            // Apenas log, sem toast para não incomodar o usuário a cada salvamento
          }
        } else {
          console.warn('⚠️ Prestador não encontrado no banco:', prestadorCpf);
        }
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
        pagamento_link: fichaData.pagamento_link,
        pagamento_realizado: fichaData.pagamento_realizado,
        // Outros
        id_zoho: fichaData.id_zoho,
        notas: fichaData.notas,
        motivo_perda: fichaData.motivo_perda,
        comparecimento_prestador: fichaData.comparecimento_prestador,
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

  // Função única para salvar e enviar webhook
  const salvarFichaEEnviarWebhook = async (
    targetFichaId: string,
    fichaData: Ficha,
    dataAgend: string,
    horaAgend: string,
    dataVisita: string,
    horaVisita: string
  ) => {
    if (!targetFichaId) {
      console.error('❌ Salvamento: fichaId inválido');
      toast.error('Erro: ID da ficha não encontrado');
      return;
    }

    try {
      // Validar dados
      const validation = validarDadosFicha(fichaData);
      if (!validation.valid) {
        console.error('❌ Dados inválidos:', validation.errors);
        toast.error(`Dados inválidos: ${validation.errors.join(', ')}`);
        return;
      }

      // ✅ Salvar com timezone explícito de Brasília (-03:00) para evitar confusão futura
      let agendamentoISO: string | null = null;
      if (dataAgend && dataAgend.trim() && horaAgend && horaAgend.trim()) {
        agendamentoISO = `${dataAgend}T${horaAgend}:00-03:00`;
      } else if (dataAgend && dataAgend.trim()) {
        agendamentoISO = `${dataAgend}T00:00:00-03:00`;
      }

      let visitaTecnicaISO: string | null = null;
      if (dataVisita && dataVisita.trim() && horaVisita && horaVisita.trim()) {
        visitaTecnicaISO = `${dataVisita}T${horaVisita}:00-03:00`;
      } else if (dataVisita && dataVisita.trim()) {
        visitaTecnicaISO = `${dataVisita}T00:00:00-03:00`;
      }

      console.log(`💾 Salvando ficha ${targetFichaId} - agendamento: ${agendamentoISO}, visita: ${visitaTecnicaISO}`);

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
        bairro: fichaData.bairro?.trim() || null,
        cidade: fichaData.cidade?.trim() || null,
        nome_cliente: fichaData.nome_cliente?.trim() || null,
        pagamento_tipo: fichaData.pagamento_tipo as any,
        pagamento_parcelas: fichaData.pagamento_parcelas,
        pagamento_gerar_link: fichaData.pagamento_gerar_link,
        pagamento_link: fichaData.pagamento_link?.trim() || null,
        pagamento_realizado: fichaData.pagamento_realizado,
        notas: fichaData.notas?.trim() || null,
        categoria_id: fichaData.categoria_id,
        id_zoho: fichaData.id_zoho?.trim() || null,
        data_visita_tecnica: fichaData.data_visita_tecnica,
        horario_visita_tecnica: visitaTecnicaISO,
        motivo_perda: fichaData.motivo_perda?.trim()?.substring(0, 500) || null,
        comparecimento_prestador: fichaData.comparecimento_prestador,
      };

      const { error } = await supabase
        .from('fichas_de_servico')
        .update(updateData)
        .eq('id', targetFichaId);

      if (error) {
        console.error('❌ Erro ao salvar ficha:', error);
        let errorMsg = 'Erro ao salvar ficha';
        if (error.message.includes('violates check constraint')) {
          errorMsg = 'Valor inválido em um dos campos';
        } else if (error.message.includes('violates foreign key')) {
          errorMsg = 'Referência inválida (prestador ou categoria)';
        }
        toast.error(errorMsg);
        throw error;
      }

      // Salvar CPF e Endereço também no cadastro do cliente (para reutilizar em futuras fichas)
      const cpfTrimmed = fichaData.cpf?.trim() || null;
      const enderecoTrimmed = fichaData.endereco?.trim() || null;
      
      if (cpfTrimmed || enderecoTrimmed) {
        const clienteUpdate: Record<string, string | null> = {};
        if (cpfTrimmed) clienteUpdate.cpf = cpfTrimmed;
        if (enderecoTrimmed) clienteUpdate.endereco = enderecoTrimmed;
        
        const { error: clienteError } = await supabase
          .from('clientes')
          .update(clienteUpdate)
          .eq('telefone', fichaData.telefone_cliente);
        
        if (clienteError) {
          console.error('⚠️ Erro ao salvar dados no cliente:', clienteError);
        } else {
          console.log('✅ CPF/Endereço salvos no cadastro do cliente');
        }
      }

      console.log('✅ Ficha salva, enviando webhook...');
      await enviarWebhook(fichaData, agendamentoISO, visitaTecnicaISO);
    } catch (error) {
      console.error('❌ Erro no salvamento:', error);
    }
  };

  // AutoSave com debounce ✅ REDUZIDO DE 2000ms PARA 500ms
  const autoSave = useMemo(
    () =>
      debounce(
        (
          targetFichaId: string,
          fichaData: Ficha,
          dataAgend: string,
          horaAgend: string,
          dataVisita: string,
          horaVisita: string
        ) => {
          salvarFichaEEnviarWebhook(targetFichaId, fichaData, dataAgend, horaAgend, dataVisita, horaVisita);
        },
        500
      ),
    []
  );

  useEffect(() => {
    // ✅ CANCELAR DEBOUNCE PENDENTE
    autoSave.cancel();
    
    // ✅ Limpar IMEDIATAMENTE ao trocar de ficha
    console.log(`🔄 Trocando para ficha ${fichaId} - limpando estados`);
    setFicha(null);
    setDataAgendamento('');
    setHoraAgendamento('');
    setDataVisitaTecnica('');
    setHoraVisitaTecnica('');
    
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
      let fichaCompleta: Ficha = {
        ...(data as any),
        data_visita_tecnica: (data as any).data_visita_tecnica || null,
        horario_visita_tecnica: (data as any).horario_visita_tecnica || null,
        motivo_perda: (data as any).motivo_perda || null,
        preferencia_horario_cliente: (data as any).preferencia_horario_cliente || null,
        recibo_url: (data as any).recibo_url || null,
      };
      
      // Buscar dados do cliente (nome, cpf, endereco)
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nome, cpf, endereco')
        .eq('telefone', fichaCompleta.telefone_cliente)
        .single();
      
      if (clienteData) {
        setNomeCliente(clienteData.nome);
        
        // Se a ficha não tem CPF/Endereço mas o cliente tem, preencher automaticamente
        if (!fichaCompleta.cpf && clienteData.cpf) {
          fichaCompleta = { ...fichaCompleta, cpf: clienteData.cpf };
          console.log('📋 CPF preenchido do cadastro do cliente:', clienteData.cpf);
        }
        if (!fichaCompleta.endereco && clienteData.endereco) {
          fichaCompleta = { ...fichaCompleta, endereco: clienteData.endereco };
          console.log('📋 Endereço preenchido do cadastro do cliente:', clienteData.endereco);
        }
      }
      
      setFicha(fichaCompleta);
      
      // ✅ SEMPRE LIMPAR TODOS OS ESTADOS DE HORÁRIO PRIMEIRO
      console.log(`🧹 Limpando estados de horário para ficha ${fichaId}`);
      setDataAgendamento('');
      setHoraAgendamento('');
      setDataVisitaTecnica('');
      setHoraVisitaTecnica('');
      
      // ✅ SIMPLIFICADO: Carregar exatamente como está no banco, sem conversão de timezone
      // Função auxiliar para parsear horário com detecção de timezone
      const parsearHorarioComTimezone = (horario: string): { data: string; hora: string } | null => {
        try {
          // Detectar se tem timezone UTC (+00 ou Z)
          const temTimezoneUTC = horario.includes('+00') || horario.endsWith('Z');
          // Detectar se tem timezone Brasília (-03:00 ou -03)
          const temTimezoneBrasilia = horario.includes('-03');
          
          if (temTimezoneUTC) {
            // Converter UTC -> Brasília (subtrair 3 horas)
            const dataUtc = new Date(horario);
            const dataBrasilia = new Date(dataUtc.getTime() - (3 * 60 * 60 * 1000));
            const dataStr = dataBrasilia.toISOString().split('T')[0];
            const horaStr = dataBrasilia.toISOString().split('T')[1].substring(0, 5);
            console.log(`🔄 Convertendo UTC -> Brasília: ${horario} -> ${dataStr} ${horaStr}`);
            return { data: dataStr, hora: horaStr };
          } else if (temTimezoneBrasilia) {
            // Já está em Brasília, extrair diretamente
            const normalizado = horario.replace(' ', 'T');
            const partes = normalizado.split('T');
            if (partes.length >= 2) {
              const dataStr = partes[0];
              const horaStr = partes[1].substring(0, 5);
              console.log(`✅ Já em Brasília: ${horario} -> ${dataStr} ${horaStr}`);
              return { data: dataStr, hora: horaStr };
            }
          } else {
            // Sem timezone, usar direto
            const normalizado = horario.replace(' ', 'T');
            const partes = normalizado.split('T');
            if (partes.length >= 2) {
              const dataStr = partes[0];
              const horaStr = partes[1].substring(0, 5);
              console.log(`📝 Sem timezone, usando direto: ${horario} -> ${dataStr} ${horaStr}`);
              return { data: dataStr, hora: horaStr };
            }
          }
        } catch (e) {
          console.error('Erro ao parsear horário:', e);
        }
        return null;
      };

      // Extrair data/hora do agendamento
      if (fichaCompleta.horario_agendamento) {
        const resultado = parsearHorarioComTimezone(fichaCompleta.horario_agendamento);
        if (resultado) {
          setDataAgendamento(resultado.data);
          setHoraAgendamento(resultado.hora);
        }
      } else {
        console.log(`✅ Ficha ${fichaId} não tem horário de agendamento`);
      }

      // Extrair data/hora da visita técnica
      if (fichaCompleta.horario_visita_tecnica) {
        const resultado = parsearHorarioComTimezone(fichaCompleta.horario_visita_tecnica);
        if (resultado) {
          setDataVisitaTecnica(resultado.data);
          setHoraVisitaTecnica(resultado.hora);
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

  const updateFicha = (updates: Partial<Ficha>) => {
    if (!ficha || !fichaId) {
      console.error('❌ UpdateFicha: ficha ou fichaId inválido');
      return;
    }
    
    if (ficha.id !== fichaId) {
      console.error('⚠️ AVISO: ID da ficha não corresponde!');
      toast.error('Erro de sincronização - recarregue a página');
      return;
    }
    
    const updatedFicha = { ...ficha, ...updates };
    setFicha(updatedFicha);
    
    // Auto-save em mudança de STATUS
    if (updates.status && updates.status !== ficha.status) {
      console.log('📊 Status mudou, salvando automaticamente:', updates.status);
      autoSave(fichaId, updatedFicha, dataAgendamento, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica);
    }
    
    // Auto-save quando pagamento_gerar_link mudar (dispara webhook para Make.com criar link)
    if (updates.pagamento_gerar_link !== undefined && updates.pagamento_gerar_link !== ficha.pagamento_gerar_link) {
      console.log('💳 pagamento_gerar_link mudou, salvando automaticamente:', updates.pagamento_gerar_link);
      autoSave(fichaId, updatedFicha, dataAgendamento, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica);
    }
  };

  const updateDataAgendamento = (data: string) => {
    setDataAgendamento(data);
    // REMOVIDO: autoSave (salva apenas ao mudar status, aprovar orçamento, ou salvar manualmente)
  };

  const updateHoraAgendamento = (hora: string) => {
    setHoraAgendamento(hora);
    // REMOVIDO: autoSave (salva apenas ao mudar status, aprovar orçamento, ou salvar manualmente)
  };

  const updateDataVisitaTecnica = (data: string) => {
    setDataVisitaTecnica(data);
    if (ficha) {
      const updatedFicha = { ...ficha, data_visita_tecnica: data };
      setFicha(updatedFicha);
      // REMOVIDO: autoSave (salva apenas ao mudar status, aprovar orçamento, ou salvar manualmente)
    }
  };

  const updateHoraVisitaTecnica = (hora: string) => {
    setHoraVisitaTecnica(hora);
    // REMOVIDO: autoSave (salva apenas ao mudar status, aprovar orçamento, ou salvar manualmente)
  };

  // Debounced update para nome do cliente
  const debouncedUpdateNomeCliente = useMemo(
    () =>
      debounce(async (novoNome: string, telefone: string) => {
        console.log('💾 Salvando nome do cliente (debounced):', novoNome);
        
        try {
          const { error } = await supabase
            .from('clientes')
            .update({ nome: novoNome })
            .eq('telefone', telefone);
          
          if (error) {
            console.error('❌ Erro ao atualizar nome:', error);
            toast.error('Erro ao atualizar nome do cliente');
          } else {
            toast.success('Nome do cliente atualizado');
          }
        } catch (error) {
          console.error('❌ Erro:', error);
          toast.error('Erro ao atualizar nome do cliente');
        }
      }, 1500), // 1.5 segundos de debounce
    []
  );

  const updateNomeCliente = (novoNome: string) => {
    setNomeCliente(novoNome); // Atualiza UI imediatamente
    
    if (!ficha?.telefone_cliente) return;
    
    // Cancela o debounce anterior e agenda novo
    debouncedUpdateNomeCliente(novoNome, ficha.telefone_cliente);
  };

  const limparAgendamento = () => {
    console.log('🧹 Limpando agendamento manualmente');
    setDataAgendamento('');
    setHoraAgendamento('');
    
    if (ficha) {
      const updatedFicha = { ...ficha, horario_agendamento: null };
      setFicha(updatedFicha);
      autoSave(fichaId, updatedFicha, '', '', dataVisitaTecnica, horaVisitaTecnica);
    }
    
    toast.success('Agendamento limpo');
  };

  const limparVisitaTecnica = () => {
    console.log('🧹 Limpando visita técnica manualmente');
    setDataVisitaTecnica('');
    setHoraVisitaTecnica('');
    
    if (ficha) {
      const updatedFicha = { 
        ...ficha, 
        horario_visita_tecnica: null,
        data_visita_tecnica: null 
      };
      setFicha(updatedFicha);
      autoSave(fichaId, updatedFicha, dataAgendamento, horaAgendamento, '', '');
    }
    
    toast.success('Visita técnica limpa');
  };

  const salvarManualmente = async () => {
    if (!ficha || !fichaId) {
      console.error('❌ SalvarManualmente: ficha ou fichaId inválido');
      toast.error('Erro: ID da ficha não encontrado');
      return;
    }

    if (ficha.id !== fichaId) {
      console.error('⚠️ AVISO: ID da ficha não corresponde!');
      toast.error('Erro de sincronização - recarregue a página');
      return;
    }

    console.log('💾 Salvamento manual disparado');
    await salvarFichaEEnviarWebhook(fichaId, ficha, dataAgendamento, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica);
    toast.success("Ficha salva com sucesso!");
  };

  // Função de sincronização que recebe valores diretamente (não usa estado)
  const sincronizarOrcamentosInterno = async (
    prestadorCpf: string, 
    valorTotal: number,
    valorMaoObra: number,
    valorPecas: number
  ) => {
    if (valorTotal <= 0) return;

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
        // Criar e aprovar orçamento automaticamente com valores passados diretamente
        const { error: criarError } = await supabase
          .from('orcamentos')
          .insert({
            ficha_nome: fichaId,
            prestador_cpf: prestadorCpf,
            valor_total: valorTotal,
            valor_mao_obra: valorMaoObra,
            valor_pecas: valorPecas,
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

  // Versão com debounce para evitar múltiplas chamadas durante digitação (1.5s de delay)
  const debouncedSincronizarOrcamentos = useMemo(
    () => debounce((
      prestadorCpf: string, 
      valorTotal: number, 
      valorMaoObra: number, 
      valorPecas: number
    ) => {
      sincronizarOrcamentosInterno(prestadorCpf, valorTotal, valorMaoObra, valorPecas);
    }, 1500),
    [fichaId]
  );

  // Função wrapper para uso imediato (quando seleciona prestador)
  const sincronizarOrcamentosImediato = (prestadorCpf: string) => {
    if (!ficha || !ficha.valor_total || ficha.valor_total <= 0) return;
    sincronizarOrcamentosInterno(
      prestadorCpf, 
      ficha.valor_total, 
      ficha.valor_mao_obra || 0, 
      ficha.valor_pecas || 0
    );
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
      {/* Header com Status e Botão Resumir */}
      <div className="flex items-start gap-2 w-full max-w-[380px]">
        <div className="bg-card border rounded-lg shadow-sm p-2.5 hover:bg-muted/20 transition-colors flex-1">
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
        
        {/* Botão Gerar Resumo */}
        <div className="pt-5">
          <ResumoConversaDialog 
            fichaId={fichaId} 
            fichaName={ficha?.nome_ficha || undefined}
          />
        </div>
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
                          onSelect={() => updateFicha({ motivo_perda: "Não chegou orçamento" })}
                          className="cursor-pointer"
                        >
                          Não chegou orçamento
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
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Agendamento do Serviço
                  </Label>
                  {(dataAgendamento || horaAgendamento) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={limparAgendamento}
                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                      title="Limpar agendamento"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
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
                
                {ficha?.preferencia_horario_cliente && (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                    <Label className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 mb-1 block">
                      Preferência de horário do cliente:
                    </Label>
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      {ficha.preferencia_horario_cliente}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Visita Técnica
                  </Label>
                  {(dataVisitaTecnica || horaVisitaTecnica) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={limparVisitaTecnica}
                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                      title="Limpar visita técnica"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
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

        <AccordionItem value="comparecimento-prestador" className="border rounded-lg shadow-sm bg-card hover:bg-muted/20 transition-colors">
          <AccordionTrigger className="px-2.5 py-2.5 hover:no-underline">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-gray-700">Comparecimento do Prestador</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-2.5 pb-2.5">
            <div className="space-y-2 w-full">
              <div>
                <Label htmlFor="comparecimento_prestador" className="text-xs font-medium text-gray-600">
                  Resultado da visita
                </Label>
                <Select
                  value={ficha?.comparecimento_prestador || "nao_informado"}
                  onValueChange={(value) =>
                    updateFicha({ comparecimento_prestador: value === "nao_informado" ? null : value })
                  }
                >
                  <SelectTrigger id="comparecimento_prestador" className="mt-1 h-9 text-sm focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Selecione o comparecimento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_informado">Não informado</SelectItem>
                    {COMPARECIMENTO_PRESTADOR_OPTIONS.map((opcao) => (
                      <SelectItem key={opcao} value={opcao}>
                        {opcao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    
                    // Sincronização imediata ao selecionar prestador
                    if (prestadorValue && ficha?.valor_total && ficha.valor_total > 0) {
                      sincronizarOrcamentosImediato(prestadorValue);
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="valor_total" className="text-xs font-medium text-gray-600">Valor Total</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-5 px-2 text-[10px]"
                    onClick={() => {
                      const maoObra = ficha?.valor_mao_obra || 0;
                      const pecas = ficha?.valor_pecas || 0;
                      const soma = maoObra + pecas;
                      const dividido = soma / 0.77;
                      // Arredondar para o próximo número terminado em 8
                      const resto = dividido % 10;
                      let arredondado: number;
                      if (resto <= 8) {
                        arredondado = Math.floor(dividido / 10) * 10 + 8;
                      } else {
                        arredondado = (Math.floor(dividido / 10) + 1) * 10 + 8;
                      }
                      updateFicha({ valor_total: arredondado });
                      
                      if (ficha?.prestador_id && arredondado > 0) {
                        sincronizarOrcamentosImediato(ficha.prestador_id);
                      }
                    }}
                  >
                    Calcular
                  </Button>
                </div>
                <Input
                  id="valor_total"
                  type="number"
                  step="0.01"
                  value={ficha?.valor_total || ""}
                  onChange={(e) => {
                    const novoValor = parseFloat(e.target.value) || 0;
                    updateFicha({ valor_total: novoValor });
                    
                    // Usar debounce para evitar sincronizar com valores parciais durante digitação
                    if (ficha?.prestador_id && novoValor > 0) {
                      debouncedSincronizarOrcamentos(
                        ficha.prestador_id,
                        novoValor,
                        ficha.valor_mao_obra || 0,
                        ficha.valor_pecas || 0
                      );
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
              {ficha?.pagamento_link && (
                ficha?.pagamento_realizado ? (
                  <span className="ml-auto flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                    <Check className="h-3 w-3" /> Pago
                  </span>
                ) : ficha?.status === 'Finalizado' ? (
                  <span className="ml-auto flex items-center gap-1 text-xs font-medium text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                    <XCircle className="h-3 w-3" /> Pendente
                  </span>
                ) : null
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-2.5 pb-2.5">
            <div className="space-y-2 w-full">
              <div>
                <Label htmlFor="pagamento_link" className="text-xs font-medium text-gray-600">Link de Pagamento</Label>
                <div className="flex gap-1 mt-1">
                  <Input
                    id="pagamento_link"
                    value={ficha?.pagamento_link || ""}
                    onChange={(e) => updateFicha({ pagamento_link: e.target.value })}
                    placeholder="https://www.asaas.com/c/..."
                    className="h-9 text-sm focus:ring-2 focus:ring-primary/20 flex-1"
                  />
                  {ficha?.pagamento_link && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(ficha.pagamento_link || '');
                        toast.success("Link copiado!");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Botão para gerar link via Asaas direto */}
              {ficha && (
                <Button
                  variant={ficha.pagamento_link ? "outline" : "default"}
                  size="sm"
                  className={`w-full gap-2 text-xs ${!ficha.pagamento_link ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                  disabled={gerandoLink}
                  onClick={async () => {
                    if (!ficha) return;
                    if (ficha.pagamento_link) {
                      const confirm = window.confirm('Já existe um link de pagamento. Deseja gerar um novo link? O anterior será substituído.');
                      if (!confirm) return;
                    }
                    setGerandoLink(true);
                    try {
                      const { data: clienteData } = await supabase
                        .from('clientes')
                        .select('nome')
                        .eq('telefone', ficha.telefone_cliente)
                        .maybeSingle();

                      const { data, error } = await supabase.functions.invoke('create-payment-link', {
                        body: {
                          ficha_id: ficha.id,
                          nome_cliente: clienteData?.nome || ficha.nome_cliente || 'Cliente',
                          valor: ficha.valor_total,
                          descricao: ficha.descricao || `Serviço ${ficha.id}`,
                          forma_pagamento: ficha.pagamento_tipo,
                          parcelas: ficha.pagamento_parcelas,
                        },
                      });

                      if (error) {
                        // Try to parse error context from FunctionsHttpError
                        let msg = error.message;
                        try {
                          if (error.context?.json) {
                            const ctx = await error.context.json();
                            msg = ctx?.error || msg;
                          }
                        } catch {}
                        throw new Error(msg);
                      }

                      if (data?.payment_url) {
                        updateFicha({ pagamento_link: data.payment_url });
                        toast.success("Link de pagamento criado com sucesso!");
                      } else {
                        throw new Error(data?.error || 'Resposta inesperada');
                      }
                    } catch (err: any) {
                      console.error('Erro ao gerar link Asaas:', err);
                      toast.error(`Erro ao gerar link: ${err.message || 'Erro desconhecido'}`);
                    } finally {
                      setGerandoLink(false);
                    }
                  }}
                >
                  {gerandoLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
                  {gerandoLink ? 'Gerando...' : (ficha.pagamento_link ? 'Regerar Link (Asaas)' : 'Gerar Link de Pagamento (Asaas)')}
                </Button>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pagamento_realizado"
                  checked={ficha?.pagamento_realizado ?? false}
                  onCheckedChange={(checked) => updateFicha({ pagamento_realizado: checked as boolean })}
                />
                <Label htmlFor="pagamento_realizado" className="cursor-pointer text-xs font-medium text-gray-600">
                  Pagamento Realizado
                </Label>
                {ficha?.pagamento_realizado && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pagamento_gerar_link"
                  checked={ficha?.pagamento_gerar_link ?? true}
                  onCheckedChange={(checked) => updateFicha({ pagamento_gerar_link: checked as boolean })}
                />
                <Label htmlFor="pagamento_gerar_link" className="cursor-pointer text-xs font-medium text-gray-600">
                  Gerar link de pagamento (webhook)
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
                <Label htmlFor="nome_cliente" className="text-xs font-medium text-gray-600">Nome do Cliente</Label>
                <Input
                  id="nome_cliente"
                  value={nomeCliente}
                  onChange={(e) => updateNomeCliente(e.target.value)}
                  placeholder="Nome do cliente"
                  className="mt-1 h-9 text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>

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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="bairro" className="text-xs font-medium text-gray-600">Bairro</Label>
                  <Input
                    id="bairro"
                    value={ficha?.bairro || ""}
                    onChange={(e) => updateFicha({ bairro: e.target.value })}
                    placeholder="Bairro"
                    className="mt-1 h-9 text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <Label htmlFor="cidade" className="text-xs font-medium text-gray-600">Cidade</Label>
                  <Input
                    id="cidade"
                    value={ficha?.cidade || ""}
                    onChange={(e) => updateFicha({ cidade: e.target.value })}
                    placeholder="Cidade"
                    className="mt-1 h-9 text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
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

        {/* Sanfona de Recibo */}
        <AccordionItem value="recibo" className="border rounded-lg shadow-sm bg-card hover:bg-muted/20 transition-colors">
          <AccordionTrigger className="px-2.5 py-2.5 hover:no-underline">
            <div className="flex items-center gap-2 w-full">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-gray-700">Recibo</span>
              {ficha?.recibo_url && (
                <span className="ml-auto mr-2 text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                  Gerado
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-2.5 pb-2.5">
            {ficha && (
              <ReciboGenerator
                fichaId={fichaId}
                nomeCliente={nomeCliente}
                cpfCliente={ficha.cpf}
                valorTotal={ficha.valor_total}
                descricao={ficha.descricao}
                pagamentoRealizado={ficha.pagamento_realizado}
                statusFicha={ficha.status}
                telefoneCliente={ficha.telefone_cliente}
                reciboUrl={ficha.recibo_url}
                onReciboGenerated={(url) => setFicha(prev => prev ? { ...prev, recibo_url: url } : null)}
              />
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {ficha && (ficha.status === 'Finalizado' || ficha.status === 'Em andamento') && ficha.prestador_id && (
        <Button 
          onClick={() => setFinanceiroOpen(true)}
          variant="outline"
          className="fixed bottom-6 right-24 shadow-2xl z-50 hover:scale-[0.98] active:scale-95 transition-all h-10 text-sm border-green-500 text-green-700 hover:bg-green-50"
        >
          <DollarSign className="mr-2 h-4 w-4" />
          Confirmar Financeiro
        </Button>
      )}

      <Button 
        onClick={salvarManualmente} 
        className="fixed bottom-6 right-6 shadow-2xl z-50 hover:scale-[0.98] active:scale-95 active:animate-pulse transition-all h-10 text-sm"
      >
        <Save className="mr-2 h-4 w-4" />
        Salvar Ficha
      </Button>

      {ficha && (
        <PopupConfirmacaoFinanceira
          open={financeiroOpen}
          onOpenChange={setFinanceiroOpen}
          fichaId={fichaId}
          onConfirm={() => fetchFicha()}
        />
      )}
    </div>
  );
};
