import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Send, FileText, Paperclip, FileIcon, UserCheck, ArrowLeft, Check, Users, UserCheck as UserCheckIcon, ChevronDown, X, MessageSquare, Loader2, Search as SearchIcon, ChevronUp, Mic, History, Lock, UserPlus, ScrollText, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "./AudioPlayer";
import { AudioRecorder } from "./AudioRecorder";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { StatusConexaoTwilio } from "./StatusConexaoTwilio";
import { MensagensPadronizadasDropdown } from "./MensagensPadronizadasDropdown";
import { NPSFlowPanel } from "./NPSFlowPanel";
import { AvaliacaoPrestadorFlowPanel } from "./AvaliacaoPrestadorFlowPanel";
import { useConversationTimer } from "@/hooks/useConversationTimer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AbrirConversaDialog } from "./AbrirConversaDialog";
import { BotHistoricoDialog } from "./BotHistoricoDialog";
import { MessageContextMenu } from "./MessageContextMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TakeoverRequestDialog } from "./TakeoverRequestDialog";
import { TakeoverWaitingDialog } from "./TakeoverWaitingDialog";
import { ReplyIndicator } from "./ReplyIndicator";
import { AtribuicaoDescricaoDialog } from "./AtribuicaoDescricaoDialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const NUMERO_24HELP = 'whatsapp:+554138911555';
const NUMERO_SANDBOX = 'whatsapp:+14155238886';

const isAtendente = (remetente: string): boolean =>
  remetente === NUMERO_24HELP || remetente === NUMERO_SANDBOX || remetente === 'atendente' || remetente === 'bot';

interface Mensagem {
  id: string;
  texto: string;
  tipo: "texto" | "arquivo" | "imagem" | "video" | "audio";
  arquivo_url: string | null;
  data_hora: string;
  remetente: string;
  status: "enviado" | "recebido" | "lido";
  status_atualizado_em?: string;
  message_sid?: string | null;
  reply_to_message_id?: string | null;
  reply_to?: Mensagem | null;
  enviado_por?: { full_name: string } | null;
  enviado_por_id?: string | null;
  tipo_remetente?: string | null;
  operador_nome?: string | null;
  transcricao_texto?: string | null;
}

const QuotedMessage = React.memo(({ 
  quotedMsg, 
  onScrollToMessage 
}: { 
  quotedMsg: Mensagem | null;
  onScrollToMessage?: (messageId: string) => void;
}) => {
  if (!quotedMsg) {
    console.log('❌ QuotedMessage: quotedMsg é null/undefined');
    return null;
  }
  
  console.log('✅ Renderizando QuotedMessage:', {
    id: quotedMsg.id,
    texto: quotedMsg.texto?.substring(0, 30),
    tipo: quotedMsg.tipo
  });
  
  const getSenderName = (remetente: string) => {
    if (isAtendente(remetente)) return "Você";
    return "Cliente";
  };

  const getPreview = () => {
    if (quotedMsg.tipo === "texto") {
      if (!quotedMsg.texto) {
        console.warn('⚠️ Mensagem citada sem texto:', quotedMsg.id);
        return "(mensagem sem texto)";
      }
      
      return quotedMsg.texto.length > 50 
        ? quotedMsg.texto.substring(0, 50) + "..."
        : quotedMsg.texto;
    }
    
    const mediaIcons: Record<string, string> = {
      audio: "🎵 Áudio",
      imagem: "🖼️ Imagem",
      video: "🎥 Vídeo",
      arquivo: "📄 Arquivo"
    };
    
    return mediaIcons[quotedMsg.tipo] || "Mensagem";
  };

  return (
    <div 
      className="bg-black/10 dark:bg-white/10 border-l-4 border-l-current pl-2 py-1.5 mb-2 rounded-r cursor-pointer hover:bg-black/15 dark:hover:bg-white/15 transition-all active:scale-[0.98]"
      onClick={(e) => {
        e.stopPropagation();
        onScrollToMessage?.(quotedMsg.id);
      }}
    >
      <div className="text-xs font-semibold opacity-90 mb-0.5">
        {getSenderName(quotedMsg.remetente)}
      </div>
      <div className="text-xs opacity-75 truncate leading-tight">
        {getPreview()}
      </div>
    </div>
  );
});

const MessageStatusIndicator = React.memo(({ status, remetente }: { status: string | null, remetente: string }) => {
  // Só mostrar para mensagens do atendente
  if (!isAtendente(remetente)) return null;
  
  switch (status) {
    case 'enviado':
      return <Check className="h-3 w-3 opacity-60" />;
    case 'recebido':
      return (
        <div className="flex -space-x-1">
          <Check className="h-3 w-3 opacity-60" />
          <Check className="h-3 w-3 opacity-60" />
        </div>
      );
    case 'lido':
      return (
        <div className="flex -space-x-1">
          <Check className="h-3 w-3 text-blue-400" />
          <Check className="h-3 w-3 text-blue-400" />
        </div>
      );
    default:
      return null;
  }
});

interface ChatWindowProps {
  clienteTelefone: string;
  clienteNome: string;
  statusConversa: "aberta" | "fechada";
  onOpenFicha: () => void;
  onBack?: () => void;
  fichaOpen?: boolean;
  onToggleFicha?: () => void;
}

