import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, ArrowLeft, Loader2, FileText, Search } from "lucide-react";
import { MessageContextMenu } from "@/components/MessageContextMenu";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "@/components/AudioPlayer";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FichaVinculoSelector } from "./FichaVinculoSelector";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const NUMERO_PRESTADORES = import.meta.env.VITE_TWILIO_PHONE_NUMBER_2 || "";

interface Mensagem {
  id: string;
  texto: string | null;
  tipo: "texto" | "arquivo" | "imagem" | "video" | "audio";
  arquivo_url: string | null;
  data_hora: string | null;
  remetente: string;
  status: "enviado" | "recebido" | "lido";
  message_sid?: string | null;
  ficha_id?: string | null;
  enviado_por_id?: string | null;
  transcricao_texto?: string | null;
}

interface FichaAtiva {
  id: string;
  descricao: string | null;
  nome_ficha: string | null;
  status: string | null;
}

interface ChatWindowPrestadoresProps {
  prestadorTelefone: string;
  prestadorNome: string;
  prestadorCpf?: string | null;
  onBack: () => void;
}

const isAtendente = (remetente: string): boolean => {
  const systemPrefixes = ["whatsapp:+554138911555", "whatsapp:+14155238886", "whatsapp:+554138910814"];
  return systemPrefixes.some((prefix) => remetente.startsWith(prefix)) || remetente === "atendente" || remetente === "bot";
};

