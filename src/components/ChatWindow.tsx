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
  tipo: "texto" | "arquivo";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b flex items-center justify-between bg-card">
        <div>
          <h2 className="font-semibold text-lg">{clienteNome}</h2>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {statusConversa === "aberta" ? "Conversa aberta" : "Conversa fechada - Use templates"}
            </p>
            <StatusConexaoTwilio telefoneCliente={clienteTelefone} />
          </div>
        </div>
        <Button onClick={onOpenFicha} variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Ver Ficha
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                "max-w-[70%] rounded-lg p-3",
                msg.remetente === "atendente"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              <p className="text-sm">{msg.texto}</p>
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

      <div className="p-4 border-t bg-card">
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            placeholder={statusConversa === "aberta" ? "Digite sua mensagem..." : "Conversa fechada"}
            value={novaMsg}
            onChange={(e) => setNovaMsg(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && enviarMensagem()}
            disabled={statusConversa === "fechada"}
          />
          <Button onClick={enviarMensagem} disabled={statusConversa === "fechada"}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};