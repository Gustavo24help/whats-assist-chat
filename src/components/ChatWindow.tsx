import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Send, FileText, Paperclip, FileIcon, UserCheck, ArrowLeft, Check, Users, UserCheck as UserCheckIcon, ChevronDown, X, MessageSquare, Loader2, Search as SearchIcon, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "./AudioPlayer";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { StatusConexaoTwilio } from "./StatusConexaoTwilio";
import { MensagensPadronizadasDropdown } from "./MensagensPadronizadasDropdown";
import { useConversationTimer } from "@/hooks/useConversationTimer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AbrirConversaDialog } from "./AbrirConversaDialog";
import { MessageContextMenu } from "./MessageContextMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

interface Mensagem {
  id: string;
  texto: string;
  tipo: "texto" | "arquivo" | "imagem" | "video" | "audio";
  arquivo_url: string | null;
  data_hora: string;
  remetente: "cliente" | "atendente" | "bot";
  status: "enviado" | "recebido" | "lido";
  status_atualizado_em?: string;
  reply_to_message_id?: string | null;
  reply_to?: Mensagem | null;
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
    switch (remetente) {
      case "atendente": return "Você";
      case "bot": return "Bot";
      default: return "Cliente";
    }
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
  if (remetente !== 'atendente') return null;
  
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
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMsg, setNovaMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [fichaId, setFichaId] = useState<string | undefined>();
  const [assumirDialogOpen, setAssumirDialogOpen] = useState(false);
  const [botDesabilitado, setBotDesabilitado] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  
  // Estados para atribuição de operador
  const [atendenteAtual, setAtendenteAtual] = useState<{ id: string; nome: string } | null>(null);
  const [todosAtendentes, setTodosAtendentes] = useState<Array<{ id: string; nome: string }>>([]);
  
  // Estados para notas internas
  const [notasDialogOpen, setNotasDialogOpen] = useState(false);
  const [notasInternas, setNotasInternas] = useState("");
  const [hasNotas, setHasNotas] = useState(false);
  
  // Estados para busca no chat
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchTerm, setChatSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { dentroJanela } = useConversationTimer(clienteTelefone);

  // Auto-resize do textarea
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
    console.log('[ChatWindow] Limpando estados para:', clienteTelefone);
    setMensagens([]);
    setNovaMsg("");
    setHighlightedMessageId(null);
    setAtendenteAtual(null);
    setNotasInternas("");
    setHasNotas(false);
    
    console.log('[ChatWindow] Inicializando canais Realtime para:', clienteTelefone);
    fetchMensagens();
    fetchFichaId();
    fetchBotStatus();
    clearUnreadMark();
    fetchAtendente();
    fetchAtendentes();
    fetchNotas();

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
        () => {
          console.log('[ChatWindow] Nova mensagem detectada, recarregando');
          fetchMensagens();
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
          console.log('[ChatWindow] Status de mensagem atualizado:', payload);
          setMensagens(prev => 
            prev.map(msg => 
              msg.id === payload.new.id 
                ? { ...msg, status: (payload.new as any).status, status_atualizado_em: (payload.new as any).status_atualizado_em }
                : msg
            )
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
              return [...prev, payload.payload];
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

    return () => {
      console.log('[ChatWindow] Limpando canais Realtime');
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(botStatusChannel);
    };
  }, [clienteTelefone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

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

  const fetchMensagens = async () => {
    console.log('🔍 Buscando mensagens para:', clienteTelefone);
    
    const { data, error } = await supabase
      .from('mensagens')
      .select('*')
      .eq('cliente_id', clienteTelefone)
      .order('data_hora', { ascending: true });

    if (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      toast.error('Erro ao carregar mensagens');
      return;
    }
    
    if (data) {
      console.log('✅ Mensagens carregadas:', data.length);
      
      // ✅ Buscar TODAS as mensagens de reply de uma vez (batch query)
      const replyIds = data
        .filter(m => m.reply_to_message_id)
        .map(m => m.reply_to_message_id);

      const { data: replyMessages } = await supabase
        .from('mensagens')
        .select('id, texto, tipo, remetente, data_hora, arquivo_url, status')
        .in('id', replyIds);

      // Criar mapa de replies
      const repliesMap = new Map();
      replyMessages?.forEach(r => repliesMap.set(r.id, r));

      // ✅ Combinar SEM QUERIES EXTRAS
      const mensagensComReply = data.map(msg => ({
        ...msg,
        reply_to: msg.reply_to_message_id ? repliesMap.get(msg.reply_to_message_id) : null
      }));
      
      const withReplies = mensagensComReply.filter(m => m.reply_to_message_id);
      console.log('📨 Mensagens com reply:', withReplies.length);
      
      setMensagens(mensagensComReply as any);
    }
  };

  const fetchFichaId = async () => {
    // Primeiro buscar ficha ativa do cliente
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('ficha_ativa_id')
      .eq('telefone', clienteTelefone)
      .maybeSingle();

    if (clienteData?.ficha_ativa_id) {
      setFichaId(clienteData.ficha_ativa_id);
    } else {
      // Fallback: pegar última ficha criada
      const { data } = await supabase
        .from('fichas_de_servico')
        .select('id')
        .eq('telefone_cliente', clienteTelefone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setFichaId(data.id);
      }
    }
  };

  const fetchBotStatus = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('bot_habilitado')
      .eq('telefone', clienteTelefone)
      .maybeSingle();
    
    if (!error && data) {
      setBotDesabilitado(data.bot_habilitado === false);
    }
  };

  const clearUnreadMark = async () => {
    await supabase
      .from('clientes')
      .update({ marcado_nao_lido: false })
      .eq('telefone', clienteTelefone);
  };

  const fetchAtendente = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('atendente_id, atendente:profiles!atendente_id(full_name)')
      .eq('telefone', clienteTelefone)
      .maybeSingle();

    if (data?.atendente_id && (data as any).atendente) {
      setAtendenteAtual({
        id: data.atendente_id,
        nome: (data as any).atendente.full_name
      });
    }
  };

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

