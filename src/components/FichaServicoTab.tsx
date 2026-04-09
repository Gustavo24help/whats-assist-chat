import { useEffect, useState, useCallback, useMemo } from "react";
import { calcularJanelaPrestador } from "@/lib/janelaHorarioPrestador";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Save, FileText, DollarSign, Calendar as CalendarIcon, CreditCard, User, Clock, X, Copy, Check, XCircle, Loader2, Link, Send, Zap, Lock, Unlock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DescontoField } from "@/components/DescontoField";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import debounce from "lodash-es/debounce";
import { ReciboGenerator } from "@/components/ReciboGenerator";
import { ResumoConversaDialog } from "@/components/ResumoConversaDialog";
import { PopupConfirmacaoFinanceira } from "@/components/PopupConfirmacaoFinanceira";
import { EnviarLinkPagamentoDialog } from "@/components/EnviarLinkPagamentoDialog";
import { AjustarDataFinalizacaoDialog } from "@/components/AjustarDataFinalizacaoDialog";

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
  data_version: number | null;
  // Discount fields
  tipo_desconto_mao_obra: string | null;
  desconto_valor_mao_obra: number | null;
  desconto_percentual_mao_obra: number | null;
  valor_final_mao_obra: number | null;
  tipo_desconto_pecas: string | null;
  desconto_valor_pecas: number | null;
  desconto_percentual_pecas: number | null;
  valor_final_pecas: number | null;
  subtotal: number | null;
  valor_antes_arredondamento: number | null;
  observacao_financeira: string | null;
  observacao_financeira_por: string | null;
  material_pago_24help: boolean;
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
  "Perdido",
  "Retorno"
];

