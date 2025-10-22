import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, FileText, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { StatusConexaoTwilio } from "./StatusConexaoTwilio";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMensagens();

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
      // Criar FormData para envio
      const formData = new FormData();
      formData.append('file', file);

      // Upload do arquivo (você pode usar um serviço como Cloudinary, AWS S3, etc)
      // Por enquanto, vamos usar uma URL temporária
      const mediaUrl = URL.createObjectURL(file);
      
      // Determinar tipo de mensagem
      let tipoMensagem: "imagem" | "video" | "audio" = "imagem";
      if (isVideo) tipoMensagem = "video";
      if (isAudio) tipoMensagem = "audio";

      // Salvar mensagem localmente primeiro (otimistic update)
      const novaMensagem = {
        cliente_id: clienteTelefone,
        remetente: 'atendente',
        texto: file.name,
        tipo: tipoMensagem,
        arquivo_url: mediaUrl,
        status: 'enviado',
        data_hora: new Date().toISOString(),
      };

      // Enviar via Twilio com mídia
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: clienteTelefone,
          message: `📎 ${file.name}`,
          mediaUrl: mediaUrl, // Em produção, isso deve ser uma URL pública permanente
        },
      });

      if (error) throw error;

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

    try {
      // Enviar via Twilio
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: clienteTelefone,
          message: novaMsg,
        },
      });

      if (error) throw error;

      if (!data.success) {
        if (data.error === 'FORA_JANELA_24H') {
          toast.error("Conversa fora da janela de 24h. Use um template aprovado.");
          return;
        }
        throw new Error(data.error || "Erro ao enviar mensagem");
      }

      setNovaMsg("");
      toast.success("Mensagem enviada via WhatsApp");
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem");
    }
  };

  const renderMedia = (msg: Mensagem) => {
    if (!msg.arquivo_url) return null;

    if (msg.tipo === 'imagem') {
      return (
        <img 
          src={msg.arquivo_url} 
          alt="Imagem" 
          className="max-w-[250px] rounded-lg mt-2 cursor-pointer hover:opacity-90 transition-opacity" 
          onClick={() => window.open(msg.arquivo_url || '', '_blank')}
        />
      );
    }
    
    if (msg.tipo === 'video') {
      return (
        <video 
          controls 
          className="max-w-[250px] rounded-lg mt-2"
        >
          <source src={msg.arquivo_url} />
        </video>
      );
    }
    
    if (msg.tipo === 'audio') {
      return (
        <audio 
          controls 
          className="mt-2 w-full max-w-[250px]"
          style={{ height: '40px' }}
        >
          <source src={msg.arquivo_url} />
        </audio>
      );
    }

    if (msg.tipo === 'arquivo') {
      return (
        <a 
          href={msg.arquivo_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          <Paperclip className="h-4 w-4" />
          <span className="text-xs truncate">{msg.texto || 'Arquivo'}</span>
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

      <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-muted/20">
        {mensagens.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.remetente === "atendente" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[70%] rounded-2xl p-3 shadow-sm",
                msg.remetente === "atendente"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background border"
              )}
            >
              {msg.texto && <p className="text-sm break-words">{msg.texto}</p>}
              {renderMedia(msg)}
              <p className={cn(
                "text-xs mt-1",
                msg.remetente === "atendente" 
                  ? "text-primary-foreground/70" 
                  : "text-muted-foreground"
              )}>
                {format(new Date(msg.data_hora), "HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-background shadow-sm">
        <div className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={statusConversa === "fechada" || uploading}
            className="shrink-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            placeholder={statusConversa === "aberta" ? "Digite sua mensagem..." : "Conversa fechada"}
            value={novaMsg}
            onChange={(e) => setNovaMsg(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && enviarMensagem()}
            disabled={statusConversa === "fechada"}
            className="flex-1 rounded-full"
          />
          <Button 
            onClick={enviarMensagem} 
            disabled={statusConversa === "fechada"}
            className="shrink-0 shadow-md"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};