  const fetchNotas = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('notas_internas')
      .eq('telefone', clienteTelefone)
      .single();
    
    setNotasInternas(data?.notas_internas || "");
    setHasNotas(!!data?.notas_internas && data.notas_internas.trim().length > 0);
  };

  const atribuirOperador = async (operadorId: string, operadorNome: string) => {
    const { error } = await supabase
      .from('clientes')
      .update({ atendente_id: operadorId })
      .eq('telefone', clienteTelefone);

    if (error) {
      toast.error('Erro ao atribuir operador');
    } else {
      setAtendenteAtual({ id: operadorId, nome: operadorNome });
      toast.success(`Atribuído para ${operadorNome}`);
    }
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

    // Verificar tipo de arquivo
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const isPDF = file.type === 'application/pdf';

    if (!isImage && !isVideo && !isAudio && !isPDF) {
      toast.error("Apenas imagens, vídeos, áudios e PDFs são suportados");
      return;
    }

    setUploading(true);
    try {
      // Upload para Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `chat-media/${clienteTelefone}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, file);

      if (uploadError) {
        console.error("Erro ao fazer upload:", uploadError);
        throw new Error("Erro ao fazer upload do arquivo");
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      const mediaUrl = urlData.publicUrl;
      
      // Determinar tipo de mensagem
      let tipoMensagem: "imagem" | "video" | "audio" | "arquivo" = "imagem";
      if (isVideo) tipoMensagem = "video";
      if (isAudio) tipoMensagem = "audio";
      if (isPDF) tipoMensagem = "arquivo";

      // Enviar via Twilio apenas com o arquivo (sem texto na mensagem)
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: clienteTelefone,
          message: "", // Mensagem vazia - apenas o arquivo será enviado
          mediaUrl: mediaUrl,
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

      toast.success(`${tipoMensagem} enviada via WhatsApp`);
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Erro ao enviar mídia:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mídia");
    } finally {
      setUploading(false);
    }
  };

  const enviarMensagem = async () => {
    if (!novaMsg.trim() || isSending) return;

    if (statusConversa === "fechada") {
      toast.error("Conversa fechada! Use templates aprovados para enviar mensagens.");
      return;
    }

    setIsSending(true);

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

      const mensagemTexto = novaMsg;
      
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
        remetente: "atendente",
        status: "enviado"
      };
      
      setMensagens(prev => [...prev, novaMensagemTemp]);

      console.log('🚀 Invocando send-whatsapp com:', {
        to: clienteTelefone,
        message: mensagemTexto.substring(0, 50)
      });
      
      // Enviar via Twilio
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: clienteTelefone,
          message: mensagemTexto
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
      const mensagemTexto = novaMsg || ""; // novaMsg pode ter sido limpa
      setMensagens(prev => prev.filter(m => !m.id.startsWith('temp-')));
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem");
      if (mensagemTexto) {
        setNovaMsg(mensagemTexto); // Restaurar texto apenas se houver
      }
    } finally {
      setIsSending(false);
    }
  };

  const toggleBot = async () => {
    try {
      // Se o bot está habilitado (não desabilitado), precisamos encerrar o fluxo ativo
      if (!botDesabilitado) {
        console.log(`[ChatWindow] Encerrando fluxo ativo do bot para ${clienteTelefone}`);
        
        const { data, error } = await supabase.functions.invoke('stop-twilio-flow', {
          body: {
            telefone: clienteTelefone
          }
        });

        if (error) throw error;

        if (data?.success) {
          setBotDesabilitado(true);
          toast.success("Bot encerrado e desabilitado com sucesso!");
          console.log(`[ChatWindow] ✅ Fluxo encerrado: ${data.executionSid}`);
        } else {
          // Não havia execução ativa, mas ainda desabilita o bot
          const { error: toggleError } = await supabase.functions.invoke('toggle-bot-status', {
            body: {
              telefone: clienteTelefone,
              bot_status: 'disabled'
            }
          });

          if (toggleError) throw toggleError;
          
          setBotDesabilitado(true);
          toast.info("Bot desabilitado (nenhuma execução ativa encontrada)");
        }
      } else {
        // Reativar bot
        const { error } = await supabase.functions.invoke('toggle-bot-status', {
          body: {
            telefone: clienteTelefone,
            bot_status: 'enabled'
          }
        });

        if (error) throw error;

        setBotDesabilitado(false);
        toast.success("Bot reativado com sucesso!");
      }
      
      setAssumirDialogOpen(false);
    } catch (error) {
      console.error("[ChatWindow] Erro ao alterar status do bot:", error);
      toast.error("Não foi possível alterar o status do bot");
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

  const renderMedia = (msg: Mensagem) => {
    if (!msg.arquivo_url) return null;

    if (msg.tipo === 'imagem') {
      return (
        <img 
          src={msg.arquivo_url} 
          alt="Imagem" 
          className="max-w-[280px] max-h-[280px] rounded-xl mt-2 cursor-pointer hover:opacity-95 transition-all shadow-sm hover:shadow-md object-cover" 
          onClick={() => window.open(msg.arquivo_url || '', '_blank')}
        />
      );
    }
    
    if (msg.tipo === 'video') {
      return (
        <video 
          controls 
          className="max-w-[280px] max-h-[280px] rounded-xl mt-2 shadow-sm"
        >
          <source src={msg.arquivo_url} />
        </video>
      );
    }
    
    if (msg.tipo === 'audio') {
      return (
        <div className="mt-2">
          <AudioPlayer src={msg.arquivo_url} />
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
      <header className="bg-card border-b h-12 flex items-center justify-between gap-2 px-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="lg:hidden shrink-0 h-7 w-7 p-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="font-semibold text-xs truncate">{clienteNome}</h2>
              {fichaId && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-[10px] font-medium">
                  <FileText className="h-2.5 w-2.5" />
                  Ficha
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-muted-foreground truncate">{clienteTelefone}</p>
              <StatusConexaoTwilio telefoneCliente={clienteTelefone} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!fichaOpen && (
            <>
              {/* Botão Assumir */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssumirDialogOpen(true)}
                className={cn(
                  "h-8 px-2 text-xs",
                  botDesabilitado && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                )}
              >
                <UserCheck className="h-3.5 w-3.5 md:mr-1.5" />
                <span className="hidden md:inline">
                  {botDesabilitado ? "Assumido" : "Assumir"}
                </span>
              </Button>

              {/* Botão Abrir */}
              <AbrirConversaDialog
                clienteTelefone={clienteTelefone}
                clienteNome={clienteNome}
              />

              {/* Separador visual */}
              <div className="h-6 w-px bg-border mx-0.5" />

              {/* Botão de atribuição de operador (apenas ícone) */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={atendenteAtual ? `Atribuído: ${atendenteAtual.nome}` : "Atribuir operador"}
                  >
                    {atendenteAtual ? (
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                        {atendenteAtual.nome.charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
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
                        const { data: { user } } = await supabase.auth.getUser();
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

                    <Separator />

                    {/* Lista de operadores */}
                    <div className="max-h-48 overflow-y-auto">
                      <div className="px-2 py-1 text-[11px] text-muted-foreground">
                        Outros operadores:
                      </div>
                      {todosAtendentes.map(a => (
                        <Button
                          key={a.id}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "w-full justify-start text-xs h-8",
                            atendenteAtual?.id === a.id && "bg-accent"
                          )}
                          onClick={() => atribuirOperador(a.id, a.nome)}
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

                    {/* Opção para remover atribuição */}
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
                  </div>
                </PopoverContent>
              </Popover>

              {/* Botão de notas internas (apenas ícone) */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNotasDialogOpen(true)}
                className="h-8 w-8 relative"
                title="Notas Internas"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {hasNotas && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
                )}
              </Button>

              {/* Botão de busca no chat (apenas ícone) */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setChatSearchOpen(!chatSearchOpen)}
                className={cn(
                  "h-8 w-8",
                  chatSearchOpen && "bg-accent"
                )}
                title="Buscar mensagens (Ctrl+F)"
              >
                <SearchIcon className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {/* Botão Ficha */}
          {onToggleFicha && (
            <Button
              onClick={onToggleFicha}
              size="sm"
              className={cn(
                "h-8 px-2 text-xs transition-all duration-200",
                fichaOpen 
                  ? "bg-green-700 hover:bg-green-800 text-white shadow-md" 
                  : "bg-green-600 hover:bg-green-700 text-white shadow-sm"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="ml-1.5 hidden md:inline">Ficha</span>
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

      <AlertDialog open={assumirDialogOpen} onOpenChange={setAssumirDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {botDesabilitado ? "Reativar Bot?" : "Assumir Atendimento"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {botDesabilitado ? (
                "Deseja reativar o bot automático para este cliente?"
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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={toggleBot}
              className={botDesabilitado ? "" : "bg-destructive hover:bg-destructive/90"}
            >
              {botDesabilitado ? "Reativar Bot" : "Assumir Agora"}
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

      {/* Messages area - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:px-6 md:py-5 space-y-3 bg-muted/10">
        {mensagens.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          mensagens.map((msg, index) => {
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
                >
                  <div
                    className={cn(
                      "flex animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
                      msg.remetente === "atendente" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] sm:max-w-[75%] md:max-w-[65%] rounded-2xl px-3 py-2 md:px-3.5 md:py-2.5 shadow-sm transition-all hover:shadow-md cursor-context-menu",
                        msg.remetente === "atendente"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : msg.remetente === "bot"
                          ? "bg-accent/50 text-accent-foreground border border-accent/60 rounded-bl-sm"
                          : "bg-card border rounded-bl-sm",
                        highlightedMessageId === msg.id && "ring-4 ring-yellow-400 ring-opacity-60 scale-[1.02]",
                        searchResults.includes(msg.id) && chatSearchTerm && "bg-yellow-100 dark:bg-yellow-900/30"
                      )}
                    >
                      {msg.reply_to_message_id && msg.reply_to && (
                        <QuotedMessage 
                          quotedMsg={msg.reply_to} 
                          onScrollToMessage={scrollToMessage}
                        />
                      )}
                      {msg.texto && (
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
                      msg.remetente === "atendente" 
                        ? "text-primary-foreground" 
                        : "text-muted-foreground"
                    )}>
                      {format(new Date(msg.data_hora), "HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                    </div>
                  </div>
                </MessageContextMenu>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area - Fixed at bottom */}
      <div className="px-3 py-2.5 md:px-4 md:py-3 border-t bg-background shadow-sm shrink-0 flex-none">
        <div className="flex gap-1.5 md:gap-2 items-center max-w-5xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
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
            disabled={statusConversa === "fechada" || uploading}
            className="shrink-0 h-9 w-9 md:h-10 md:w-10"
            title="Enviar arquivo"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <Textarea
            ref={textareaRef}
            placeholder={statusConversa === "aberta" ? "Digite sua mensagem..." : "Conversa fechada"}
            value={novaMsg}
            onChange={(e) => setNovaMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviarMensagem();
              }
            }}
            disabled={statusConversa === "fechada"}
            className="flex-1 min-h-[36px] md:min-h-[40px] resize-none rounded-2xl text-sm md:text-base py-2 md:py-2.5"
            rows={1}
            style={{ height: 'auto', overflowY: 'hidden' }}
          />
          
          <Button 
            onClick={enviarMensagem} 
            disabled={statusConversa === "fechada" || !novaMsg.trim() || isSending}
            className="shrink-0 shadow-md h-9 w-9 md:h-10 md:w-10"
            size="icon"
            title="Enviar mensagem"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};