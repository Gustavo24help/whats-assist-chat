import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, FileText, Paperclip, FileIcon, UserCheck, ArrowLeft, Check } from "lucide-react";
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
}

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
  const [fichaId, setFichaId] = useState<string | undefined>();
  const [assumirDialogOpen, setAssumirDialogOpen] = useState(false);
  const [botDesabilitado, setBotDesabilitado] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    console.log('[ChatWindow] Inicializando canais Realtime para:', clienteTelefone);
    fetchMensagens();
    fetchFichaId();
    fetchBotStatus();

    const channel = supabase
      .channel(`mensagens-${clienteTelefone}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'mensagens',
          filter: `cliente_id=eq.${clienteTelefone}`
        },
        () => {
          console.log('[ChatWindow] Mudança detectada no banco, recarregando mensagens');
          fetchMensagens();
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

  const fetchMensagens = async () => {
    const { data, error } = await supabase
      .from('mensagens')
      .select('*')
      .eq('cliente_id', clienteTelefone)
      .order('data_hora', { ascending: true });

    if (!error && data) {
      setMensagens(data as Mensagem[]);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
    if (!novaMsg.trim()) return;

    if (statusConversa === "fechada") {
      toast.error("Conversa fechada! Use templates aprovados para enviar mensagens.");
      return;
    }

    const mensagemTexto = novaMsg;
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

    try {
      // Enviar via Twilio
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: clienteTelefone,
          message: mensagemTexto,
        },
      });

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
      setMensagens(prev => prev.filter(m => m.id !== tempId));
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem");
      setNovaMsg(mensagemTexto); // Restaurar texto
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
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground truncate">{clienteTelefone}</p>
            <span className="text-xs font-medium">
              Bot: <span className={botDesabilitado ? "text-red-500" : "text-green-600"}>
                {botDesabilitado ? "Desativado" : "Ativado"}
              </span>
            </span>
          </div>
        </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!fichaOpen && (
            <>
              <AbrirConversaDialog
                clienteTelefone={clienteTelefone}
                clienteNome={clienteNome}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssumirDialogOpen(true)}
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
            <div key={msg.id}>
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
                          : "bg-card border rounded-bl-sm"
                      )}
                    >
                      {msg.texto && (
                        <p className="text-sm break-words leading-relaxed whitespace-pre-wrap select-text">
                          {msg.texto}
                        </p>
                      )}
                      {renderMedia(msg)}
                      <p className={cn(
                        "text-xs mt-1 opacity-70 select-none",
                        msg.remetente === "atendente" 
                          ? "text-primary-foreground" 
                          : "text-muted-foreground"
                      )}>
                        {format(new Date(msg.data_hora), "HH:mm", { locale: ptBR })}
                      </p>
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
            disabled={statusConversa === "fechada" || !novaMsg.trim()}
            className="shrink-0 shadow-md h-9 w-9 md:h-10 md:w-10"
            size="icon"
            title="Enviar mensagem"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};