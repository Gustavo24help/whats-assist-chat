import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Info, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { markConversationAutoRead } from "@/lib/chatBetaUnread";
import { MobileActionsSheet } from "./MobileActionsSheet";
import { MobileTemplatesSheet } from "./MobileTemplatesSheet";
import { AudioPlayer } from "@/components/AudioPlayer";

const NUMERO_24HELP = "whatsapp:+554138911555";
const NUMERO_SANDBOX = "whatsapp:+14155238886";

const isAtendente = (rem?: string) =>
  !!rem && (rem === NUMERO_24HELP || rem === NUMERO_SANDBOX || rem === "atendente" || rem === "bot");

interface Mensagem {
  id: string;
  texto: string | null;
  tipo: string;
  arquivo_url: string | null;
  data_hora: string;
  remetente: string;
  status?: string | null;
  message_sid?: string | null;
}

interface MobileChatScreenProps {
  cliente: {
    telefone: string;
    nome: string;
    status_conversa: "aberta" | "fechada";
    ficha_id_real?: string | null;
  };
  onBack: () => void;
}

export function MobileChatScreen({ cliente, onBack }: MobileChatScreenProps) {
  const { user, userProfile } = useAuth();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMsg, setNovaMsg] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);

  // Carregar mensagens
  const fetchMensagens = useCallback(async () => {
    const { data } = await supabase
      .from("mensagens")
      .select("id, texto, tipo, arquivo_url, data_hora, remetente, status, message_sid")
      .eq("cliente_id", cliente.telefone)
      .order("data_hora", { ascending: true })
      .limit(200);
    if (data) setMensagens(data as any);
    setLoading(false);
  }, [cliente.telefone]);

  useEffect(() => {
    fetchMensagens();
  }, [fetchMensagens]);

  // Marcar como lida automaticamente ao abrir
  useEffect(() => {
    if (user?.id) {
      markConversationAutoRead(cliente.telefone, user.id).catch(() => {});
    }
  }, [cliente.telefone, user?.id]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`mobile-chat-${cliente.telefone}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens", filter: `cliente_id=eq.${cliente.telefone}` },
        (payload) => {
          const m = payload.new as Mensagem;
          setMensagens((prev) => {
            if (prev.some((p) => p.id === m.id)) return prev;
            // se há temp com mesmo texto recente, remove
            const filtered = prev.filter(
              (p) => !(p.id.startsWith("temp-") && p.texto === m.texto && Math.abs(new Date(p.data_hora).getTime() - new Date(m.data_hora).getTime()) < 30000),
            );
            return [...filtered, m];
          });
          if (!isAtendente(m.remetente) && user?.id) {
            markConversationAutoRead(cliente.telefone, user.id).catch(() => {});
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [cliente.telefone, user?.id]);

  // Auto-scroll para o final em novas mensagens
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens.length]);

  // visualViewport listener para garantir input acima do teclado iOS
  useEffect(() => {
    const vv = (window as any).visualViewport;
    if (!vv) return;
    const handler = () => {
      const composer = composerRef.current;
      if (!composer) return;
      // ajusta padding-bottom do scroll para não ficar atrás do teclado
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      composer.style.transform = `translateY(-${offset}px)`;
      if (scrollRef.current) {
        scrollRef.current.style.paddingBottom = `${composer.offsetHeight + offset + 8}px`;
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    };
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    handler();
    return () => {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
    };
  }, []);

  const enviar = async () => {
    if (!novaMsg.trim() || isSending) return;
    if (cliente.status_conversa === "fechada") {
      toast.error("Conversa fechada. Use um template aprovado.");
      setTemplatesOpen(true);
      return;
    }
    setIsSending(true);
    const texto = novaMsg;
    setNovaMsg("");
    const tempId = `temp-${Date.now()}`;
    setMensagens((prev) => [
      ...prev,
      {
        id: tempId,
        texto,
        tipo: "texto",
        arquivo_url: null,
        data_hora: new Date().toISOString(),
        remetente: NUMERO_24HELP,
        status: "enviado",
      },
    ]);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: cliente.telefone,
          message: texto,
          userId: user?.id,
          ficha_id: cliente.ficha_id_real || null,
          conversation_id: crypto.randomUUID(),
          operador_nome: userProfile?.fullName || "Operador",
          tipo_remetente: "atendente",
        },
      });
      if (error) throw error;
      if (!data?.success) {
        if (data?.error === "FORA_JANELA_24H") {
          toast.error("Fora da janela 24h. Use um template.");
          setTemplatesOpen(true);
        } else {
          throw new Error(data?.error || "Falha no envio");
        }
        setMensagens((prev) => prev.filter((m) => m.id !== tempId));
        setNovaMsg(texto);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar");
      setMensagens((prev) => prev.filter((m) => m.id !== tempId));
      setNovaMsg(texto);
    } finally {
      setIsSending(false);
    }
  };

  const handleTemplateSelect = (texto: string) => {
    setNovaMsg((prev) => (prev ? `${prev} ${texto}` : texto));
    setTemplatesOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col" style={{ height: "100dvh" }}>
      {/* Header */}
      <header className="shrink-0 bg-brand-coral text-white flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2 h-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-10 w-10 text-white hover:bg-white/20 shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base truncate leading-tight">{cliente.nome || cliente.telefone}</div>
          <div className="text-xs opacity-90 truncate">{cliente.telefone}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setFichaOpen(true)}
          className="h-10 w-10 text-white hover:bg-white/20 shrink-0"
          aria-label="Detalhes"
        >
          <Info className="h-5 w-5" />
        </Button>
      </header>

      {/* Mensagens */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 bg-muted/30"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)" }}
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          mensagens.map((m) => {
            const me = isAtendente(m.remetente);
            return (
              <div key={m.id} className={cn("flex mb-2", me ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm break-words",
                    me ? "bg-brand-coral text-white rounded-br-sm" : "bg-card text-foreground rounded-bl-sm border border-border",
                  )}
                >
                  {m.tipo === "imagem" && m.arquivo_url && (
                    <img src={m.arquivo_url} alt="" className="rounded-md max-w-full mb-1" loading="lazy" />
                  )}
                  {m.tipo === "audio" && m.arquivo_url && (
                    <div className="mb-1">
                      <AudioPlayer src={m.arquivo_url} />
                    </div>
                  )}
                  {m.tipo === "video" && m.arquivo_url && (
                    <video src={m.arquivo_url} controls className="rounded-md max-w-full mb-1" />
                  )}
                  {m.tipo === "arquivo" && m.arquivo_url && (
                    <a href={m.arquivo_url} target="_blank" rel="noreferrer" className="underline block mb-1">
                      📎 Abrir arquivo
                    </a>
                  )}
                  {m.texto && <div className="whitespace-pre-wrap">{m.texto}</div>}
                  <div className={cn("text-[10px] mt-1 opacity-70", me ? "text-white/80" : "text-muted-foreground")}>
                    {format(new Date(m.data_hora), "HH:mm")}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div
        ref={composerRef}
        className="shrink-0 bg-card border-t border-border px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] transition-transform"
      >
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setTemplatesOpen(true)}
            className="h-10 w-10 shrink-0"
            aria-label="Templates"
          >
            <FileText className="h-5 w-5" />
          </Button>
          <Textarea
            value={novaMsg}
            onChange={(e) => setNovaMsg(e.target.value)}
            placeholder="Mensagem"
            rows={1}
            className="flex-1 resize-none min-h-[40px] max-h-32 text-base py-2"
            onKeyDown={(e) => {
              // No mobile, Enter sempre quebra linha — envio é via botão.
            }}
          />
          <Button
            type="button"
            onClick={enviar}
            disabled={!novaMsg.trim() || isSending}
            className="h-10 w-10 p-0 shrink-0 bg-brand-coral hover:bg-brand-coral/90 text-white"
            aria-label="Enviar"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <MobileFichaSheet open={fichaOpen} onOpenChange={setFichaOpen} cliente={cliente} />
      <MobileTemplatesSheet
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelect={handleTemplateSelect}
        cliente={cliente}
      />
    </div>
  );
}
