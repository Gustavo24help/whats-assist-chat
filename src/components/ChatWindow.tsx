import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, FileText, Paperclip, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { StatusConexaoTwilio } from "./StatusConexaoTwilio";
import { MensagensPadronizadasDropdown } from "./MensagensPadronizadasDropdown";
import { useConversationTimer } from "@/hooks/useConversationTimer";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Mensagem {
  id: string;
  texto: string;
  tipo: "texto" | "arquivo" | "imagem" | "video" | "audio";
  arquivo_url: string | null;
  data_hora: string;
  remetente: "cliente" | "atendente";
  status: "enviado" | "recebido" | "lido";
}

interface ChatWindowProps {
  clienteTelefone: string; // Usar telefone como ID
  clienteNome: string;
  statusConversa: "aberta" | "fechada";
  onOpenFicha: () => void;
}

export const ChatWindow = ({ clienteTelefone, clienteNome, statusConversa, onOpenFicha }: ChatWindowProps) => {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMsg, setNovaMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fichaId, setFichaId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { dentroJanela } = useConversationTimer(clienteTelefone);

  useEffect(() => {
    fetchMensagens();
    fetchFichaId();

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
        () => fetchMensagens()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

    if (!isImage && !isVideo && !isAudio) {
      toast.error("Apenas imagens, vídeos e áudios são suportados");
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
      let tipoMensagem: "imagem" | "video" | "audio" = "imagem";
      if (isVideo) tipoMensagem = "video";
      if (isAudio) tipoMensagem = "audio";

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
        <div className="mt-2 w-full max-w-[280px] p-3 rounded-xl bg-muted/30 shadow-sm">
          <audio 
            controls 
            className="w-full"
            style={{ height: '36px' }}
          >
            <source src={msg.arquivo_url} />
          </audio>
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
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b flex items-center justify-between bg-background shadow-sm">
        <div>
          <h2 className="font-semibold text-lg text-foreground">{clienteNome}</h2>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {statusConversa === "aberta" ? "Conversa aberta" : "Conversa fechada - Use templates"}
            </p>
            <StatusConexaoTwilio telefoneCliente={clienteTelefone} />
          </div>
        </div>
        <Button onClick={onOpenFicha} variant="default" size="sm" className="shadow-md">
          <FileText className="mr-2 h-4 w-4" />
          Ver Ficha
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/10">
        {mensagens.map((msg, index) => {
          const previousMsg = index > 0 ? mensagens[index - 1] : undefined;
          const showDateSeparator = shouldShowDateSeparator(msg, previousMsg);
          
          return (
            <div key={msg.id}>
              {showDateSeparator && (
                <div className="flex justify-center my-4">
                  <div className="bg-muted/60 backdrop-blur-sm text-muted-foreground text-xs px-3 py-1.5 rounded-full shadow-sm">
                    {getDateLabel(new Date(msg.data_hora))}
                  </div>
                </div>
              )}
              <div
                className={cn(
                  "flex animate-in fade-in slide-in-from-bottom-2 duration-300",
                  msg.remetente === "atendente" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[70%] rounded-2xl p-3.5 shadow-md",
                    msg.remetente === "atendente"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border rounded-bl-sm"
                  )}
                >
                  {msg.texto && <p className="text-sm break-words leading-relaxed">{msg.texto}</p>}
                  {renderMedia(msg)}
                  <p className={cn(
                    "text-xs mt-1.5 opacity-70",
                    msg.remetente === "atendente" 
                      ? "text-primary-foreground" 
                      : "text-muted-foreground"
                  )}>
                    {format(new Date(msg.data_hora), "HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-background shadow-md">
        <div className="flex gap-2 items-end">
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
            className="shrink-0 mb-1"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
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
            className="flex-1 min-h-[44px] max-h-[120px] resize-none rounded-2xl"
            rows={1}
          />
          <Button 
            onClick={enviarMensagem} 
            disabled={statusConversa === "fechada" || !novaMsg.trim()}
            className="shrink-0 shadow-md mb-1"
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};