const formatarInputMoeda = (valor: number): string => {
  if (!valor && valor !== 0) return '';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseMoedaInput = (texto: string): number => {
  if (!texto) return 0;
  // Remove tudo que não é dígito ou vírgula
  const limpo = texto.replace(/[^\d,]/g, '');
  // Troca vírgula por ponto
  const comPonto = limpo.replace(',', '.');
  return parseFloat(comPonto) || 0;
};

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
  const [horaFimAgendamento, setHoraFimAgendamento] = useState<string>('');
  const [dataVisitaTecnica, setDataVisitaTecnica] = useState<string>('');
  const [horaVisitaTecnica, setHoraVisitaTecnica] = useState<string>('');
  const [horaFimVisitaTecnica, setHoraFimVisitaTecnica] = useState<string>('');
  const [dataRetorno, setDataRetorno] = useState<string>('');
  const [horaRetorno, setHoraRetorno] = useState<string>('');
  const [horaFimRetorno, setHoraFimRetorno] = useState<string>('');
  const [nomeCliente, setNomeCliente] = useState<string>('');
  const [financeiroOpen, setFinanceiroOpen] = useState(false);
  const [ajustarDataOpen, setAjustarDataOpen] = useState(false);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [linkDialogData, setLinkDialogData] = useState<{ url: string; nome: string; valor: number } | null>(null);
  const [envioAutomatico, setEnvioAutomatico] = useState(true);
  const [editarManualmente, setEditarManualmente] = useState(false);

  const formatMoeda = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const registrarEnvioNaFicha = async (fichaIdParam: string, paymentUrl: string, metodo: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const nomeUsuario = user?.email?.split('@')[0] || 'sistema';
      const logEntry = `[${agora}] Link de pagamento enviado por ${nomeUsuario} (${metodo}) — ${paymentUrl}`;
      
      const { data: fichaAtual } = await supabase
        .from('fichas_de_servico')
        .select('notas')
        .eq('id', fichaIdParam)
        .single();
      
      const notasAtuais = fichaAtual?.notas || '';
      const novasNotas = notasAtuais ? `${notasAtuais}\n${logEntry}` : logEntry;
      
      await supabase
        .from('fichas_de_servico')
        .update({ notas: novasNotas })
        .eq('id', fichaIdParam);
      
      // Atualizar estado local
      setFicha(prev => prev ? { ...prev, notas: novasNotas } : prev);
    } catch (err) {
      console.error('Erro ao registrar envio na ficha:', err);
    }
  };

  const enviarLinkAutomatico = async (paymentUrl: string, clienteNome: string, valorTotal: number, telefone: string, fichaIdParam: string) => {
    const mensagem = `${clienteNome ? `${clienteNome}, s` : 'S'}egue o link para pagamento do serviço ${fichaIdParam} no valor de ${formatMoeda(valorTotal)}:\n\n${paymentUrl}\n\nQualquer dúvida estamos à disposição! 😊`;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { to: telefone, message: mensagem, userId: user?.id },
      });

      if (error) throw error;
      
      if (!data.success) {
        if (data.error === "FORA_JANELA_24H") {
          return { success: false, reason: 'FORA_JANELA_24H' };
        }
        throw new Error(data.error || "Erro ao enviar");
      }

      await registrarEnvioNaFicha(fichaIdParam, paymentUrl, 'envio automático via WhatsApp');
      return { success: true };
    } catch (err: any) {
      console.error('Erro no envio automático:', err);
      return { success: false, reason: err.message };
    }
  };

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
        console.error(`Webhook falhou (${response.status}): ${errorText.substring(0, 100)}`);
        throw new Error(`Webhook error: ${response.status}`);
      } else {
        console.log("✅ WEBHOOK ENVIADO COM SUCESSO:", {
          url: webhookUrl,
          timestamp: new Date().toISOString()
        });
        // Webhook silencioso - sem toast
      }
    } catch (webhookError) {
      console.error('Erro ao enviar webhook:', webhookError);
      const errorMessage = webhookError instanceof Error ? webhookError.message : 'Erro desconhecido';
      console.error("Falha ao enviar webhook: " + errorMessage);
    }
  };

  // Função única para salvar e enviar webhook
  const salvarFichaEEnviarWebhook = async (
    targetFichaId: string,
    fichaData: Ficha,
    dataAgend: string,
    horaAgend: string,
    dataVisita: string,
    horaVisita: string,
    horaFimAgend: string = '',
    dataRet: string = '',
    horaRet: string = '',
    horaFimRet: string = ''
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

      let retornoISO: string | null = null;
      if (dataRet && dataRet.trim() && horaRet && horaRet.trim()) {
        retornoISO = `${dataRet}T${horaRet}:00-03:00`;
      } else if (dataRet && dataRet.trim()) {
        retornoISO = `${dataRet}T00:00:00-03:00`;
      }

      console.log(`💾 Salvando ficha ${targetFichaId} - agendamento: ${agendamentoISO}, visita: ${visitaTecnicaISO}, retorno: ${retornoISO}`);

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
        data_retorno: retornoISO,
        motivo_perda: fichaData.motivo_perda?.trim()?.substring(0, 500) || null,
        comparecimento_prestador: fichaData.comparecimento_prestador,
        // Discount fields
        tipo_desconto_mao_obra: fichaData.tipo_desconto_mao_obra,
        desconto_valor_mao_obra: fichaData.desconto_valor_mao_obra,
        desconto_percentual_mao_obra: fichaData.desconto_percentual_mao_obra,
        valor_final_mao_obra: fichaData.valor_final_mao_obra,
        tipo_desconto_pecas: fichaData.tipo_desconto_pecas,
        desconto_valor_pecas: fichaData.desconto_valor_pecas,
        desconto_percentual_pecas: fichaData.desconto_percentual_pecas,
        valor_final_pecas: fichaData.valor_final_pecas,
        subtotal: fichaData.subtotal,
        valor_antes_arredondamento: fichaData.valor_antes_arredondamento,
        material_pago_24help: fichaData.material_pago_24help,
        // Time window fields - client windows (using explicit params, not closures)
        hora_inicio_agendamento: horaAgend?.trim() || null,
        hora_fim_agendamento: horaFimAgend?.trim() || null,
        hora_inicio_retorno: horaRet?.trim() || null,
        hora_fim_retorno: horaFimRet?.trim() || null,
        // Provider windows (auto-calculated or same as client when single time)
        ...((() => {
          const hasAgendWindow = horaAgend?.trim() && horaFimAgend?.trim();
          const hasRetornoWindow = horaRet?.trim() && horaFimRet?.trim();
          const provAgend = hasAgendWindow ? calcularJanelaPrestador(horaAgend!.trim(), horaFimAgend!.trim()) : null;
          const provRetorno = hasRetornoWindow ? calcularJanelaPrestador(horaRet!.trim(), horaFimRet!.trim()) : null;
          return {
            // If only hora_inicio (no fim), prestador gets same single time
            hora_inicio_prestador_agendamento: provAgend?.inicio || (horaAgend?.trim() && !horaFimAgend?.trim() ? horaAgend.trim() : null),
            hora_fim_prestador_agendamento: provAgend?.fim || null,
            hora_inicio_prestador_retorno: provRetorno?.inicio || (horaRet?.trim() && !horaFimRet?.trim() ? horaRet.trim() : null),
            hora_fim_prestador_retorno: provRetorno?.fim || null,
          };
        })()),
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
          horaVisita: string,
          horaFimAgend: string,
          dataRet: string,
          horaRet: string,
          horaFimRet: string
        ) => {
          salvarFichaEEnviarWebhook(targetFichaId, fichaData, dataAgend, horaAgend, dataVisita, horaVisita, horaFimAgend, dataRet, horaRet, horaFimRet);
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
    setHoraFimAgendamento('');
    setDataVisitaTecnica('');
    setHoraVisitaTecnica('');
    setHoraFimVisitaTecnica('');
    setDataRetorno('');
    setHoraRetorno('');
    setHoraFimRetorno('');
    
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
      setHoraFimAgendamento('');
      setDataVisitaTecnica('');
      setHoraVisitaTecnica('');
      setHoraFimVisitaTecnica('');
      setDataRetorno('');
      setHoraRetorno('');
      setHoraFimRetorno('');
      
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

      // Extrair data/hora do retorno
      if ((fichaCompleta as any).data_retorno) {
        const resultado = parsearHorarioComTimezone((fichaCompleta as any).data_retorno);
        if (resultado) {
          setDataRetorno(resultado.data);
          setHoraRetorno(resultado.hora);
        }
      } else {
        console.log(`✅ Ficha ${fichaId} não tem data de retorno`);
      }

      // Load hora_fim fields from DB
      if ((fichaCompleta as any).hora_fim_agendamento) {
        setHoraFimAgendamento(String((fichaCompleta as any).hora_fim_agendamento).slice(0, 5));
      }
      if ((fichaCompleta as any).hora_fim_retorno) {
        setHoraFimRetorno(String((fichaCompleta as any).hora_fim_retorno).slice(0, 5));
      }
      // For visita técnica, use hora_fim_agendamento if tipo is visita
      if ((fichaCompleta as any).hora_fim_agendamento && (fichaCompleta as any).tipo_agendamento === 'visita_tecnica') {
        setHoraFimVisitaTecnica(String((fichaCompleta as any).hora_fim_agendamento).slice(0, 5));
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
    
    // Auto-calculate valor_total when relevant fields change (only if not in manual mode)
    const recalcFields = ['valor_mao_obra', 'valor_pecas', 'valor_final_mao_obra', 'valor_final_pecas', 'tipo_desconto_mao_obra', 'tipo_desconto_pecas', 'desconto_valor_mao_obra', 'desconto_valor_pecas', 'desconto_percentual_mao_obra', 'desconto_percentual_pecas'];
    const shouldRecalc = recalcFields.some(f => f in updates) && !editarManualmente;
    if (shouldRecalc) {
      const maoObra = updatedFicha.valor_final_mao_obra ?? updatedFicha.valor_mao_obra ?? 0;
      const pecas = updatedFicha.valor_final_pecas ?? updatedFicha.valor_pecas ?? 0;
      const sub = maoObra + pecas;
      if (sub > 0) {
        const antesArr = sub / 0.77;
        const valorInteiro = Math.floor(antesArr);
        const ultimoDigito = valorInteiro % 10;
        const arredondado = ultimoDigito <= 8
          ? valorInteiro - ultimoDigito + 8
          : valorInteiro - ultimoDigito + 18;
        updatedFicha.valor_total = arredondado;
        updatedFicha.subtotal = sub;
        updatedFicha.valor_antes_arredondamento = antesArr;
      } else {
        updatedFicha.valor_total = 0;
        updatedFicha.subtotal = null;
        updatedFicha.valor_antes_arredondamento = null;
      }
    }
    
    setFicha(updatedFicha);
    
    // Auto-save em mudança de STATUS
    if (updates.status && updates.status !== ficha.status) {
      console.log('📊 Status mudou, salvando automaticamente:', updates.status);
      autoSave(fichaId, updatedFicha, dataAgendamento, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica, horaFimAgendamento, dataRetorno, horaRetorno, horaFimRetorno);
      
      // Disparar NPS automaticamente quando status muda para "Finalizado"
      if (updates.status === 'Finalizado' && ficha.telefone_cliente) {
        console.log('📨 Disparando NPS para ficha:', fichaId);
        void supabase.functions.invoke("send-nps", {
          body: {
            ficha_id: fichaId,
            telefone_cliente: ficha.telefone_cliente,
          },
        }).then(res => {
          console.log('[NPS] Resultado:', res);
        }).catch(err => {
          console.warn('[NPS] Erro (não bloqueante):', err);
        });
      }
    }
    
    // Auto-save quando pagamento_gerar_link mudar (dispara webhook para Make.com criar link)
    if (updates.pagamento_gerar_link !== undefined && updates.pagamento_gerar_link !== ficha.pagamento_gerar_link) {
      console.log('💳 pagamento_gerar_link mudou, salvando automaticamente:', updates.pagamento_gerar_link);
      autoSave(fichaId, updatedFicha, dataAgendamento, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica, horaFimAgendamento, dataRetorno, horaRetorno, horaFimRetorno);
    }
  };

  const updateDataAgendamento = (data: string) => {
    setDataAgendamento(data);
    if (ficha && fichaId) {
      autoSave(fichaId, ficha, data, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica, horaFimAgendamento, dataRetorno, horaRetorno, horaFimRetorno);
    }
  };

  const updateHoraAgendamento = (hora: string) => {
    setHoraAgendamento(hora);
    if (ficha && fichaId) {
      autoSave(fichaId, ficha, dataAgendamento, hora, dataVisitaTecnica, horaVisitaTecnica, horaFimAgendamento, dataRetorno, horaRetorno, horaFimRetorno);
    }
  };

  const updateHoraFimAgendamento = (hora: string) => {
    setHoraFimAgendamento(hora);
    if (ficha && fichaId) {
      autoSave(fichaId, ficha, dataAgendamento, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica, hora, dataRetorno, horaRetorno, horaFimRetorno);
    }
  };

  const updateDataVisitaTecnica = (data: string) => {
    setDataVisitaTecnica(data);
    if (ficha) {
      const updatedFicha = { ...ficha, data_visita_tecnica: data };
      setFicha(updatedFicha);
      if (fichaId) {
        autoSave(fichaId, updatedFicha, dataAgendamento, horaAgendamento, data, horaVisitaTecnica, horaFimAgendamento, dataRetorno, horaRetorno, horaFimRetorno);
      }
    }
  };

  const updateHoraVisitaTecnica = (hora: string) => {
    setHoraVisitaTecnica(hora);
    if (ficha && fichaId) {
      autoSave(fichaId, ficha, dataAgendamento, horaAgendamento, dataVisitaTecnica, hora, horaFimAgendamento, dataRetorno, horaRetorno, horaFimRetorno);
    }
  };

  const updateHoraFimVisitaTecnica = (hora: string) => {
    setHoraFimVisitaTecnica(hora);
    // Visita técnica hora_fim doesn't have a separate DB column yet, just local state
  };

  const updateDataRetorno = (data: string) => {
    setDataRetorno(data);
    if (ficha && fichaId) {
      autoSave(fichaId, ficha, dataAgendamento, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica, horaFimAgendamento, data, horaRetorno, horaFimRetorno);
    }
  };

  const updateHoraRetorno = (hora: string) => {
    setHoraRetorno(hora);
    if (ficha && fichaId) {
      autoSave(fichaId, ficha, dataAgendamento, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica, horaFimAgendamento, dataRetorno, hora, horaFimRetorno);
    }
  };

  const updateHoraFimRetorno = (hora: string) => {
    setHoraFimRetorno(hora);
    if (ficha && fichaId) {
      autoSave(fichaId, ficha, dataAgendamento, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica, horaFimAgendamento, dataRetorno, horaRetorno, hora);
    }
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
            toast.success('Nome atualizado', { duration: 1500, id: 'nome-cliente' });
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
    setHoraFimAgendamento('');
    
    if (ficha) {
      const updatedFicha = { ...ficha, horario_agendamento: null };
      setFicha(updatedFicha);
      autoSave(fichaId, updatedFicha, '', '', dataVisitaTecnica, horaVisitaTecnica, '', dataRetorno, horaRetorno, horaFimRetorno);
    }
    
    toast.success('Agendamento limpo', { duration: 1500, id: 'limpar-agendamento' });
  };

  const limparVisitaTecnica = () => {
    console.log('🧹 Limpando visita técnica manualmente');
    setDataVisitaTecnica('');
    setHoraVisitaTecnica('');
    setHoraFimVisitaTecnica('');
    
    if (ficha) {
      const updatedFicha = { 
        ...ficha, 
        horario_visita_tecnica: null,
        data_visita_tecnica: null 
      };
      setFicha(updatedFicha);
      autoSave(fichaId, updatedFicha, dataAgendamento, horaAgendamento, '', '', horaFimAgendamento, dataRetorno, horaRetorno, horaFimRetorno);
    }
    
    toast.success('Visita técnica limpa', { duration: 1500, id: 'limpar-visita' });
  };

  const limparRetorno = () => {
    console.log('🧹 Limpando retorno manualmente');
    setDataRetorno('');
    setHoraRetorno('');
    setHoraFimRetorno('');
    
    if (ficha) {
      const updatedFicha = { ...ficha };
      setFicha(updatedFicha);
      autoSave(fichaId, updatedFicha, dataAgendamento, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica, horaFimAgendamento, '', '', '');
    }
    
    toast.success('Retorno limpo', { duration: 1500, id: 'limpar-retorno' });
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
    await salvarFichaEEnviarWebhook(fichaId, ficha, dataAgendamento, horaAgendamento, dataVisitaTecnica, horaVisitaTecnica, horaFimAgendamento, dataRetorno, horaRetorno, horaFimRetorno);
    toast.success("Salvo", { duration: 1500, id: 'ficha-salva' });
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

        toast.success("Orçamento sincronizado", { duration: 1500, id: 'orcamento-sync' });
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

        toast.success("Orçamento sincronizado", { duration: 1500, id: 'orcamento-sync' });
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
           <CalendarIcon className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-gray-700">Agendamento</span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-auto mr-2"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!ficha) return;
                      const prestadorNome = prestadores.find(p => p.cpf === ficha.prestador_id)?.nome || '—';
                      let categoriaNome = '—';
                      if (ficha.categoria_id) {
                        const { data: cat } = await supabase.from('categorias').select('nome').eq('id', ficha.categoria_id).single();
                        if (cat) categoriaNome = cat.nome;
                      }
                      const agendamentoStr = dataAgendamento
                        ? `${dataAgendamento.split('-').reverse().join('/')}${horaAgendamento ? ` às ${horaAgendamento}` : ''}`
                        : '—';
                      const lines = [
                        `📋 *Ficha #${ficha.id}*`,
                        `👤 Cliente: ${nomeCliente || ficha.nome_cliente || '—'}`,
                        ficha.endereco ? `📍 Endereço: ${ficha.endereco}${ficha.bairro ? ` - ${ficha.bairro}` : ''}${ficha.cidade ? ` - ${ficha.cidade}` : ''}` : null,
                        ficha.descricao ? `🔧 Serviço: ${ficha.descricao}` : null,
                        categoriaNome !== '—' ? `📂 Categoria: ${categoriaNome}` : null,
                        `👷 Prestador: ${prestadorNome}`,
                        `📅 Agendamento: ${agendamentoStr}`,
                        ficha.tempo_servico ? `⏱ Tempo estimado: ${ficha.tempo_servico}` : null,
                        ficha.valor_total ? `💰 Valor total: ${formatMoeda(ficha.valor_total)}` : null,
                        ficha.notas ? `📝 Obs: ${ficha.notas}` : null,
                      ].filter(Boolean).join('\n');
                      await navigator.clipboard.writeText(lines);
                      toast.success("Copiado!", { duration: 1500, id: 'copy-info' });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copiar info do serviço para prestador</TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
                    <CalendarIcon className="h-3 w-3" />
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
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  <div>
                    <Label htmlFor="data_agendamento" className="text-[10px] text-muted-foreground">Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 w-full justify-start text-left text-sm font-normal",
                            !dataAgendamento && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                          {dataAgendamento ? format(parse(dataAgendamento, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : <span>Selecione</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker
                          mode="single"
                          selected={dataAgendamento ? parse(dataAgendamento, 'yyyy-MM-dd', new Date()) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              updateDataAgendamento(format(date, 'yyyy-MM-dd'));
                            }
                          }}
                          locale={ptBR}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    {dataAgendamento && (
                      <Button variant="ghost" size="sm" onClick={() => updateDataAgendamento('')} className="h-5 w-5 p-0 mt-0.5 hover:bg-destructive/10 hover:text-destructive" title="Limpar data">
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="hora_agendamento" className="text-[10px] text-muted-foreground">Início</Label>
                    <Input
                      id="hora_agendamento"
                      type="time"
                      value={horaAgendamento}
                      onChange={(e) => updateHoraAgendamento(e.target.value)}
                      className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                    />
                    {horaAgendamento && (
                      <Button variant="ghost" size="sm" onClick={() => updateHoraAgendamento('')} className="h-5 w-5 p-0 mt-0.5 hover:bg-destructive/10 hover:text-destructive" title="Limpar horário">
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="hora_fim_agendamento" className="text-[10px] text-muted-foreground">Fim</Label>
                    <Input
                      id="hora_fim_agendamento"
                      type="time"
                      value={horaFimAgendamento}
                      onChange={(e) => updateHoraFimAgendamento(e.target.value)}
                      className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                    />
                    {horaFimAgendamento && (
                      <Button variant="ghost" size="sm" onClick={() => updateHoraFimAgendamento('')} className="h-5 w-5 p-0 mt-0.5 hover:bg-destructive/10 hover:text-destructive" title="Limpar horário fim">
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {horaAgendamento && (() => {
                  if (horaFimAgendamento) {
                    const prov = calcularJanelaPrestador(horaAgendamento, horaFimAgendamento);
                    if (!prov) return null;
                    return (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Janela prestador: {prov.inicio} - {prov.fim}
                      </p>
                    );
                  }
                  return (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Prestador: {horaAgendamento} (mesmo horário)
                    </p>
                  );
                })()}
                
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
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  <div>
                    <Label htmlFor="data_visita_tecnica" className="text-[10px] text-muted-foreground">Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 w-full justify-start text-left text-sm font-normal",
                            !dataVisitaTecnica && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                          {dataVisitaTecnica ? format(parse(dataVisitaTecnica, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : <span>Selecione</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker
                          mode="single"
                          selected={dataVisitaTecnica ? parse(dataVisitaTecnica, 'yyyy-MM-dd', new Date()) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              updateDataVisitaTecnica(format(date, 'yyyy-MM-dd'));
                            }
                          }}
                          locale={ptBR}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    {dataVisitaTecnica && (
                      <Button variant="ghost" size="sm" onClick={() => updateDataVisitaTecnica('')} className="h-5 w-5 p-0 mt-0.5 hover:bg-destructive/10 hover:text-destructive" title="Limpar data">
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="hora_visita_tecnica" className="text-[10px] text-muted-foreground">Início</Label>
                    <Input
                      id="hora_visita_tecnica"
                      type="time"
                      value={horaVisitaTecnica}
                      onChange={(e) => updateHoraVisitaTecnica(e.target.value)}
                      className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                    />
                    {horaVisitaTecnica && (
                      <Button variant="ghost" size="sm" onClick={() => updateHoraVisitaTecnica('')} className="h-5 w-5 p-0 mt-0.5 hover:bg-destructive/10 hover:text-destructive" title="Limpar horário">
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="hora_fim_visita_tecnica" className="text-[10px] text-muted-foreground">Fim</Label>
                    <Input
                      id="hora_fim_visita_tecnica"
                      type="time"
                      value={horaFimVisitaTecnica}
                      onChange={(e) => updateHoraFimVisitaTecnica(e.target.value)}
                      className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                    />
                    {horaFimVisitaTecnica && (
                      <Button variant="ghost" size="sm" onClick={() => updateHoraFimVisitaTecnica('')} className="h-5 w-5 p-0 mt-0.5 hover:bg-destructive/10 hover:text-destructive" title="Limpar horário fim">
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {horaVisitaTecnica && (() => {
                  if (horaFimVisitaTecnica) {
                    const prov = calcularJanelaPrestador(horaVisitaTecnica, horaFimVisitaTecnica);
                    if (!prov) return null;
                    return (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Janela prestador: {prov.inicio} - {prov.fim}
                      </p>
                    );
                  }
                  return (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Prestador: {horaVisitaTecnica} (mesmo horário)
                    </p>
                  );
                })()}
              </div>

              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    Retorno
                  </Label>
                  {(dataRetorno || horaRetorno) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={limparRetorno}
                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                      title="Limpar retorno"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  <div>
                    <Label htmlFor="data_retorno" className="text-[10px] text-muted-foreground">Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 w-full justify-start text-left text-sm font-normal",
                            !dataRetorno && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                          {dataRetorno ? format(parse(dataRetorno, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : <span>Selecione</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker
                          mode="single"
                          selected={dataRetorno ? parse(dataRetorno, 'yyyy-MM-dd', new Date()) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              updateDataRetorno(format(date, 'yyyy-MM-dd'));
                            }
                          }}
                          locale={ptBR}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    {dataRetorno && (
                      <Button variant="ghost" size="sm" onClick={() => updateDataRetorno('')} className="h-5 w-5 p-0 mt-0.5 hover:bg-destructive/10 hover:text-destructive" title="Limpar data">
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="hora_retorno" className="text-[10px] text-muted-foreground">Início</Label>
                    <Input
                      id="hora_retorno"
                      type="time"
                      value={horaRetorno}
                      onChange={(e) => updateHoraRetorno(e.target.value)}
                      className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                    />
                    {horaRetorno && (
                      <Button variant="ghost" size="sm" onClick={() => updateHoraRetorno('')} className="h-5 w-5 p-0 mt-0.5 hover:bg-destructive/10 hover:text-destructive" title="Limpar horário">
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="hora_fim_retorno" className="text-[10px] text-muted-foreground">Fim</Label>
                    <Input
                      id="hora_fim_retorno"
                      type="time"
                      value={horaFimRetorno}
                      onChange={(e) => updateHoraFimRetorno(e.target.value)}
                      className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                    />
                    {horaFimRetorno && (
                      <Button variant="ghost" size="sm" onClick={() => updateHoraFimRetorno('')} className="h-5 w-5 p-0 mt-0.5 hover:bg-destructive/10 hover:text-destructive" title="Limpar horário fim">
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {horaRetorno && (() => {
                  if (horaFimRetorno) {
                    const prov = calcularJanelaPrestador(horaRetorno, horaFimRetorno);
                    if (!prov) return null;
                    return (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Janela prestador: {prov.inicio} - {prov.fim}
                      </p>
                    );
                  }
                  return (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Prestador: {horaRetorno} (mesmo horário)
                    </p>
                  );
                })()}
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
                <Label htmlFor="valor_mao_obra" className="text-xs font-medium text-muted-foreground">Valor Mão de Obra</Label>
                <Input
                  id="valor_mao_obra"
                  type="text"
                  inputMode="decimal"
                  value={ficha?.valor_mao_obra ? formatarInputMoeda(ficha.valor_mao_obra) : ""}
                  onChange={(e) => updateFicha({ valor_mao_obra: parseMoedaInput(e.target.value) })}
                  placeholder="0,00"
                  className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                />
                <DescontoField
                  label="mao_obra"
                  valorOriginal={ficha?.valor_mao_obra || 0}
                  tipoDesconto={ficha?.tipo_desconto_mao_obra || null}
                  descontoValor={ficha?.desconto_valor_mao_obra || null}
                  descontoPercentual={ficha?.desconto_percentual_mao_obra || null}
                  valorFinal={ficha?.valor_final_mao_obra || null}
                  onApplyDesconto={(tipo, desconto) => {
                    const valorOriginal = ficha?.valor_mao_obra || 0;
                    let descontoEmReais: number;
                    let percentual: number | null = null;
                    if (tipo === 'percentual') {
                      descontoEmReais = (valorOriginal * desconto) / 100;
                      percentual = desconto;
                    } else {
                      descontoEmReais = desconto;
                    }
                    const valorFinal = Math.max(0, valorOriginal - descontoEmReais);
                    updateFicha({
                      tipo_desconto_mao_obra: tipo,
                      desconto_valor_mao_obra: descontoEmReais,
                      desconto_percentual_mao_obra: percentual,
                      valor_final_mao_obra: valorFinal,
                    });
                  }}
                  onRemoveDesconto={() => {
                    updateFicha({
                      tipo_desconto_mao_obra: null,
                      desconto_valor_mao_obra: null,
                      desconto_percentual_mao_obra: null,
                      valor_final_mao_obra: null,
                    });
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="valor_pecas" className="text-xs font-medium text-muted-foreground">Valor Peças</Label>
                <Input
                  id="valor_pecas"
                  type="text"
                  inputMode="decimal"
                  value={ficha?.valor_pecas ? formatarInputMoeda(ficha.valor_pecas) : ""}
                  onChange={(e) => updateFicha({ valor_pecas: parseMoedaInput(e.target.value) })}
                  placeholder="0,00"
                  className="h-9 text-sm focus:ring-2 focus:ring-primary/20"
                />
                <DescontoField
                  label="pecas"
                  valorOriginal={ficha?.valor_pecas || 0}
                  tipoDesconto={ficha?.tipo_desconto_pecas || null}
                  descontoValor={ficha?.desconto_valor_pecas || null}
                  descontoPercentual={ficha?.desconto_percentual_pecas || null}
                  valorFinal={ficha?.valor_final_pecas || null}
                  onApplyDesconto={(tipo, desconto) => {
                    const valorOriginal = ficha?.valor_pecas || 0;
                    let descontoEmReais: number;
                    let percentual: number | null = null;
                    if (tipo === 'percentual') {
                      descontoEmReais = (valorOriginal * desconto) / 100;
                      percentual = desconto;
                    } else {
                      descontoEmReais = desconto;
                    }
                    const valorFinal = Math.max(0, valorOriginal - descontoEmReais);
                    updateFicha({
                      tipo_desconto_pecas: tipo,
                      desconto_valor_pecas: descontoEmReais,
                      desconto_percentual_pecas: percentual,
                      valor_final_pecas: valorFinal,
                    });
                  }}
                  onRemoveDesconto={() => {
                    updateFicha({
                      tipo_desconto_pecas: null,
                      desconto_valor_pecas: null,
                      desconto_percentual_pecas: null,
                      valor_final_pecas: null,
                    });
                  }}
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <Checkbox
                    id="material_pago_24help"
                    checked={ficha?.material_pago_24help || false}
                    onCheckedChange={(checked) => updateFicha({ material_pago_24help: !!checked })}
                  />
                  <Label htmlFor="material_pago_24help" className="text-xs text-muted-foreground cursor-pointer">
                    Material pago pela 24help
                  </Label>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="valor_total" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    Valor Total
                    {!editarManualmente ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Calculado automaticamente: (Mão de Obra + Peças) / 0.77</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Unlock className="h-3 w-3 text-amber-500" />
                    )}
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="editar-manual-switch" className="text-[10px] text-muted-foreground cursor-pointer">
                      Editar manualmente
                    </Label>
                    <Switch
                      id="editar-manual-switch"
                      checked={editarManualmente}
                      onCheckedChange={(checked) => {
                        setEditarManualmente(checked);
                        if (!checked && ficha) {
                          const maoObra = ficha.valor_final_mao_obra ?? ficha.valor_mao_obra ?? 0;
                          const pecas = ficha.valor_final_pecas ?? ficha.valor_pecas ?? 0;
                          const sub = maoObra + pecas;
                          if (sub > 0) {
                            const antesArr = sub / 0.77;
                            const valorInteiro = Math.floor(antesArr);
                            const ultimoDigito = valorInteiro % 10;
                            const arredondado = ultimoDigito <= 8
                              ? valorInteiro - ultimoDigito + 8
                              : valorInteiro - ultimoDigito + 18;
                            updateFicha({ valor_total: arredondado, subtotal: sub, valor_antes_arredondamento: antesArr });
                          } else {
                            updateFicha({ valor_total: 0, subtotal: null, valor_antes_arredondamento: null });
                          }
                        }
                      }}
                      className="scale-75"
                    />
                  </div>
                </div>
                {editarManualmente && (
                  <Alert className="border-amber-300 bg-amber-50 py-2 px-3">
                    <AlertDescription className="text-[11px] text-amber-800">
                      ⚠ Atenção: Editar o valor total manualmente desativa o cálculo automático. Use com cautela e verifique se o valor está correto.
                    </AlertDescription>
                  </Alert>
                )}
                <Input
                  id="valor_total"
                  type="text"
                  inputMode="decimal"
                  value={ficha?.valor_total ? formatarInputMoeda(ficha.valor_total) : ""}
                  readOnly={!editarManualmente}
                  onChange={editarManualmente ? (e) => updateFicha({ valor_total: parseMoedaInput(e.target.value) }) : undefined}
                  placeholder="0,00"
                  className={`h-9 text-sm ${editarManualmente ? 'focus:ring-2 focus:ring-amber-400/40 border-amber-300' : 'bg-muted cursor-not-allowed'}`}
                />
                {ficha?.subtotal != null && (
                  <div className="text-[10px] text-muted-foreground space-y-0.5 pl-1">
                    <div>Subtotal: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ficha.subtotal)}</div>
                  </div>
                )}
                {ficha?.valor_total != null && ficha.valor_total > 0 && (() => {
                  const maoObra = ficha.valor_final_mao_obra ?? ficha.valor_mao_obra ?? 0;
                  const pecas = ficha.valor_final_pecas ?? ficha.valor_pecas ?? 0;
                  const custos = maoObra + pecas;
                  const margem = custos > 0 ? 1 - (custos / ficha.valor_total) : 0;
                  const margemPercent = (margem * 100);
                  const abaixoMinima = margemPercent < 23;
                  return (
                    <div className={`text-[10px] pl-1 font-medium ${abaixoMinima ? 'text-destructive' : 'text-emerald-600'}`}>
                      Margem: {margemPercent.toFixed(1)}%
                      {abaixoMinima && (
                        <span className="ml-1 font-semibold">⚠ Valor Abaixo da Margem Mínima</span>
                      )}
                    </div>
                  );
                })()}
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

              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="observacao_financeira" className="text-xs font-medium text-amber-600">
                  Observação Financeira (opcional)
                </Label>
                <textarea
                  id="observacao_financeira"
                  value={ficha?.observacao_financeira || ""}
                  onChange={async (e) => {
                    const value = e.target.value || null;
                    const { data: { user } } = await supabase.auth.getUser();
                    updateFicha({
                      observacao_financeira: value,
                      observacao_financeira_por: value ? (user?.id || null) : null,
                    } as any);
                  }}
                  placeholder="Explique irregularidades nos valores, margem, etc."
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <p className="text-[10px] text-muted-foreground">Será exibido como aviso no módulo Financeiro</p>
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
                        toast.success("Copiado!", { duration: 1500, id: 'copy-link' });
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
                    
                    // Validar valor antes de chamar a API
                    if (!ficha.valor_total || ficha.valor_total <= 0) {
                      toast.error('O valor total da ficha é zero. Preencha o valor para gerar um link de pagamento.');
                      return;
                    }
                    
                    if (ficha.pagamento_link) {
                      const confirm = window.confirm('Já existe um link de pagamento. Deseja gerar um novo link? O anterior será substituído.');
                      if (!confirm) return;
                    }
                    
                    // Salvamento LEVE: só campos de pagamento no banco, sem webhook externo
                    try {
                      await supabase
                        .from('fichas_de_servico')
                        .update({
                          valor_total: ficha.valor_total,
                          valor_mao_obra: ficha.valor_mao_obra,
                          valor_pecas: ficha.valor_pecas,
                          pagamento_tipo: ficha.pagamento_tipo as any,
                          pagamento_parcelas: ficha.pagamento_parcelas,
                        })
                        .eq('id', fichaId);
                    } catch {
                      toast.error('Erro ao salvar valores. Tente novamente.');
                      return;
                    }
                    
                    setGerandoLink(true);
                    try {
                      const clienteNomeResolvido = nomeCliente || ficha.nome_cliente || 'Cliente';
                      
                      const { data, error } = await supabase.functions.invoke('create-payment-link', {
                        body: {
                          ficha_id: ficha.id,
                          nome_cliente: clienteNomeResolvido,
                          valor: ficha.valor_total,
                          descricao: ficha.descricao || `Serviço ${ficha.id}`,
                          forma_pagamento: ficha.pagamento_tipo,
                          parcelas: ficha.pagamento_parcelas,
                        },
                      });

                      if (error) {
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
                        // Atualizar estado local
                        setFicha(prev => prev ? { ...prev, pagamento_link: data.payment_url } : prev);
                        
                        if (envioAutomatico && ficha.telefone_cliente) {
                          // Envio automático
                          toast.info('Enviando link ao cliente...');
                          const resultado = await enviarLinkAutomatico(
                            data.payment_url, clienteNomeResolvido, ficha.valor_total,
                            ficha.telefone_cliente, ficha.id
                          );
                          
                          if (resultado.success) {
                            toast.success('✅ Link gerado e enviado automaticamente ao cliente!');
                          } else {
                            // Fallback: abrir dialog manual
                            toast.warning(resultado.reason === 'FORA_JANELA_24H' 
                              ? 'Fora da janela 24h. Revise e envie manualmente.' 
                              : 'Envio automático falhou. Revise e envie manualmente.');
                            setLinkDialogData({
                              url: data.payment_url,
                              nome: clienteNomeResolvido,
                              valor: ficha.valor_total,
                            });
                          }
                        } else {
                          // Sem envio automático: abrir dialog
                          setLinkDialogData({
                            url: data.payment_url,
                            nome: clienteNomeResolvido,
                            valor: ficha.valor_total,
                          });
                        }
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
                <Label htmlFor="pagamento_gerar_link" className="cursor-pointer text-xs font-medium text-muted-foreground">
                  Gerar link de pagamento (webhook)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="envio_automatico"
                  checked={envioAutomatico}
                  onCheckedChange={(checked) => setEnvioAutomatico(checked as boolean)}
                />
                <Label htmlFor="envio_automatico" className="cursor-pointer text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-500" />
                  Enviar link automaticamente ao gerar
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
                {(ficha?.pagamento_parcelas || 1) > 1 && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ O cliente poderá parcelar em até {ficha?.pagamento_parcelas}x no cartão de crédito. Para PIX/boleto o pagamento será à vista.
                  </p>
                )}
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

      <div className="fixed bottom-6 right-6 z-50 flex flex-wrap-reverse items-center justify-end gap-2 max-w-[calc(100vw-2rem)]">
        <Button
          onClick={salvarManualmente}
          className="shadow-2xl hover:scale-[0.98] active:scale-95 active:animate-pulse transition-all h-10 text-sm"
        >
          <Save className="mr-2 h-4 w-4" />
          Salvar Ficha
        </Button>

        {ficha && (ficha.status === 'Finalizado' || ficha.status === 'Em andamento') && ficha.prestador_id && (
          <Button
            onClick={() => setFinanceiroOpen(true)}
            variant="outline"
            className="shadow-2xl hover:scale-[0.98] active:scale-95 transition-all h-10 text-sm border-green-500 text-green-700 hover:bg-green-50"
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Confirmar Financeiro
          </Button>
        )}

        {ficha && ficha.status === 'Finalizado' && (
          <Button
            onClick={() => setAjustarDataOpen(true)}
            variant="outline"
            className="shadow-2xl hover:scale-[0.98] active:scale-95 transition-all h-10 text-sm border-orange-500 text-orange-700 hover:bg-orange-50"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            Ajustar Data Finalização
          </Button>
        )}
      </div>

      {ficha && (
        <PopupConfirmacaoFinanceira
          open={financeiroOpen}
          onOpenChange={setFinanceiroOpen}
          fichaId={fichaId}
          onConfirm={() => fetchFicha()}
        />
      )}

      {ficha && linkDialogData && (
        <EnviarLinkPagamentoDialog
          open={!!linkDialogData}
          onOpenChange={(open) => { if (!open) setLinkDialogData(null); }}
          paymentUrl={linkDialogData.url}
          fichaId={fichaId}
          nomeCliente={linkDialogData.nome}
          telefoneCliente={ficha.telefone_cliente}
          valorTotal={linkDialogData.valor}
          onEnviado={() => fetchFicha()}
        />
      )}

      {ficha && ficha.status === 'Finalizado' && (
        <AjustarDataFinalizacaoDialog
          open={ajustarDataOpen}
          onOpenChange={setAjustarDataOpen}
          fichaId={fichaId}
          prestadorNome={prestadores.find(p => p.cpf === ficha.prestador_id)?.nome}
          prestadorId={ficha.prestador_id}
          onAjustado={() => fetchFicha()}
        />
      )}
    </div>
  );
};
