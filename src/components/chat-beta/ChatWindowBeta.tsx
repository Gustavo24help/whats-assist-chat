import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClienteSignals } from "@/hooks/useClienteSignals";
import { useOperadorUnread } from "@/hooks/useOperadorUnread";
import { SkillVendasCoach } from "./SkillVendasCoach";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ChatWindowBetaProps {
  clienteTelefone: string;
  clienteNome: string;
  onBack?: () => void;
}

interface MensagemDisplay {
  id: string;
  texto: string | null;
  remetente: string;
  data_hora: string | null;
  tipo: string | null;
  arquivo_url: string | null;
}

export function ChatWindowBeta({ clienteTelefone, clienteNome, onBack }: ChatWindowBetaProps) {
  const { user } = useAuth();
  const [mensagens, setMensagens] = useState<MensagemDisplay[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [coachingVisible, setCoachingVisible] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { coaching } = useClienteSignals(clienteTelefone);
  const { marcarComoLido, naoLidos } = useOperadorUnread(clienteTelefone);

  // Marcar como lido ao abrir
  useEffect(() => {
    marcarComoLido();
  }, [clienteTelefone, marcarComoLido]);

  // Buscar mensagens
  useEffect(() => {
    if (!clienteTelefone) return;

    const fetchMensagens = async () => {
      setLoadingMsgs(true);
      const { data } = await supabase
        .from("mensagens")
        .select("id, texto, remetente, data_hora, tipo, arquivo_url")
        .eq("cliente_id", clienteTelefone)
        .order("data_hora", { ascending: true })
        .limit(200);

      setMensagens(data || []);
      setLoadingMsgs(false);
    };

    fetchMensagens();

    // Realtime para novas mensagens
    const channel = supabase
      .channel(`msgs-beta:${clienteTelefone}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `cliente_id=eq.${clienteTelefone}`,
        },
        (payload) => {
          const newMsg = payload.new as MensagemDisplay;
          setMensagens((prev) => [...prev, newMsg]);
          if (newMsg.remetente === "cliente") {
            marcarComoLido();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clienteTelefone, marcarComoLido]);

  // Scroll para baixo nas novas mensagens
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  // Enviar mensagem
  const enviarMensagem = async () => {
    if (!texto.trim() || !user || enviando) return;

    setEnviando(true);
    const telefoneClean = clienteTelefone.replace("whatsapp:", "");

    try {
      const { error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: telefoneClean,
          body: texto.trim(),
          operador_id: user.id,
          operador_nome: user.user_metadata?.full_name || "Operador",
        },
      });

      if (error) {
        console.error("Erro ao enviar:", error);
        toast.error("Erro ao enviar mensagem");
      } else {
        setTexto("");
      }
    } catch (err) {
      console.error("Erro:", err);
      toast.error("Erro ao enviar mensagem");
    }

    setEnviando(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="h-14 border-b flex items-center gap-3 px-4 shrink-0">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{clienteNome}</p>
          <p className="text-xs text-muted-foreground truncate">
            {clienteTelefone.replace("whatsapp:", "")}
          </p>
        </div>
        {naoLidos !== undefined && naoLidos > 0 && (
          <span className="text-xs text-muted-foreground">
            {naoLidos} não lida{naoLidos > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Coaching card */}
      {coaching && coachingVisible && !loadingMsgs && (
        <SkillVendasCoach
          coaching={coaching}
          onCopiar={(sugestao) => setTexto(sugestao)}
          onDescartar={() => setCoachingVisible(false)}
        />
      )}

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {loadingMsgs ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            Carregando mensagens...
          </div>
        ) : mensagens.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhuma mensagem ainda
          </div>
        ) : (
          mensagens.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.remetente === "operador" || msg.remetente === "bot"
                  ? "justify-end"
                  : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-xl px-3 py-2 text-sm",
                  msg.remetente === "operador" || msg.remetente === "bot"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}
              >
                {msg.texto && <p className="whitespace-pre-wrap break-words">{msg.texto}</p>}
                {msg.arquivo_url && (
                  <a
                    href={msg.arquivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline mt-1 block"
                  >
                    📎 Arquivo
                  </a>
                )}
                {msg.data_hora && (
                  <span className="text-[10px] opacity-60 mt-1 block text-right">
                    {new Date(msg.data_hora).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input funcional */}
      <div className="border-t p-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            rows={1}
            disabled={enviando}
            className="flex-1 px-3 py-2 border rounded-lg text-sm bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button
            onClick={enviarMensagem}
            disabled={!texto.trim() || enviando}
            size="sm"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