export const ChatWindowPrestadores = ({
  prestadorTelefone,
  prestadorNome,
  prestadorCpf,
  onBack,
}: ChatWindowPrestadoresProps) => {
  const { user, isSupervisor } = useAuth();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fichasAtivas, setFichasAtivas] = useState<FichaAtiva[]>([]);
  const [fichaSelecionadaId, setFichaSelecionadaId] = useState<string>("none");
  const [fichaSearch, setFichaSearch] = useState("");
  const [fichaPopoverOpen, setFichaPopoverOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch active fichas for this prestador
  useEffect(() => {
    if (!prestadorCpf) return;
    const fetchFichas = async () => {
      const { data } = await supabase
        .from("fichas_de_servico")
        .select("id, descricao, nome_ficha, status")
        .eq("prestador_id", prestadorCpf)
        .not("status", "in", '("Finalizado","Perdido")')
        .order("created_at", { ascending: false });

      const fichas = (data as FichaAtiva[]) || [];
      setFichasAtivas(fichas);
      // Auto-select if only 1
      if (fichas.length === 1) {
        setFichaSelecionadaId(fichas[0].id);
      }
    };
    fetchFichas();
  }, [prestadorCpf]);

  const fichaSelecionada = fichasAtivas.find((f) => f.id === fichaSelecionadaId) || null;

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("mensagens_prestadores")
      .select("*")
      .eq("prestador_telefone", prestadorTelefone)
      .order("data_hora", { ascending: true });

    if (error) {
      console.error("Erro ao buscar mensagens:", error);
      return;
    }

    setMensagens((data as Mensagem[]) || []);
    setLoading(false);
    setTimeout(scrollToBottom, 100);
  }, [prestadorTelefone, scrollToBottom]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`prestador_msgs_${prestadorTelefone}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens_prestadores",
          filter: `prestador_telefone=eq.${prestadorTelefone}`,
        },
        (payload) => {
          setMensagens((prev) => [...prev, payload.new as Mensagem]);
          setTimeout(scrollToBottom, 100);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mensagens_prestadores",
          filter: `prestador_telefone=eq.${prestadorTelefone}`,
        },
        (payload) => {
          setMensagens((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.id
                ? { ...msg, ...(payload.new as Partial<Mensagem>) }
                : msg
            )
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [prestadorTelefone, scrollToBottom]);

  // Mark as read when opening
  useEffect(() => {
    supabase
      .from("prestadores_chat")
      .update({ marcado_nao_lido: false })
      .eq("telefone", prestadorTelefone)
      .then();
  }, [prestadorTelefone]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      // Build message with ficha prefix
      let textoFinal = newMessage.trim();
      if (fichaSelecionada) {
        const descResumo = fichaSelecionada.descricao || fichaSelecionada.nome_ficha || "Serviço";
        const prefixo = `📋 *Ref: ${fichaSelecionada.id} - ${descResumo}*\n---\n`;
        textoFinal = prefixo + textoFinal;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            to: prestadorTelefone,
            message: textoFinal,
            fromNumber: "TWILIO_PHONE_NUMBER_2",
            ...(fichaSelecionada ? { fichaId: fichaSelecionada.id } : {}),
          }),
        }
      );

      const result = await response.json();

      if (result.error === "FORA_JANELA_24H") {
        toast.error("Fora da janela de 24h. Use um template aprovado.");
        return;
      }

      if (!result.success) {
        toast.error(result.message || "Erro ao enviar mensagem");
        return;
      }

      setNewMessage("");
      textareaRef.current?.focus();
    } catch (error) {
      console.error("Erro ao enviar:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const filePath = `prestadores/${prestadorTelefone}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("chat-files")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Erro ao enviar arquivo");
      return;
    }

    const { data: urlData } = supabase.storage
      .from("chat-files")
      .getPublicUrl(filePath);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: prestadorTelefone,
          message: "",
          mediaUrl: urlData.publicUrl,
          fromNumber: "TWILIO_PHONE_NUMBER_2",
          ...(fichaSelecionada ? { fichaId: fichaSelecionada.id } : {}),
        }),
      }
    );
  };

  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    try {
      const { error } = await supabase
        .from('mensagens_prestadores')
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
        .from('mensagens_prestadores')
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
    return (msg.enviado_por_id === user?.id) || isSupervisor;
  };

  const renderMessage = (msg: Mensagem, index: number) => {
    const isSystem = isAtendente(msg.remetente);
    const showDateSeparator =
      index === 0 ||
      !isSameDay(new Date(msg.data_hora || ""), new Date(mensagens[index - 1]?.data_hora || ""));
    const isDeleted = msg.texto === "[Mensagem apagada]";

    return (
      <React.Fragment key={msg.id}>
        {showDateSeparator && msg.data_hora && (
          <div className="flex justify-center my-3">
            <span className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
              {formatDateSeparator(msg.data_hora)}
            </span>
          </div>
        )}
        <MessageContextMenu
          messageText={msg.texto || ""}
          fichaId={null}
          messageData={msg}
          onEdit={handleStartEdit}
          onDelete={handleDeleteMessage}
          canEditDelete={canEditDeleteMessage(msg)}
        >
          <div className={cn("flex mb-2", isSystem ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-4 py-2 text-sm cursor-context-menu",
                isSystem
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md",
                isDeleted && "opacity-60 italic"
              )}
            >
              {msg.tipo === "imagem" && msg.arquivo_url && (
                <img src={msg.arquivo_url} alt="Imagem" className="max-w-full rounded-lg mb-1" />
              )}
              {msg.tipo === "audio" && msg.arquivo_url && (
                <div>
                  <AudioPlayer src={msg.arquivo_url} />
                  {msg.transcricao_texto && (
                    <div className="mt-1.5 px-2 py-1 bg-muted/40 rounded-lg text-xs text-muted-foreground italic border-l-2 border-primary/30">
                      📝 {msg.transcricao_texto}
                    </div>
                  )}
                </div>
              )}
              {msg.tipo === "video" && msg.arquivo_url && (
                <video src={msg.arquivo_url} controls className="max-w-full rounded-lg mb-1" />
              )}
              {msg.tipo === "arquivo" && msg.arquivo_url && (
                <a href={msg.arquivo_url} target="_blank" rel="noopener noreferrer" className="underline">
                  📎 Arquivo
                </a>
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
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingMessageId(null); setEditingText(""); }}>
                      Cancelar
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleEditMessage(msg.id, editingText)} disabled={!editingText.trim() || editingText === msg.texto}>
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                msg.texto && <p className="whitespace-pre-wrap break-words">{msg.texto}</p>
              )}
              {msg.data_hora && (
                <p className={cn("text-[10px] mt-1", isSystem ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {format(new Date(msg.data_hora), "HH:mm")}
                </p>
              )}
            </div>
          </div>
        </MessageContextMenu>
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background p-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{prestadorNome}</h3>
          <p className="text-xs text-muted-foreground truncate">
            {prestadorTelefone.replace("whatsapp:", "")}
            {prestadorCpf && ` · CPF: ${prestadorCpf}`}
          </p>
        </div>
        {/* Painel lateral mostra info detalhada em desktop; em mobile/tablet mantém botão de vínculo aqui */}
        <div className="lg:hidden">
          <FichaVinculoSelector prestadorTelefone={prestadorTelefone} />
        </div>
      </div>

      {/* Ficha selector with search */}
      {fichasAtivas.length > 0 && (
        <div className="border-b bg-muted/30 px-3 py-2 shrink-0 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <Popover open={fichaPopoverOpen} onOpenChange={setFichaPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-8 text-xs flex-1 justify-start font-normal">
                {fichaSelecionada
                  ? `${fichaSelecionada.id} - ${(fichaSelecionada.descricao || fichaSelecionada.nome_ficha || "Sem descrição").slice(0, 40)}`
                  : "Selecione uma ficha..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" align="start">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar ficha por ID ou descrição..."
                  value={fichaSearch}
                  onChange={(e) => setFichaSearch(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                <button
                  onClick={() => { setFichaSelecionadaId("none"); setFichaPopoverOpen(false); setFichaSearch(""); }}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors",
                    fichaSelecionadaId === "none" && "bg-accent font-medium"
                  )}
                >
                  Nenhuma ficha (sem prefixo)
                </button>
                {fichasAtivas
                  .filter((f) => {
                    if (!fichaSearch.trim()) return true;
                    const term = fichaSearch.toLowerCase();
                    return (
                      f.id.toLowerCase().includes(term) ||
                      (f.descricao || "").toLowerCase().includes(term) ||
                      (f.nome_ficha || "").toLowerCase().includes(term)
                    );
                  })
                  .map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { setFichaSelecionadaId(f.id); setFichaPopoverOpen(false); setFichaSearch(""); }}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors",
                        fichaSelecionadaId === f.id && "bg-accent font-medium"
                      )}
                    >
                      <span className="font-mono">{f.id}</span>
                      <span className="text-muted-foreground"> — {(f.descricao || f.nome_ficha || "Sem descrição").slice(0, 45)}</span>
                    </button>
                  ))}
              </div>
            </PopoverContent>
          </Popover>
          {fichaSelecionada && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              ✅ Prefixo ativo
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 min-w-0 [&>[data-radix-scroll-area-viewport]>div]:!block">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Nenhuma mensagem ainda
          </div>
        ) : (
          mensagens.map((msg, i) => renderMessage(msg, i))
        )}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Input */}
      <div className="border-t bg-background p-3 shrink-0">
        <div className="flex items-end gap-2">
          <label className="cursor-pointer">
            <input type="file" className="hidden" onChange={handleFileUpload} />
            <Paperclip className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          </label>
          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            className="min-h-[40px] max-h-[120px] resize-none flex-1"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
