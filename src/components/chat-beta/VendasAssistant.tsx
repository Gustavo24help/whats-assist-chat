import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, ClipboardPaste, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface VendasAssistantProps {
  clienteTelefone: string;
  clienteNome: string;
}

export function VendasAssistant({ clienteTelefone, clienteNome }: VendasAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const pasteConversation = async () => {
    try {
      const { data: msgs } = await supabase
        .from("mensagens")
        .select("texto, remetente, data_hora")
        .eq("cliente_id", clienteTelefone)
        .order("data_hora", { ascending: true })
        .limit(30);

      if (!msgs?.length) {
        toast.info("Nenhuma mensagem encontrada");
        return;
      }

      const formatted = msgs
        .filter((m) => m.texto)
        .map((m) => {
          const who = m.remetente === "cliente" ? clienteNome : "Operador";
          return `[${who}]: ${m.texto}`;
        })
        .join("\n");

      setInput(
        `Analise esta conversa e me dê orientações de vendas:\n\n${formatted}`
      );
      toast.success("Conversa colada!");
    } catch {
      toast.error("Erro ao buscar conversa");
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("vendas-assistant", {
        body: { messages: newMessages },
      });

      if (error) {
        toast.error("Erro ao consultar assistente");
        console.error(error);
        setLoading(false);
        return;
      }

      const assistantText =
        data?.choices?.[0]?.message?.content || "Sem resposta da IA.";

      setMessages([...newMessages, { role: "assistant", content: assistantText }]);
    } catch (e) {
      console.error(e);
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold">Coach de Vendas</span>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setMessages([])}
            title="Limpar conversa"
          >
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-2">
              <Bot className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-xs text-muted-foreground">
                Cole a conversa ou faça uma pergunta sobre vendas
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={pasteConversation}
              >
                <ClipboardPaste className="h-3 w-3 mr-1" />
                Colar conversa atual
              </Button>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "text-xs rounded-lg px-3 py-2 max-w-[95%]",
                m.role === "user"
                  ? "bg-primary/10 text-foreground ml-auto"
                  : "bg-muted text-foreground"
              )}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-xs prose-slate dark:prose-invert max-w-none [&_p]:text-xs [&_li]:text-xs [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_code]:text-[10px]">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analisando...
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border/60 p-2 space-y-1.5">
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] h-5 px-1.5 text-muted-foreground"
            onClick={pasteConversation}
          >
            <ClipboardPaste className="h-2.5 w-2.5 mr-1" />
            Colar conversa
          </Button>
        )}
        <div className="flex gap-1.5">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Faça uma pergunta sobre vendas..."
            className="text-xs resize-none min-h-[60px] max-h-[120px]"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button
            onClick={sendMessage}
            size="icon"
            className="h-[60px] w-9 shrink-0"
            disabled={loading || !input.trim()}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