export const ChatWindow = ({ clienteTelefone, clienteNome, statusConversa, onOpenFicha, onBack, fichaOpen, onToggleFicha }: ChatWindowProps) => {
  const { user, userProfile, isSupervisor } = useAuth();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMsg, setNovaMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Mensagem | null>(null);
  const [fichaId, setFichaId] = useState<string | undefined>();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [assumirDialogOpen, setAssumirDialogOpen] = useState(false);
  const [botDesabilitado, setBotDesabilitado] = useState(false);
  const [isTogglingBot, setIsTogglingBot] = useState(false);
  const [ultimaAcaoBot, setUltimaAcaoBot] = useState<{
    acao: string;
    por: string | null;
    quando: string;
  } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [confirmacaoTexto, setConfirmacaoTexto] = useState("");
  // 🔒 Estado isolado do dialog para prevenir race condition com realtime
  const [botStatusNoDialog, setBotStatusNoDialog] = useState<boolean | null>(null);
  
  // ✅ Estados para loading e paginação de mensagens
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [oldestMessageDate, setOldestMessageDate] = useState<string | null>(null);
  const MESSAGES_PER_PAGE = 100;
  
  // Estados para atribuição de operador
  const [atendenteAtual, setAtendenteAtual] = useState<{ id: string; nome: string } | null>(null);
  const [todosAtendentes, setTodosAtendentes] = useState<Array<{ id: string; nome: string }>>([]);
  const [atribuicaoDialogOpen, setAtribuicaoDialogOpen] = useState(false);
  const [pendingAtribuicao, setPendingAtribuicao] = useState<{ id: string; nome: string } | null>(null);
  
  // Estados para notas internas
  const [notasDialogOpen, setNotasDialogOpen] = useState(false);
  const [notasInternas, setNotasInternas] = useState("");
  const [hasNotas, setHasNotas] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  
  // Estado para histórico do bot
  const [botHistoricoOpen, setBotHistoricoOpen] = useState(false);
  
  // Estados para busca no chat
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchTerm, setChatSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  
  // Estados para arquivo pendente (drag & drop / preview antes de enviar)
  const [pendingFile, setPendingFile] = useState<{
    file: File;
    previewUrl: string;
    type: 'imagem' | 'video' | 'audio' | 'arquivo';
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Estados para takeover
  const [takeoverWaitingOpen, setTakeoverWaitingOpen] = useState(false);
  const [takeoverWaitingOperadorNome, setTakeoverWaitingOperadorNome] = useState("");
  const [takeoverRequestOpen, setTakeoverRequestOpen] = useState(false);
  const [takeoverRequestSolicitanteNome, setTakeoverRequestSolicitanteNome] = useState("");
  const [takeoverRequestId, setTakeoverRequestId] = useState<string | null>(null);
  const takeoverChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const takeoverRequestIdRef = useRef<string | null>(null);
  const takeoverWaitingOperadorNomeRef = useRef("");
  
  // Estados para edição de mensagem
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesStartRef = useRef<HTMLDivElement>(null);
  const latestMessageDateRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { dentroJanela } = useConversationTimer(clienteTelefone);
  
  const isMyTicket = atendenteAtual?.id === user?.id;
  
  // 🔐 Controle de permissão para reatribuição
  // - Ticket sem dono: qualquer um pode assumir
  // - Ticket com dono: dono atual OU supervisor/admin pode reatribuir/transferir
  const canReassign = !atendenteAtual || isSupervisor || isMyTicket;
  
  // 🔐 Controle de permissão de ESCRITA
  // - Meu ticket: pode escrever
  // - Supervisor/Admin: pode escrever em qualquer ticket
  // - Ticket sem dono E não é supervisor: NÃO pode escrever (precisa assumir primeiro)
  // - Ticket de outro: NÃO pode escrever
  const canWrite = isMyTicket || isSupervisor;
  const needsToAssume = !atendenteAtual && !isSupervisor;

  // Handlers para editar/apagar mensagens
  const handleEditMessage = async (messageId: string, newText: string) => {
    try {
      const { error } = await supabase
        .from('mensagens')
        .update({ texto: newText })
        .eq('id', messageId);
      if (error) throw error;
      setMensagens(prev => prev.map(m => m.id === messageId ? { ...m, texto: newText } : m));
      toast.success("Mensagem editada!");
      setEditingMessageId(null);
      setEditingText("");
    } catch (error) {
      console.error('Erro ao editar mensagem:', error);
      toast.error("Erro ao editar mensagem");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('mensagens')
        .update({ texto: "[Mensagem apagada]" })
        .eq('id', messageId);
      if (error) throw error;
      setMensagens(prev => prev.map(m => m.id === messageId ? { ...m, texto: "[Mensagem apagada]" } : m));
      toast.success("Mensagem apagada!");
    } catch (error) {
      console.error('Erro ao apagar mensagem:', error);
      toast.error("Erro ao apagar mensagem");
    }
  };

  const handleStartEdit = (messageId: string) => {
    const msg = mensagens.find(m => m.id === messageId);
    if (msg) {
      setEditingMessageId(messageId);
      setEditingText(msg.texto || "");
    }
  };

  const canEditDeleteMessage = (msg: Mensagem): boolean => {
    if (!isAtendente(msg.remetente)) return false;
    if (msg.texto === "[Mensagem apagada]") return false;
    // Próprio operador ou admin/supervisor
    return (msg.enviado_por_id === user?.id) || isSupervisor;
  };

  // Copiar informações do serviço para enviar ao prestador
  const handleCopyServiceInfo = async () => {
    if (!fichaId) return;
    try {
      const { data: ficha, error } = await supabase
        .from('fichas_de_servico')
        .select('*, categorias(nome)')
        .eq('id', fichaId)
        .maybeSingle();

      if (error || !ficha) {
        toast.error("Erro ao buscar dados da ficha");
        return;
      }

      const lines: string[] = [];
      lines.push(`📋 *Ficha #${ficha.id}*`);
      if (ficha.nome_cliente) lines.push(`👤 Cliente: ${ficha.nome_cliente}`);
      if (ficha.endereco) {
        let addr = ficha.endereco;
        if (ficha.bairro) addr += ` - ${ficha.bairro}`;
        if (ficha.cidade) addr += ` - ${ficha.cidade}`;
        lines.push(`📍 Endereço: ${addr}`);
      }
      if (ficha.descricao) lines.push(`🔧 Serviço: ${ficha.descricao}`);
      if ((ficha as any).categorias?.nome) lines.push(`📂 Categoria: ${(ficha as any).categorias.nome}`);
      if (ficha.tempo_servico) lines.push(`⏱ Tempo estimado: ${ficha.tempo_servico}`);
      if (ficha.horario_agendamento) {
        const d = new Date(ficha.horario_agendamento);
        lines.push(`📅 Agendamento: ${format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`);
      }
      if (ficha.valor_total) lines.push(`💰 Valor total: R$ ${Number(ficha.valor_total).toFixed(2).replace('.', ',')}`);
      if (ficha.notas) lines.push(`📝 Obs: ${ficha.notas}`);

      const text = lines.join('\n');
      await navigator.clipboard.writeText(text);
      toast.success("Informações do serviço copiadas!");
    } catch (error) {
      console.error('Erro ao copiar info do serviço:', error);
      toast.error("Erro ao copiar informações");
    }
  };


  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height para calcular corretamente
      textarea.style.height = 'auto';
      // Setar altura baseado no scrollHeight com max de 80px (2x o tamanho padrão)
      const maxHeight = 80;
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
      
      // Adicionar scroll quando atingir o máximo
      if (textarea.scrollHeight > maxHeight) {
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [novaMsg]);

  useEffect(() => {
    latestMessageDateRef.current = mensagens.length > 0 ? mensagens[mensagens.length - 1].data_hora : null;
  }, [mensagens]);

  useEffect(() => {
    console.log('[ChatWindow] Limpando estados para:', clienteTelefone);
    setMensagens([]);
    setNovaMsg("");
    setHighlightedMessageId(null);
    setAtendenteAtual(null);
    setNotasInternas("");
    setHasNotas(false);
    setIsLoadingMessages(true);
    setHasMoreMessages(false);
    setOldestMessageDate(null);
    setConversationId(null); // Reset conversation_id ao trocar de conversa
    // Limpar arquivo pendente ao trocar de conversa
    if (pendingFile) {
      URL.revokeObjectURL(pendingFile.previewUrl);
      setPendingFile(null);
    }
    setIsDragging(false);
    
    console.log('[ChatWindow] Inicializando canais Realtime para:', clienteTelefone);
    
    // ✅ Carregar dados iniciais em paralelo
    const loadInitialData = async () => {
      setIsLoadingMessages(true);
      await Promise.all([
        fetchMensagens(),
        fetchClienteData(), // Nova função consolidada
        fetchAtendentes()
      ]);
      setIsLoadingMessages(false);
    };
    
    loadInitialData();
    clearUnreadMark();

    const channel = supabase
      .channel(`mensagens-${clienteTelefone}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'mensagens',
          filter: `cliente_id=eq.${clienteTelefone}`
        },
        async (payload) => {
          console.log('[ChatWindow] Nova mensagem detectada, adicionando em tempo real');
          const novaMensagem = payload.new as Mensagem;

          let replyTo: Mensagem | null = null;
          if (novaMensagem.reply_to_message_id) {
            const { data: replyMessage } = await supabase
              .from('mensagens')
              .select('id, texto, tipo, remetente, data_hora, arquivo_url, status')
              .eq('id', novaMensagem.reply_to_message_id)
              .maybeSingle();

            replyTo = (replyMessage as Mensagem | null) ?? null;
          }

          setMensagens((prev) => {
            // Dedup: skip if real ID already exists
            if (prev.some((msg) => msg.id === novaMensagem.id)) return prev;

            // Dedup by message_sid (sync-twilio-messages can re-insert same Twilio msg with different DB id)
            if (novaMensagem.message_sid && prev.some((msg) => (msg as any).message_sid === novaMensagem.message_sid)) {
              return prev;
            }

            // Dedup: same text + same sender within 30s window = duplicate
            // Skip content-based dedup for media messages (images, videos, audio, files)
            // because multiple media items often have the same generic text like "Arquivo 1"
            const isMediaMessage = novaMensagem.tipo && novaMensagem.tipo !== 'texto';
            if (!isMediaMessage) {
              const msgTime = novaMensagem.data_hora ? new Date(novaMensagem.data_hora).getTime() : Date.now();
              const isDuplicateByContent = prev.some(
                (msg) =>
                  !msg.id.startsWith('temp-') &&
                  msg.texto === novaMensagem.texto &&
                  msg.remetente === novaMensagem.remetente &&
                  msg.data_hora &&
                  Math.abs(new Date(msg.data_hora).getTime() - msgTime) < 30000
              );
              if (isDuplicateByContent) return prev;
            }

            // Check if this is a duplicate of an optimistic (temp) message
            const tempIndex = prev.findIndex(
              (msg) =>
                typeof msg.id === 'string' &&
                msg.id.startsWith('temp-') &&
                msg.texto === novaMensagem.texto &&
                (msg.remetente === novaMensagem.remetente ||
                  msg.remetente === 'operador' ||
                  novaMensagem.remetente === 'whatsapp:+554138911555')
            );

            if (tempIndex !== -1) {
              // Replace temp message with real one and keep chronological order
              const updated = [...prev];
              updated[tempIndex] = { ...novaMensagem, reply_to: replyTo };
              return updated.sort((a, b) => {
                const timeA = new Date(a.data_hora).getTime();
                const timeB = new Date(b.data_hora).getTime();
                if (timeA !== timeB) return timeA - timeB;
                return a.id.localeCompare(b.id);
              });
            }

            return [...prev, { ...novaMensagem, reply_to: replyTo }].sort((a, b) => {
              const timeA = new Date(a.data_hora).getTime();
              const timeB = new Date(b.data_hora).getTime();
              if (timeA !== timeB) return timeA - timeB;
              return a.id.localeCompare(b.id);
            });
          });
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'mensagens',
          filter: `cliente_id=eq.${clienteTelefone}`
        },
        (payload) => {
          console.log('[ChatWindow] Mensagem atualizada:', payload);
          setMensagens(prev =>
            prev
              .map(msg =>
                msg.id === payload.new.id
                  ? { ...msg, ...(payload.new as Partial<Mensagem>) }
                  : msg
              )
              .sort((a, b) => {
                const timeA = new Date(a.data_hora).getTime();
                const timeB = new Date(b.data_hora).getTime();
                if (timeA !== timeB) return timeA - timeB;
                return a.id.localeCompare(b.id);
              })
          );
        }
      )
      .subscribe((status) => {
        console.log('[ChatWindow] Status do canal mensagens:', status);
      });

    // Canal adicional para receber broadcasts de mensagens do bot
    const broadcastChannel = supabase
      .channel(`bot-messages-${clienteTelefone}`)
      .on(
        'broadcast',
        { event: 'new-bot-message' },
        (payload: any) => {
          console.log('[ChatWindow] ✅ Broadcast recebido do bot:', payload);
          if (payload.payload) {
            setMensagens(prev => {
              // Evitar duplicatas
              const exists = prev.some(m => m.id === payload.payload.id);
              if (exists) {
                console.log('[ChatWindow] Mensagem já existe, ignorando duplicata');
                return prev;
              }
              console.log('[ChatWindow] Adicionando nova mensagem do bot ao estado');
              return [...prev, payload.payload].sort((a, b) => {
                const timeA = new Date(a.data_hora).getTime();
                const timeB = new Date(b.data_hora).getTime();
                if (timeA !== timeB) return timeA - timeB;
                return a.id.localeCompare(b.id);
              });
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[ChatWindow] Status do canal broadcast:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[ChatWindow] ✅ Canal de broadcast subscrito e pronto para receber mensagens do bot');
        }
      });

    // Canal para monitorar mudanças no status do bot
    const botStatusChannel = supabase
      .channel(`bot-status-${clienteTelefone}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clientes',
          filter: `telefone=eq.${clienteTelefone}`
        },
        (payload) => {
          console.log('[ChatWindow] Status do bot atualizado:', payload);
          if (payload.new && 'bot_habilitado' in payload.new) {
            setBotDesabilitado(payload.new.bot_habilitado === false);
          }
        }
      )
      .subscribe((status) => {
        console.log('[ChatWindow] Status do canal bot-status:', status);
      });

    // Fallback para redes com bloqueio de websocket/realtime (firewall/proxy):
    // consulta uma janela recente para também recuperar mensagens sincronizadas com timestamp antigo.
    const pollingInterval = window.setInterval(async () => {
      const latestDate = latestMessageDateRef.current;
      const pollFromDate = latestDate
        ? new Date(new Date(latestDate).getTime() - 10 * 60 * 1000).toISOString()
        : null;

      let pollingQuery = supabase
        .from('mensagens')
        .select(`
          *,
          enviado_por:profiles!enviado_por_id(full_name)
        `)
        .eq('cliente_id', clienteTelefone)
        .order('data_hora', { ascending: true })
        .limit(200);

      if (pollFromDate) {
        pollingQuery = pollingQuery.gte('data_hora', pollFromDate);
      }

      const { data: mensagensRecentes, error } = await pollingQuery;

      if (!error && mensagensRecentes?.length) {
        setMensagens((prev) => {
          const mensagensPorId = new Map(prev.map((mensagem) => [mensagem.id, mensagem]));

          for (const mensagem of mensagensRecentes as Mensagem[]) {
            const atual = mensagensPorId.get(mensagem.id);
            mensagensPorId.set(mensagem.id, atual ? { ...atual, ...mensagem } : mensagem);
          }

          return Array.from(mensagensPorId.values()).sort((a, b) => {
            const timeA = new Date(a.data_hora).getTime();
            const timeB = new Date(b.data_hora).getTime();
            if (timeA !== timeB) return timeA - timeB;
            return a.id.localeCompare(b.id);
          });
        });
      }

      fetchClienteData();
    }, 30000);

    // Canal de broadcast para takeover requests
    const takeoverChannel = supabase
      .channel(`takeover-${clienteTelefone}`)
      .on('broadcast', { event: 'takeover_request' }, (payload: any) => {
        console.log('[ChatWindow] Takeover request recebido:', payload);
        const data = payload.payload;
        // Só mostrar se EU sou o operador atual
        if (data?.operador_atual_id === user?.id) {
          setTakeoverRequestSolicitanteNome(data.solicitante_nome);
          setTakeoverRequestId(data.request_id);
          takeoverRequestIdRef.current = data.request_id;
          setTakeoverRequestOpen(true);
        }
      })
      .on('broadcast', { event: 'takeover_response' }, (payload: any) => {
        console.log('[ChatWindow] Takeover response recebido:', payload);
        const data = payload.payload;
        if (data?.request_id && data.request_id === takeoverRequestIdRef.current) {
          setTakeoverWaitingOpen(false);
          if (data.response === 'approved') {
            toast.success('Solicitação aprovada! Assumindo conversa...');
            assumirParaMim();
          } else if (data.response === 'denied') {
            toast.error(`${takeoverWaitingOperadorNomeRef.current} negou a solicitação.`);
          }
        }
      })
      .subscribe();
    
    takeoverChannelRef.current = takeoverChannel;

    return () => {
      console.log('[ChatWindow] Limpando canais Realtime');
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(botStatusChannel);
      supabase.removeChannel(takeoverChannel);
      takeoverChannelRef.current = null;
      window.clearInterval(pollingInterval);
    };
  }, [clienteTelefone]);

  // ✅ Controle de scroll: só rola para baixo automaticamente na abertura da conversa
  const userScrolledUpRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // Handler de scroll estável
  const handleContainerScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 80;
    userScrolledUpRef.current = !isAtBottom;
  }, []);

  const forceScrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, []);

  const finalizeInitialScroll = useCallback(() => {
    forceScrollToBottom();
    isInitialLoadRef.current = false;
    userScrolledUpRef.current = false;
  }, [forceScrollToBottom]);

  const scheduleInitialScrollToBottom = useCallback(() => {
    // Repetir após renderizações e carregamento de mídias para garantir posição final
    const retries = [0, 80, 180, 320, 520, 820];
    retries.forEach((delay) => {
      setTimeout(() => {
        if (isInitialLoadRef.current) {
          forceScrollToBottom();
        }
      }, delay);
    });

    setTimeout(() => {
      if (isInitialLoadRef.current) {
        finalizeInitialScroll();
      }
    }, 920);
  }, [finalizeInitialScroll, forceScrollToBottom]);

  // Callback ref para combinar dropZoneRef e messagesContainerRef + listener de scroll
  const setMessagesContainerRef = useCallback((el: HTMLDivElement | null) => {
    // Limpar listener anterior
    if (messagesContainerRef.current) {
      messagesContainerRef.current.removeEventListener('scroll', handleContainerScroll);
    }

    (dropZoneRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    messagesContainerRef.current = el;

    // Adicionar listener no novo elemento
    if (el) {
      el.addEventListener('scroll', handleContainerScroll);
    }
  }, [handleContainerScroll]);

  // Scroll para baixo só no carregamento inicial da conversa
  useEffect(() => {
    if (isInitialLoadRef.current && mensagens.length > 0 && !isLoadingMessages) {
      scheduleInitialScrollToBottom();
    }
  }, [mensagens.length, isLoadingMessages, scheduleInitialScrollToBottom]);

  // Reset do controle de scroll ao trocar de conversa
  useEffect(() => {
    userScrolledUpRef.current = false;
    isInitialLoadRef.current = true;
  }, [clienteTelefone]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (chatSearchOpen) {
          // Se busca estiver aberta, fechar ela primeiro
          setChatSearchOpen(false);
          setChatSearchTerm("");
          setSearchResults([]);
        } else {
          console.log('⌨️ ESC pressionado');
          console.log('🚪 Saindo da conversa');
          onBack?.();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setChatSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onBack, chatSearchOpen]);

  // ✅ Função otimizada para buscar mensagens com paginação
  const fetchMensagens = async (loadMore = false) => {
    console.log('🔍 Buscando mensagens para:', clienteTelefone, loadMore ? '(carregando mais)' : '');
    
    let query = supabase
      .from('mensagens')
      .select(`
        *,
        enviado_por:profiles!enviado_por_id(full_name)
      `)
      .eq('cliente_id', clienteTelefone)
      .order('data_hora', { ascending: false })
      .limit(MESSAGES_PER_PAGE + 1); // +1 para verificar se há mais
    
    // Se carregando mais, buscar mensagens anteriores à mais antiga
    if (loadMore && oldestMessageDate) {
      query = query.lt('data_hora', oldestMessageDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      toast.error('Erro ao carregar mensagens');
      return;
    }
    
    if (data) {
      // Verificar se há mais mensagens
      const hasMore = data.length > MESSAGES_PER_PAGE;
      const messagesToProcess = hasMore ? data.slice(0, MESSAGES_PER_PAGE) : data;
      
      console.log('✅ Mensagens carregadas:', messagesToProcess.length, hasMore ? '(há mais)' : '(fim)');
      
      // ✅ Buscar TODAS as mensagens de reply de uma vez (batch query)
      const replyIds = messagesToProcess
        .filter(m => m.reply_to_message_id)
        .map(m => m.reply_to_message_id);

      const repliesMap = new Map();
      if (replyIds.length > 0) {
        const { data: replyMessages } = await supabase
          .from('mensagens')
          .select('id, texto, tipo, remetente, data_hora, arquivo_url, status')
          .in('id', replyIds);

        replyMessages?.forEach(r => repliesMap.set(r.id, r));
      }

      // ✅ Combinar SEM QUERIES EXTRAS
      const mensagensComReply = messagesToProcess.map(msg => ({
        ...msg,
        reply_to: msg.reply_to_message_id ? repliesMap.get(msg.reply_to_message_id) : null
      }));
      
      // Inverter para ordem cronológica (mais antigas primeiro)
      const mensagensOrdenadas = mensagensComReply.reverse();
      
      if (loadMore) {
        // Adicionar mensagens mais antigas no início
        setMensagens(prev => [...(mensagensOrdenadas as Mensagem[]), ...prev]);
      } else {
        setMensagens(mensagensOrdenadas as Mensagem[]);
      }
      
      // Atualizar estado de paginação
      setHasMoreMessages(hasMore);
      if (mensagensOrdenadas.length > 0) {
        setOldestMessageDate(mensagensOrdenadas[0].data_hora);
      }
    }
  };

  // ✅ Função para carregar mais mensagens
  const loadMoreMessages = async () => {
    setIsLoadingMore(true);
    await fetchMensagens(true);
    setIsLoadingMore(false);
    // Manter scroll na posição após carregar mais
    messagesStartRef.current?.scrollIntoView({ block: 'start' });
  };

  const getSenderForTranscript = (msg: Mensagem) => {
    if (msg.remetente === 'bot') return 'Bot';
    if (isAtendente(msg.remetente)) return 'Operador';
    return 'Cliente';
  };

  const getMediaLabel = (msg: Mensagem) => {
    if (msg.tipo === 'imagem') {
      const nomeArquivo = msg.texto?.trim() || msg.arquivo_url?.split('/').pop() || 'imagem';
      return `[Imagem: ${nomeArquivo}]`;
    }
    if (msg.tipo === 'audio') return '[Áudio]';
    if (msg.tipo === 'video') return '[Vídeo]';
    if (msg.tipo === 'arquivo') return `[Arquivo: ${msg.texto || msg.arquivo_url?.split('/').pop() || 'arquivo'}]`;
    return '[Mensagem]';
  };

  const exportarTranscricaoPDF = () => {
    if (mensagens.length === 0) {
      toast.error('Não há mensagens para transcrever.');
      return;
    }

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;
    const maxTextWidth = pageWidth - margin * 2;
    let currentY = margin;

    const titulo = `Transcrição da conversa - ${clienteNome}`;
    const subtitulo = `Cliente: ${clienteNome} (${clienteTelefone})`;
    const geradoEm = `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text(titulo, margin, currentY);
    currentY += 20;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(subtitulo, margin, currentY);
    currentY += 14;
    pdf.text(geradoEm, margin, currentY);
    currentY += 24;

    mensagens.forEach((msg) => {
      const horario = format(new Date(msg.data_hora), 'dd/MM/yyyy HH:mm', { locale: ptBR });
      const remetente = getSenderForTranscript(msg);
      const conteudo = msg.tipo === 'texto'
        ? (msg.texto?.trim() || '[Mensagem sem texto]')
        : getMediaLabel(msg);

      const linha = `[${horario}] ${remetente}: ${conteudo}`;
      const linhasQuebradas = pdf.splitTextToSize(linha, maxTextWidth);
      const alturaBloco = linhasQuebradas.length * 12 + 4;

      if (currentY + alturaBloco > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
      }

      pdf.text(linhasQuebradas, margin, currentY);
      currentY += alturaBloco;
    });

    const nomeArquivo = `transcricao-${clienteNome.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`;
    const blobUrl = pdf.output('bloburl');
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    pdf.save(nomeArquivo);
    toast.success('Transcrição em PDF gerada com sucesso.');
  };

  // ✅ Função consolidada para buscar dados do cliente (ficha, bot, atendente, notas)
  const fetchClienteData = async () => {
    try {
    const { data: clienteData } = await supabase
      .from('clientes')
      .select(`
        ficha_ativa_id,
        bot_habilitado,
        notas_internas,
        atendente_id,
        atendente:profiles!atendente_id(full_name)
      `)
      .eq('telefone', clienteTelefone)
      .maybeSingle();

    if (clienteData) {
      // Bot status
      setBotDesabilitado(clienteData.bot_habilitado === false);
      
      // Notas
      setNotasInternas(clienteData.notas_internas || "");
      setHasNotas(!!clienteData.notas_internas && clienteData.notas_internas.trim().length > 0);
      
      // Atendente
      if (clienteData.atendente_id && (clienteData as any).atendente) {
        setAtendenteAtual({
          id: clienteData.atendente_id,
          nome: (clienteData as any).atendente.full_name
        });
      }
      
      // Ficha - respeitar ficha_ativa_id, validando que existe
      if (clienteData.ficha_ativa_id) {
        // Validar que a ficha ativa realmente existe
        const { data: fichaAtivaData } = await supabase
          .from('fichas_de_servico')
          .select('id')
          .eq('id', clienteData.ficha_ativa_id)
          .eq('telefone_cliente', clienteTelefone)
          .maybeSingle();

        if (fichaAtivaData) {
          setFichaId(fichaAtivaData.id);
        } else {
          // ficha_ativa_id inválida, buscar última e corrigir
          const { data: ultimaFicha } = await supabase
            .from('fichas_de_servico')
            .select('id')
            .eq('telefone_cliente', clienteTelefone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (ultimaFicha) {
            setFichaId(ultimaFicha.id);
            // Persistir correção
            await supabase
              .from('clientes')
              .update({ ficha_ativa_id: ultimaFicha.id })
              .eq('telefone', clienteTelefone);
          }
        }
      } else {
        // Sem ficha_ativa_id: pegar última ficha criada e persistir
        const { data: ultimaFicha } = await supabase
          .from('fichas_de_servico')
          .select('id')
          .eq('telefone_cliente', clienteTelefone)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ultimaFicha) {
          setFichaId(ultimaFicha.id);
          // Persistir para evitar fallback repetido
          await supabase
            .from('clientes')
            .update({ ficha_ativa_id: ultimaFicha.id })
            .eq('telefone', clienteTelefone);
        }
      }
    }
    
    // Buscar última ação do bot
    const { data: ultimaAcao } = await supabase
      .from('bot_historico')
      .select('acao, created_at, executado_por_id')
      .eq('telefone_cliente', clienteTelefone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (ultimaAcao) {
      let nomeExecutor = null;
      if (ultimaAcao.executado_por_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', ultimaAcao.executado_por_id)
          .single();
        nomeExecutor = profile?.full_name || null;
      }
      
      setUltimaAcaoBot({
        acao: ultimaAcao.acao,
        por: nomeExecutor,
        quando: ultimaAcao.created_at
      });
    }
    } catch (err) {
      console.error('Erro ao buscar dados do cliente:', err);
    }
  };

  const clearUnreadMark = async () => {
    if (!user) return;
    // Per-operator read status
    await (supabase as any)
      .from('mensagem_leitura_operador')
      .upsert(
        { cliente_telefone: clienteTelefone, user_id: user.id, last_read_at: new Date().toISOString() },
        { onConflict: 'cliente_telefone,user_id' }
      );
    // Legacy: also clear global flag
    await supabase
      .from('clientes')
      .update({ marcado_nao_lido: false })
      .eq('telefone', clienteTelefone);
  };

  // ✅ Removidas funções duplicadas - consolidadas em fetchClienteData()
  // fetchFichaId, fetchBotStatus, fetchAtendente, fetchNotas foram mescladas

  const fetchAtendentes = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name');
    
    if (data) {
      setTodosAtendentes(data.map(p => ({
        id: p.id,
        nome: p.full_name || 'Sem nome'
      })));
    }
  };

  const atribuirOperador = async (operadorId: string, operadorNome: string, descricao?: string) => {
    const { error } = await supabase
      .from('clientes')
      .update({ atendente_id: operadorId })
      .eq('telefone', clienteTelefone);

    if (error) {
      toast.error('Erro ao atribuir operador');
    } else {
      setAtendenteAtual({ id: operadorId, nome: operadorNome });
      toast.success(`Atribuído para ${operadorNome}`);

      // Register as atribuicao_chat task in tarefas_operacionais
      try {
        const tarefaId = crypto.randomUUID();
        await (supabase as any)
          .from("tarefas_operacionais")
          .insert({
            id: tarefaId,
            titulo: `Chat atribuído: ${clienteNome || clienteTelefone}`,
            descricao: descricao || null,
            urgencia: "media",
            tipo: "atribuicao_chat",
            criado_por: user?.id,
            cliente_telefone: clienteTelefone,
          });

        await (supabase as any)
          .from("tarefas_operacionais_atribuidos")
          .insert({ tarefa_id: tarefaId, user_id: operadorId });
      } catch {}
    }
  };

  // Handler for opening description dialog before assigning
  const iniciarAtribuicao = (operadorId: string, operadorNome: string) => {
    setPendingAtribuicao({ id: operadorId, nome: operadorNome });
    setAtribuicaoDialogOpen(true);
  };
  const assumirParaMim = async () => {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    
    const nome = profile?.full_name || 'Você';
    await atribuirOperador(user.id, nome);
  };

  // Função para iniciar solicitação de takeover
  const iniciarTakeover = async () => {
    if (!user || !atendenteAtual) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    
    const meuNome = profile?.full_name || 'Operador';
    
    // Criar registro na tabela
    const { data: request, error } = await supabase
      .from('takeover_requests')
      .insert({
        telefone_cliente: clienteTelefone,
        solicitante_id: user.id,
        solicitante_nome: meuNome,
        operador_atual_id: atendenteAtual.id,
        status: 'pending'
      })
      .select('id')
      .single();
    
    if (error) {
      toast.error('Erro ao solicitar takeover');
      return;
    }
    
    // Enviar broadcast
    takeoverChannelRef.current?.send({
      type: 'broadcast',
      event: 'takeover_request',
      payload: {
        request_id: request.id,
        solicitante_id: user.id,
        solicitante_nome: meuNome,
        operador_atual_id: atendenteAtual.id,
      }
    });
    
    setTakeoverWaitingOperadorNome(atendenteAtual.nome);
    takeoverWaitingOperadorNomeRef.current = atendenteAtual.nome;
    setTakeoverRequestId(request.id);
    takeoverRequestIdRef.current = request.id;
    setTakeoverWaitingOpen(true);
  };

  // Handlers de resposta do takeover (operador atual)
  const handleTakeoverApprove = async () => {
    setTakeoverRequestOpen(false);
    
    // Atualizar registro
    if (takeoverRequestId) {
      await supabase
        .from('takeover_requests')
        .update({ status: 'approved', responded_at: new Date().toISOString() })
        .eq('id', takeoverRequestId);
    }
    
    // Enviar broadcast de aprovação
    takeoverChannelRef.current?.send({
      type: 'broadcast',
      event: 'takeover_response',
      payload: {
        response: 'approved',
        solicitante_id: null, // será preenchido pelo listener
        request_id: takeoverRequestId,
      }
    });
    
    toast.info('Conversa transferida.');
  };

  const handleTakeoverDeny = async () => {
    setTakeoverRequestOpen(false);
    
    if (takeoverRequestId) {
      await supabase
        .from('takeover_requests')
        .update({ status: 'denied', responded_at: new Date().toISOString() })
        .eq('id', takeoverRequestId);
    }
    
    takeoverChannelRef.current?.send({
      type: 'broadcast',
      event: 'takeover_response',
      payload: {
        response: 'denied',
        solicitante_id: null,
        request_id: takeoverRequestId,
      }
    });
    
    toast.info('Solicitação de takeover negada.');
  };

  const handleTakeoverTimeout = async () => {
    setTakeoverWaitingOpen(false);
    
    // Marcar como expired
    if (takeoverRequestId) {
      await supabase
        .from('takeover_requests')
        .update({ status: 'expired', responded_at: new Date().toISOString() })
        .eq('id', takeoverRequestId);
    }
    
    toast.success('Tempo esgotado. Assumindo conversa automaticamente...');
    await assumirParaMim();
  };

  const removerAtribuicao = async () => {
    const { error } = await supabase
      .from('clientes')
      .update({ atendente_id: null })
      .eq('telefone', clienteTelefone);

    if (error) {
      toast.error('Erro ao remover atribuição');
    } else {
      setAtendenteAtual(null);
      toast.success('Atribuição removida');
    }
  };

  const salvarNotas = async () => {
    const { error } = await supabase
      .from('clientes')
      .update({ notas_internas: notasInternas })
      .eq('telefone', clienteTelefone);

    if (error) {
      toast.error('Erro ao salvar notas');
    } else {
      setHasNotas(!!notasInternas && notasInternas.trim().length > 0);
      setNotasDialogOpen(false);
      toast.success('Notas salvas com sucesso');
    }
  };

  // Busca no chat
  useEffect(() => {
    if (!chatSearchTerm.trim()) {
      setSearchResults([]);
      setCurrentResultIndex(0);
      return;
    }

    const results = mensagens
      .filter(msg => 
        msg.texto && 
        msg.texto.toLowerCase().includes(chatSearchTerm.toLowerCase())
      )
      .map(msg => msg.id);

    setSearchResults(results);
    setCurrentResultIndex(results.length > 0 ? 0 : -1);

    // Scroll para o primeiro resultado
    if (results.length > 0) {
      scrollToMessage(results[0]);
    }
  }, [chatSearchTerm, mensagens]);

  const navigateSearch = (direction: 'prev' | 'next') => {
    if (searchResults.length === 0) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = (currentResultIndex + 1) % searchResults.length;
    } else {
      newIndex = currentResultIndex - 1 < 0 ? searchResults.length - 1 : currentResultIndex - 1;
    }

    setCurrentResultIndex(newIndex);
    scrollToMessage(searchResults[newIndex]);
  };

  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;
    
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === searchTerm.toLowerCase() 
        ? `<mark class="bg-yellow-300 dark:bg-yellow-600">${part}</mark>`
        : part
    ).join('');
  };

  // Função para processar arquivo selecionado (cria preview sem enviar)
  const handleFileSelect = (file: File) => {
    if (statusConversa === "fechada") {
      toast.error("Conversa fechada! Use templates aprovados para enviar mensagens.");
      return;
    }

    // Verificar tipo de arquivo
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const isPDF = file.type === 'application/pdf';

    if (!isImage && !isVideo && !isAudio && !isPDF) {
      toast.error("Apenas imagens, vídeos, áudios e PDFs são suportados");
      return;
    }

    // Determinar tipo
    let tipo: 'imagem' | 'video' | 'audio' | 'arquivo' = 'imagem';
    if (isVideo) tipo = 'video';
    if (isAudio) tipo = 'audio';
    if (isPDF) tipo = 'arquivo';

    // Criar URL de preview
    const previewUrl = URL.createObjectURL(file);
    
    setPendingFile({ file, previewUrl, type: tipo });
  };

  // Handler para input de arquivo
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input para permitir selecionar mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remover arquivo pendente
  const removePendingFile = () => {
    if (pendingFile) {
      URL.revokeObjectURL(pendingFile.previewUrl);
      setPendingFile(null);
    }
  };

  // Drag and Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (statusConversa === "fechada") return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Só sair do modo drag se realmente saiu da área
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (statusConversa === "fechada") {
      toast.error("Conversa fechada! Use templates aprovados para enviar mensagens.");
      return;
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Handler para colar imagem da área de transferência (Ctrl+V / Cmd+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    if (statusConversa === "fechada") return;
    
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleFileSelect(file);
        }
        return;
      }
    }
  };

  // Função para fazer upload e enviar arquivo
  const uploadAndSendFile = async () => {
    if (!pendingFile) return;

    // Auto-atribuir operador se ainda não atribuído
    if (!atendenteAtual) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        await atribuirOperador(user.id, profile?.full_name || 'Você');
      }
    }

    setUploading(true);
    try {
      // Upload para Supabase Storage
      const fileExt = pendingFile.file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `chat-media/${clienteTelefone}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, pendingFile.file);

      if (uploadError) {
        console.error("Erro ao fazer upload:", uploadError);
        throw new Error(`Erro ao fazer upload: ${uploadError.message || 'erro desconhecido'}`);
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      const mediaUrl = urlData.publicUrl;

      // Obter usuário atual para registrar quem enviou
      const { data: { user } } = await supabase.auth.getUser();

      // Gerar ou reusar conversation_id
      const convId = conversationId || crypto.randomUUID();
      if (!conversationId) setConversationId(convId);

      const operadorNome = userProfile?.fullName || user?.email?.split('@')[0] || 'Operador';

      // Enviar via Twilio apenas com o arquivo
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: clienteTelefone,
          message: "",
          mediaUrl: mediaUrl,
          userId: user?.id,
          ficha_id: fichaId || null,
          conversation_id: convId,
          operador_nome: operadorNome,
          tipo_remetente: 'atendente'
        },
      });

      if (error) {
        console.error("Erro ao enviar via Twilio:", error);
        throw error;
      }

      if (!data.success) {
        if (data.error === 'FORA_JANELA_24H') {
          toast.error("Conversa fora da janela de 24h. Use um template aprovado.");
          return;
        }
        throw new Error(data.error || "Erro ao enviar mídia");
      }

      toast.success(`${pendingFile.type === 'imagem' ? 'Imagem' : pendingFile.type === 'video' ? 'Vídeo' : pendingFile.type === 'audio' ? 'Áudio' : 'Arquivo'} enviado via WhatsApp`);
      
      // Limpar arquivo pendente
      removePendingFile();
    } catch (error) {
      console.error("Erro ao enviar mídia:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mídia");
    } finally {
      setUploading(false);
    }
  };

  // Handler para áudio gravado
  const handleAudioRecording = async (audioBlob: Blob) => {
    if (statusConversa === "fechada") {
      toast.error("Conversa fechada! Use templates aprovados para enviar mensagens.");
      return;
    }

    // Auto-atribuir operador se ainda não atribuído
    if (!atendenteAtual) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        await atribuirOperador(user.id, profile?.full_name || 'Você');
      }
    }

    setUploading(true);
    try {
      const mimeType = audioBlob.type;
      let finalBlob = audioBlob;
      let ext = 'mp3';
      let contentType = 'audio/mpeg';

      // Se for WebM (Chrome) ou formato não compatível, converter para MP3
      if (mimeType.includes('webm') || (!mimeType.includes('ogg') && !mimeType.includes('mp'))) {
        toast.info("Convertendo áudio...");
        const { convertToMp3 } = await import('@/lib/audioConverter');
        finalBlob = await convertToMp3(audioBlob);
        ext = 'mp3';
        contentType = 'audio/mpeg';
      } 
      // Se for OGG/Opus (Firefox), usar diretamente
      else if (mimeType.includes('ogg')) {
        ext = 'ogg';
        contentType = 'audio/ogg';
      }
      // Se já for MP3/MPEG, usar diretamente
      else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
        ext = 'mp3';
        contentType = 'audio/mpeg';
      }

      const fileName = `audio_${Date.now()}.${ext}`;
      const filePath = `chat-media/${clienteTelefone}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, finalBlob, { contentType });

      if (uploadError) {
        console.error("Erro ao fazer upload do áudio:", uploadError);
        throw new Error("Erro ao fazer upload do áudio");
      }

      const { data: urlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      const mediaUrl = urlData.publicUrl;

      const { data: { user } } = await supabase.auth.getUser();

      // Gerar ou reusar conversation_id para áudio
      const convId = conversationId || crypto.randomUUID();
      if (!conversationId) setConversationId(convId);

      const operadorNome = userProfile?.fullName || user?.email?.split('@')[0] || 'Operador';

      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: clienteTelefone,
          message: "",
          mediaUrl: mediaUrl,
          userId: user?.id,
          ficha_id: fichaId || null,
          conversation_id: convId,
          operador_nome: operadorNome,
          tipo_remetente: 'atendente'
        },
      });

      if (error) {
        console.error("Erro ao enviar áudio via Twilio:", error);
        throw error;
      }

      if (!data.success) {
        if (data.error === 'FORA_JANELA_24H') {
          toast.error("Conversa fora da janela de 24h. Use um template aprovado.");
          return;
        }
        throw new Error(data.error || "Erro ao enviar áudio");
      }

      toast.success("Áudio enviado!");
    } catch (error) {
      console.error("Erro ao enviar áudio:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o áudio");
    } finally {
      setUploading(false);
    }
  };

  const enviarMensagem = async () => {
    // Se tem arquivo pendente, enviar o arquivo
    if (pendingFile) {
      await uploadAndSendFile();
      return;
    }

    if (!novaMsg.trim() || isSending) return;

    if (statusConversa === "fechada") {
      toast.error("Conversa fechada! Use templates aprovados para enviar mensagens.");
      return;
    }

    setIsSending(true);
    const mensagemTexto = novaMsg;

    try {
      // Auto-atribuir operador se ainda não atribuído
      if (!atendenteAtual) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
          
          await atribuirOperador(user.id, profile?.full_name || 'Você');
        }
      }
      
      console.log('📤 [enviarMensagem] Preparando envio:', {
        texto: mensagemTexto.substring(0, 50)
      });
      
      setNovaMsg(""); // Limpar imediatamente para UX

      // Optimistic update - adicionar mensagem localmente
      const tempId = `temp-${Date.now()}`;
      const novaMensagemTemp: Mensagem = {
        id: tempId,
        texto: mensagemTexto,
        tipo: "texto",
        arquivo_url: null,
        data_hora: new Date().toISOString(),
        remetente: NUMERO_24HELP,
        status: "enviado",
        reply_to_message_id: replyingTo?.id || null,
        reply_to: replyingTo || null
      };
      
      const replyId = replyingTo?.id || null;
      setReplyingTo(null); // Clear reply immediately
      
      setMensagens(prev => [...prev, novaMensagemTemp]);

      // Obter usuário atual para registrar quem enviou
      const { data: { user } } = await supabase.auth.getUser();

      console.log('🚀 Invocando send-whatsapp com:', {
        to: clienteTelefone,
        message: mensagemTexto.substring(0, 50),
        userId: user?.id
      });
      
      // Gerar ou reusar conversation_id
      const convId = conversationId || crypto.randomUUID();
      if (!conversationId) setConversationId(convId);

      const operadorNome = userProfile?.fullName || user?.email?.split('@')[0] || 'Operador';

      // Enviar via Twilio
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: clienteTelefone,
          message: mensagemTexto,
          userId: user?.id,
          replyToMessageId: replyId,
          ficha_id: fichaId || null,
          conversation_id: convId,
          operador_nome: operadorNome,
          tipo_remetente: 'atendente'
        },
      });
      
      console.log('📬 Resposta do send-whatsapp:', { data, error });

      if (error) throw error;

      if (!data.success) {
        // Remover mensagem temporária em caso de erro
        setMensagens(prev => prev.filter(m => m.id !== tempId));
        
        if (data.error === 'FORA_JANELA_24H') {
          toast.error("Conversa fora da janela de 24h. Use um template aprovado.");
          return;
        }
        throw new Error(data.error || "Erro ao enviar mensagem");
      }

      // Mensagem enviada com sucesso - o realtime vai atualizar com a mensagem real do banco
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      // Remover mensagem temporária em caso de erro
      setMensagens(prev => prev.filter(m => !m.id.startsWith('temp-')));
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem");
      setNovaMsg(mensagemTexto); // Restaurar texto original (capturado na linha 1412)
    } finally {
      setIsSending(false);
    }
  };

  // Função para verificar estado atual e abrir dialog
  const handleAssumirClick = async () => {
    // Buscar estado atual do banco antes de abrir o dialog para garantir sincronização
    const { data } = await supabase
      .from('clientes')
      .select('bot_habilitado')
      .eq('telefone', clienteTelefone)
      .single();
    
    if (data) {
      const botDesativado = data.bot_habilitado === false;
      setBotDesabilitado(botDesativado);
      // 🔒 Capturar estado FIXO para uso durante toda a interação do dialog
      // Este valor NÃO será atualizado pelo realtime, prevenindo race conditions
      setBotStatusNoDialog(botDesativado);
    }
    setAssumirDialogOpen(true);
  };

  const toggleBot = async () => {
    // Prevenir clique duplo
    if (isTogglingBot) return;
    
    // 🔒 Verificar se estado foi capturado corretamente ao abrir o dialog
    if (botStatusNoDialog === null) {
      toast.error("Estado do bot não foi capturado corretamente. Tente novamente.");
      setAssumirDialogOpen(false);
      return;
    }
    
    setIsTogglingBot(true);

    try {
      // 🔒 VERIFICAÇÃO DE SEGURANÇA: buscar estado ATUAL do banco antes de executar
      const { data: clienteAtual, error: fetchError } = await supabase
        .from('clientes')
        .select('bot_habilitado')
        .eq('telefone', clienteTelefone)
        .single();
      
      if (fetchError) {
        throw new Error("Erro ao verificar estado atual do bot");
      }
      
      const botRealmenteDesabilitado = clienteAtual?.bot_habilitado === false;
      
      // 🔒 Se o estado mudou desde a abertura do dialog, abortar e notificar
      if (botRealmenteDesabilitado !== botStatusNoDialog) {
        toast.warning(
          "O estado do bot mudou! Por favor, tente novamente.",
          { description: "Outra pessoa ou o sistema alterou o status enquanto o dialog estava aberto." }
        );
        setAssumirDialogOpen(false);
        setBotDesabilitado(botRealmenteDesabilitado);
        setBotStatusNoDialog(null);
        return;
      }
      
      // Obter ID do usuário logado e nome
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      // Obter nome do usuário para feedback
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      const userName = profile?.full_name || 'Você';

      // 🔒 Usar botStatusNoDialog (estado capturado) ao invés de botDesabilitado (pode ter mudado via realtime)
      // Se o bot está habilitado (não desabilitado), precisamos encerrar o fluxo ativo
      if (!botStatusNoDialog) {
        console.log(`[ChatWindow] Encerrando fluxo ativo do bot para ${clienteTelefone}`);
        
        const { data, error } = await supabase.functions.invoke('stop-twilio-flow', {
          body: {
            telefone: clienteTelefone,
            executado_por_id: userId
          }
        });

        if (error) throw error;

        if (data?.success) {
          setBotDesabilitado(true);
          toast.success(`Bot desabilitado por ${userName}`);
          setUltimaAcaoBot({
            acao: 'desabilitado',
            por: userName,
            quando: new Date().toISOString()
          });
          console.log(`[ChatWindow] ✅ Fluxo encerrado: ${data.executionSid}`);
        } else {
          // Não havia execução ativa, mas ainda desabilita o bot
          const { error: toggleError } = await supabase.functions.invoke('toggle-bot-status', {
            body: {
              telefone: clienteTelefone,
              bot_status: 'disabled',
              origem: 'manual',
              executado_por_id: userId
            }
          });

          if (toggleError) throw toggleError;
          
          setBotDesabilitado(true);
          toast.success(`Bot desabilitado por ${userName}`);
          setUltimaAcaoBot({
            acao: 'desabilitado',
            por: userName,
            quando: new Date().toISOString()
          });
        }
      } else {
        // Reativar bot
        const { error } = await supabase.functions.invoke('toggle-bot-status', {
          body: {
            telefone: clienteTelefone,
            bot_status: 'enabled',
            origem: 'manual',
            executado_por_id: userId
          }
        });

        if (error) throw error;

        setBotDesabilitado(false);
        toast.success(`Bot reativado por ${userName}`);
        setUltimaAcaoBot({
          acao: 'habilitado',
          por: userName,
          quando: new Date().toISOString()
        });
      }
      
      setAssumirDialogOpen(false);
      setBotStatusNoDialog(null); // Limpar estado capturado após uso
    } catch (error) {
      console.error("[ChatWindow] Erro ao alterar status do bot:", error);
      toast.error("Não foi possível alterar o status do bot");
    } finally {
      setIsTogglingBot(false);
    }
  };


  const scrollToMessage = useCallback((messageId: string) => {
    const messageElement = messageRefs.current[messageId];
    if (!messageElement) {
      console.warn('⚠️ Elemento da mensagem não encontrado:', messageId);
      return;
    }
    
    messageElement.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
    
    // Adicionar highlight
    setHighlightedMessageId(messageId);
    console.log('✨ Highlight aplicado em:', messageId);
    
    // Remover após 5 segundos
    setTimeout(() => {
      setHighlightedMessageId(null);
      console.log('🔄 Highlight removido');
    }, 5000);
  }, []);

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const shouldShowDateSeparator = (currentMsg: Mensagem, previousMsg?: Mensagem) => {
    if (!previousMsg) return true;
    const currentDate = new Date(currentMsg.data_hora);
    const previousDate = new Date(previousMsg.data_hora);
    return !isSameDay(currentDate, previousDate);
  };

  const keepBottomOnInitialMediaLoad = () => {
    if (isInitialLoadRef.current) {
      forceScrollToBottom();
    }
  };

  const renderMedia = (msg: Mensagem) => {
    if (!msg.arquivo_url) return null;

    if (msg.tipo === 'imagem') {
      return (
        <img 
          src={msg.arquivo_url} 
          alt="Imagem" 
          className="max-w-[280px] max-h-[280px] rounded-xl mt-2 cursor-pointer hover:opacity-95 transition-all shadow-sm hover:shadow-md object-cover" 
          onLoad={keepBottomOnInitialMediaLoad}
          onClick={() => window.open(msg.arquivo_url || '', '_blank')}
        />
      );
    }
    
    if (msg.tipo === 'video') {
      return (
        <video 
          controls 
          className="max-w-[280px] max-h-[280px] rounded-xl mt-2 shadow-sm"
          onLoadedMetadata={keepBottomOnInitialMediaLoad}
        >
          <source src={msg.arquivo_url} />
        </video>
      );
    }
    
    if (msg.tipo === 'audio') {
      return (
        <div className="mt-2">
          <AudioPlayer src={msg.arquivo_url} />
          {msg.transcricao_texto && (
            <div className="mt-1.5 px-2 py-1 bg-muted/40 rounded-lg text-xs text-muted-foreground italic border-l-2 border-primary/30">
              📝 {msg.transcricao_texto}
            </div>
          )}
        </div>
      );
    }

    if (msg.tipo === 'arquivo') {
      return (
        <a 
          href={msg.arquivo_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-3 mt-2 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all shadow-sm hover:shadow-md max-w-[280px]"
        >
          <FileIcon className="h-5 w-5 shrink-0" />
          <span className="text-sm truncate flex-1">{msg.texto || 'Arquivo'}</span>
        </a>
      );
    }

    return null;
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <header className="bg-card border-b h-14 flex items-center justify-between gap-3 px-4 shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="lg:hidden shrink-0 h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-sm md:text-base truncate">{clienteNome}</h2>
            {fichaId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                <FileText className="h-3 w-3" />
                Ficha Ativa
              </span>
            )}
            <StatusConexaoTwilio telefoneCliente={clienteTelefone} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground truncate">{clienteTelefone}</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs font-medium cursor-help">
                    Bot: <span className={botDesabilitado ? "text-destructive" : "text-green-600"}>
                      {botDesabilitado ? "Desativado" : "Ativado"}
                    </span>
                    {ultimaAcaoBot && ultimaAcaoBot.por && (
                      <span className="text-muted-foreground ml-1">
                        por {ultimaAcaoBot.por.split(' ')[0]}
                      </span>
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {ultimaAcaoBot ? (
                    <div className="text-xs">
                      <p><strong>{ultimaAcaoBot.acao === 'habilitado' ? 'Ativado' : 'Desativado'}</strong></p>
                      {ultimaAcaoBot.por && <p>Por: {ultimaAcaoBot.por}</p>}
                      <p>Em: {format(new Date(ultimaAcaoBot.quando), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                  ) : (
                    <p className="text-xs">Sem histórico de alterações</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!fichaOpen && (
            <>
              {/* Botão copiar info do serviço para prestador */}
              {fichaId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyServiceInfo}
                  className="h-9 px-2 hover:bg-accent"
                  title="Copiar informações do serviço para enviar ao prestador"
                >
                  <ClipboardList className="h-4 w-4" />
                </Button>
              )}
              {/* Botão de busca no chat */}
              <Button
                variant="ghost"
                size="sm"
                onClick={exportarTranscricaoPDF}
                className="h-9 px-2 hover:bg-accent"
                title="Exportar transcrição da conversa (PDF)"
              >
                <ScrollText className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChatSearchOpen(!chatSearchOpen)}
                className={cn(
                  "h-9 px-2 hover:bg-accent",
                  chatSearchOpen && "bg-accent"
                )}
                title="Buscar mensagens (Ctrl+F)"
              >
                <SearchIcon className="h-4 w-4" />
              </Button>

              <AbrirConversaDialog
                clienteTelefone={clienteTelefone}
                clienteNome={clienteNome}
              />
              
              {/* Botão de atribuição de operador - com controle de permissão */}
              {canReassign ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2 hover:bg-accent"
                      title={atendenteAtual ? `Atribuído: ${atendenteAtual.nome}` : "Atribuir operador"}
                    >
                      {atendenteAtual ? (
                        <div className="flex items-center gap-1.5">
                          <div className={cn(
                            "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold",
                            isMyTicket ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          )}>
                            {atendenteAtual.nome.charAt(0).toUpperCase()}
                          </div>
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </div>
                      ) : (
                        <Users className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="end">
                    <div className="space-y-1">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Atribuir Operador
                      </div>
                      <Separator />
                      
                      {/* Opção para assumir automaticamente */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-8"
                        onClick={async () => {
                          if (user) {
                            const { data: profile } = await supabase
                              .from('profiles')
                              .select('full_name')
                              .eq('id', user.id)
                              .single();
                            
                            await atribuirOperador(user.id, profile?.full_name || 'Você');
                          }
                        }}
                      >
                        <UserCheckIcon className="h-3.5 w-3.5 mr-2" />
                        Assumir para mim
                      </Button>

                      {/* Lista de outros operadores - para supervisores/admins e dono do ticket */}
                      {(isSupervisor || isMyTicket) && (
                        <>
                          <Separator />
                          <div className="max-h-48 overflow-y-auto">
                            <div className="px-2 py-1 text-[11px] text-muted-foreground">
                              Atribuir para outro:
                            </div>
                            {todosAtendentes.filter(a => a.id !== user?.id).map(a => (
                              <Button
                                key={a.id}
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "w-full justify-start text-xs h-8",
                                  atendenteAtual?.id === a.id && "bg-accent"
                                )}
                                onClick={() => iniciarAtribuicao(a.id, a.nome)}
                              >
                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-foreground text-[10px] font-semibold mr-2">
                                  {a.nome.charAt(0).toUpperCase()}
                                </div>
                                {a.nome}
                                {atendenteAtual?.id === a.id && (
                                  <Check className="h-3 w-3 ml-auto text-primary" />
                                )}
                              </Button>
                            ))}
                          </div>

                          <Separator />

                          {/* Opção para remover atribuição - supervisores ou dono do ticket */}
                          {atendenteAtual && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={removerAtribuicao}
                            >
                              <X className="h-3.5 w-3.5 mr-2" />
                              Remover atribuição
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                /* Ticket de outro atendente - usuário comum pode solicitar takeover */
                <div className="flex items-center gap-1.5">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-foreground text-[10px] font-semibold">
                            {atendenteAtual?.nome.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-muted-foreground">{atendenteAtual?.nome}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Atribuído a {atendenteAtual?.nome}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={iniciarTakeover}
                  >
                    <UserCheckIcon className="h-3 w-3" />
                    Assumir
                  </Button>
                </div>
              )}

              {/* Botão de notas internas */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNotasDialogOpen(true)}
                className="h-9 px-2 hover:bg-accent relative"
                title="Notas Internas"
              >
                <MessageSquare className="h-4 w-4" />
                {hasNotas && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
                )}
              </Button>

              {/* Botão de histórico do bot */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBotHistoricoOpen(true)}
                className="h-9 px-2 hover:bg-accent"
                title="Histórico do Bot"
              >
                <History className="h-4 w-4" />
              </Button>

              {/* Botão Avaliação do Prestador */}
              <AvaliacaoPrestadorFlowPanel
                clienteTelefone={clienteTelefone}
                clienteNome={clienteNome}
                fichaId={fichaId}
                onCopyMessage={(msg) => setNovaMsg(msg)}
              />

              {/* Botão NPS */}
              <NPSFlowPanel
                clienteTelefone={clienteTelefone}
                clienteNome={clienteNome}
                fichaId={fichaId}
                onCopyMessage={(msg) => setNovaMsg(msg)}
              />
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleAssumirClick}
                className={cn(
                  "h-9 hover:scale-[0.98] active:scale-95 transition-transform",
                  botDesabilitado && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                )}
              >
                <UserCheck className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">
                  {botDesabilitado ? "Assumido" : "Assumir"}
                </span>
                {botDesabilitado && (
                  <Check className="h-4 w-4 ml-1 text-green-600 dark:text-green-400" />
                )}
              </Button>
            </>
          )}

          {onToggleFicha && (
            <Button
              onClick={onToggleFicha}
              size="sm"
              className={cn(
                "h-9 transition-all duration-200 hover:scale-[0.98] active:scale-95",
                fichaOpen 
                  ? "bg-green-700 hover:bg-green-800 text-white shadow-md" 
                  : "bg-green-600 hover:bg-green-700 text-white shadow-sm"
              )}
            >
              <FileText className="h-4 w-4" />
              <span className="ml-2 hidden md:inline">Ficha</span>
            </Button>
          )}
        </div>
      </header>

      {/* Barra de busca no chat */}
      {chatSearchOpen && (
        <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar mensagem..."
              value={chatSearchTerm}
              onChange={(e) => setChatSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
          
          {searchResults.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <span className="font-medium">
                {currentResultIndex + 1} de {searchResults.length}
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateSearch('prev')}
              disabled={searchResults.length === 0}
              className="h-7 w-7"
              title="Anterior"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateSearch('next')}
              disabled={searchResults.length === 0}
              className="h-7 w-7"
              title="Próximo"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setChatSearchOpen(false);
                setChatSearchTerm("");
                setSearchResults([]);
              }}
              className="h-7 w-7"
              title="Fechar busca"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog 
        open={assumirDialogOpen} 
        onOpenChange={(open) => {
          setAssumirDialogOpen(open);
          if (!open) {
            setConfirmacaoTexto("");
            setBotStatusNoDialog(null); // 🔒 Limpar estado isolado ao fechar
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {/* 🔒 Usar botStatusNoDialog (estado capturado) para renderização do dialog */}
              {botStatusNoDialog ? "Reativar Bot?" : "Assumir Atendimento"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {/* 🔒 Usar botStatusNoDialog ao invés de botDesabilitado para evitar race condition */}
              {botStatusNoDialog ? (
                <div className="space-y-4">
                  <p>Deseja reativar o bot automático para este cliente?</p>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">
                      ⚠️ Para confirmar, digite "LIGAR" abaixo:
                    </p>
                    <Input
                      value={confirmacaoTexto}
                      onChange={(e) => setConfirmacaoTexto(e.target.value.toUpperCase())}
                      placeholder="Digite LIGAR"
                      className="font-mono"
                      autoComplete="off"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p>
                    O bot está atualmente <strong>ativo</strong> para este cliente.
                  </p>
                  <p className="text-destructive font-medium">
                    Ao assumir, esta ação irá:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Encerrar imediatamente qualquer fluxo ativo no Twilio Studio</li>
                    <li>Desabilitar o bot para este cliente</li>
                    <li>Permitir atendimento 100% manual</li>
                  </ul>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTogglingBot}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={toggleBot}
              disabled={isTogglingBot || (botStatusNoDialog && confirmacaoTexto !== 'LIGAR')}
              className={botStatusNoDialog ? "" : "bg-destructive hover:bg-destructive/90"}
            >
              {isTogglingBot ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                botStatusNoDialog ? "Reativar Bot" : "Assumir Agora"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Notas Internas */}
      <Dialog open={notasDialogOpen} onOpenChange={setNotasDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Notas Internas
            </DialogTitle>
            <DialogDescription>
              Informações visíveis apenas para os operadores sobre este cliente.
            </DialogDescription>
          </DialogHeader>
          
          <Textarea
            value={notasInternas}
            onChange={(e) => setNotasInternas(e.target.value)}
            placeholder="Ex: Cliente preferencial, solicitar desconto, histórico de problemas, contexto importante..."
            className="min-h-[150px]"
          />
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNotasDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={salvarNotas}>
              Salvar Notas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Messages area - Scrollable with Drag & Drop */}
      <div 
        ref={setMessagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:px-6 md:py-5 space-y-3 bg-muted/10 relative"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onCopy={(e) => {
          const selection = window.getSelection()?.toString();
          if (selection) {
            e.preventDefault();
            // Clean timestamps and normalize spaces
            const cleanedText = selection
              .replace(/\b\d{1,2}:\d{2}\b/g, '')
              .replace(/[\r\n]+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            e.clipboardData?.setData('text/plain', cleanedText);
          }
        }}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="text-center bg-background/90 p-6 rounded-xl shadow-lg">
              <Paperclip className="h-12 w-12 mx-auto text-primary mb-3" />
              <p className="text-lg font-medium text-foreground">Solte o arquivo aqui</p>
              <p className="text-sm text-muted-foreground mt-1">Imagens, vídeos, áudios ou PDFs</p>
            </div>
          </div>
        )}

        {/* ✅ Loading skeleton para mensagens */}
        {isLoadingMessages ? (
          <div className="space-y-4 py-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <div className="space-y-2">
                  <Skeleton className={cn("h-16 rounded-2xl", i % 2 === 0 ? "w-48" : "w-56")} />
                  <Skeleton className="h-3 w-12 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          <>
            {/* ✅ Botão para carregar mensagens anteriores */}
            {hasMoreMessages && (
              <div className="flex justify-center py-2" ref={messagesStartRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMoreMessages}
                  disabled={isLoadingMore}
                  className="text-xs"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    "Carregar mensagens anteriores"
                  )}
                </Button>
              </div>
            )}
            
            {mensagens.map((msg, index) => {
          const previousMsg = index > 0 ? mensagens[index - 1] : undefined;
          const showDateSeparator = shouldShowDateSeparator(msg, previousMsg);
          
          return (
            <div 
              key={msg.id}
              ref={(el) => { messageRefs.current[msg.id] = el; }}
            >
                {showDateSeparator && (
                  <div className="flex justify-center my-3">
                    <div className="bg-muted/60 backdrop-blur-sm text-muted-foreground text-xs px-3 py-1 rounded-full shadow-sm">
                      {getDateLabel(new Date(msg.data_hora))}
                    </div>
                  </div>
                )}
                
                <MessageContextMenu 
                  messageText={msg.texto || ""} 
                  fichaId={fichaId || null}
                  messageData={msg}
                  onReply={() => setReplyingTo(msg)}
                  onEdit={handleStartEdit}
                  onDelete={handleDeleteMessage}
                  canEditDelete={canEditDeleteMessage(msg)}
                >
                  <div
                    className={cn(
                      "flex animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
                      isAtendente(msg.remetente) ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] sm:max-w-[75%] md:max-w-[65%] rounded-2xl px-3 py-2 md:px-3.5 md:py-2.5 shadow-sm transition-all hover:shadow-md cursor-context-menu",
                        isAtendente(msg.remetente)
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border rounded-bl-sm",
                        highlightedMessageId === msg.id && "ring-4 ring-yellow-400 ring-opacity-60 scale-[1.02]",
                        searchResults.includes(msg.id) && chatSearchTerm && "bg-yellow-100 dark:bg-yellow-900/30",
                        msg.texto === "[Mensagem apagada]" && "opacity-60 italic"
                      )}
                    >
                      {msg.reply_to_message_id && msg.reply_to && (
                        <QuotedMessage 
                          quotedMsg={msg.reply_to} 
                          onScrollToMessage={scrollToMessage}
                        />
                      )}
                      {editingMessageId === msg.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="min-h-[60px] text-sm bg-background text-foreground rounded-lg"
                            autoFocus
                          />
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => { setEditingMessageId(null); setEditingText(""); }}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleEditMessage(msg.id, editingText)}
                              disabled={!editingText.trim() || editingText === msg.texto}
                            >
                              Salvar
                            </Button>
                          </div>
                        </div>
                      ) : msg.texto && (
                        <p 
                          className="text-sm break-words leading-relaxed whitespace-pre-wrap select-text"
                          dangerouslySetInnerHTML={
                            chatSearchTerm && searchResults.includes(msg.id)
                              ? { __html: highlightText(msg.texto, chatSearchTerm) }
                              : undefined
                          }
                        >
                          {!chatSearchTerm || !searchResults.includes(msg.id) ? msg.texto : undefined}
                        </p>
                      )}
                      {renderMedia(msg)}
                  <div className="flex items-center gap-1 mt-1 select-none">
                    <MessageStatusIndicator status={msg.status} remetente={msg.remetente} />
                    <p className={cn(
                      "text-xs opacity-70",
                      isAtendente(msg.remetente) 
                        ? "text-primary-foreground" 
                        : "text-muted-foreground"
                    )}>
                      {format(new Date(msg.data_hora), "HH:mm", { locale: ptBR })}
                    </p>
                    {(() => {
                      // Determine sender label
                      if (isAtendente(msg.remetente)) {
                        // Operator messages (with profile name)
                        if (msg.enviado_por?.full_name) {
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-semibold ml-0.5 cursor-default">
                                    {msg.enviado_por.full_name.charAt(0).toUpperCase()}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {msg.enviado_por.full_name}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        }
                        // Operator without profile but has operador_nome
                        if (msg.operador_nome) {
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-semibold ml-0.5 cursor-default">
                                    {msg.operador_nome.charAt(0).toUpperCase()}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {msg.operador_nome}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        }
                        // Bot explicit OR fallback: atendente without any human attribution = bot
                        if (msg.tipo_remetente === 'bot' || msg.remetente === 'bot' || (!msg.enviado_por_id && !msg.operador_nome)) {
                          return (
                            <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full ml-0.5 font-medium">
                              🤖 Bot
                            </span>
                          );
                        }
                        return null;
                      } else {
                        // Client messages
                        return (
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-full ml-0.5 font-medium",
                            "bg-muted text-muted-foreground"
                          )}>
                            Cliente
                          </span>
                        );
                      }
                    })()}
                  </div>
                    </div>
                  </div>
                </MessageContextMenu>
              </div>
            );
          })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply indicator */}
      {replyingTo && (
        <ReplyIndicator
          message={replyingTo}
          onCancel={() => setReplyingTo(null)}
        />
      )}

      {/* Input area - Fixed at bottom */}
      <div className="px-3 py-2.5 md:px-4 md:py-3 border-t bg-background shadow-sm shrink-0 flex-none">
        <div className="max-w-5xl mx-auto">
          {/* Bloqueio de escrita para conversas não atribuídas ou de outros usuários */}
          {!canWrite ? (
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              {needsToAssume ? (
                <>
                  <Lock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Esta conversa não está atribuída a você
                  </p>
                  <Button onClick={assumirParaMim} size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assumir para mim
                  </Button>
                </>
              ) : (
                <>
                  <Lock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Atribuído a {atendenteAtual?.nome}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Você pode ler, mas não pode responder
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Preview de arquivo pendente */}
              {pendingFile && (
                <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-lg mb-2 border">
                  {pendingFile.type === 'imagem' ? (
                    <img 
                      src={pendingFile.previewUrl} 
                      alt="Preview" 
                      className="h-16 w-16 object-cover rounded-md"
                    />
                  ) : pendingFile.type === 'video' ? (
                    <div className="h-16 w-16 bg-muted rounded-md flex items-center justify-center">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                  ) : pendingFile.type === 'audio' ? (
                    <div className="h-16 w-16 bg-muted rounded-md flex items-center justify-center">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="h-16 w-16 bg-muted rounded-md flex items-center justify-center">
                      <FileIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pendingFile.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(pendingFile.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={removePendingFile}
                    className="shrink-0 h-8 w-8"
                    title="Remover arquivo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex gap-1.5 md:gap-2 items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                
                <MensagensPadronizadasDropdown
                  onSelectMensagem={(msg) => setNovaMsg(msg)}
                  clienteNome={clienteNome}
                  clienteTelefone={clienteTelefone}
                  fichaId={fichaId}
                />
                
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={statusConversa === "fechada" || uploading || !!pendingFile}
                  className="shrink-0 h-9 w-9 md:h-10 md:w-10"
                  title="Anexar arquivo"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                <AudioRecorder
                  onRecordingComplete={handleAudioRecording}
                  disabled={statusConversa === "fechada" || uploading || !!pendingFile}
                />
                
                <Textarea
                  ref={textareaRef}
                  placeholder={pendingFile ? "Pressione enviar para enviar o arquivo" : (statusConversa === "aberta" ? "Digite sua mensagem..." : "Conversa fechada")}
                  value={novaMsg}
                  onChange={(e) => setNovaMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviarMensagem();
                    }
                  }}
                  onPaste={handlePaste}
                  disabled={statusConversa === "fechada" || !!pendingFile}
                  className="flex-1 min-h-[36px] md:min-h-[40px] resize-none rounded-2xl text-sm md:text-base py-2 md:py-2.5"
                  rows={1}
                  style={{ height: 'auto', overflowY: 'hidden' }}
                />
                
                <Button 
                  onClick={enviarMensagem} 
                  disabled={statusConversa === "fechada" || (!novaMsg.trim() && !pendingFile) || isSending || uploading}
                  className="shrink-0 shadow-md h-9 w-9 md:h-10 md:w-10"
                  size="icon"
                  title={pendingFile ? "Enviar arquivo" : "Enviar mensagem"}
                >
                  {isSending || uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dialog de Histórico do Bot */}
      <BotHistoricoDialog
        open={botHistoricoOpen}
        onOpenChange={setBotHistoricoOpen}
        telefoneCliente={clienteTelefone}
        nomeCliente={clienteNome}
      />

      {/* Takeover Dialogs */}
      <TakeoverRequestDialog
        open={takeoverRequestOpen}
        solicitanteNome={takeoverRequestSolicitanteNome}
        onApprove={handleTakeoverApprove}
        onDeny={handleTakeoverDeny}
      />

      <TakeoverWaitingDialog
        open={takeoverWaitingOpen}
        operadorNome={takeoverWaitingOperadorNome}
        onTimeout={handleTakeoverTimeout}
        onClose={() => setTakeoverWaitingOpen(false)}
      />
    </div>
  );
};
