import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Message {
  id: string;
  sender_id: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
  sender_name?: string;
}

interface InternalChatWindowProps {
  conversationId: string | null;
}

export const InternalChatWindow = ({ conversationId }: InternalChatWindowProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [otherName, setOtherName] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
  };

  const loadMessages = async () => {
    if (!conversationId) return;

    const { data } = await (supabase as any)
      .from("internal_messages")
      .select("id, sender_id, content, file_url, file_name, file_type, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!data) return;

    // Enrich with sender names
    const senderIds = [...new Set(data.map((m: any) => m.sender_id))];
    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("id, full_name")
      .in("id", senderIds);

    const nameMap: Record<string, string> = {};
    profiles?.forEach((p: any) => { nameMap[p.id] = p.full_name || "Usuário"; });

    setMessages(data.map((m: any) => ({ ...m, sender_name: nameMap[m.sender_id] || "Usuário" })));
    scrollToBottom();

    // Mark as read
    if (user) {
      await (supabase as any)
        .from("internal_conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
    }
  };

  const loadConversationInfo = async () => {
    if (!conversationId || !user) return;

    const { data: members } = await (supabase as any)
      .from("internal_conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .neq("user_id", user.id);

    if (members && members.length > 0) {
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("full_name")
        .eq("id", members[0].user_id)
        .single();
      setOtherName(profile?.full_name || "Usuário");
    }
  };

  useEffect(() => {
    if (conversationId) {
      loadMessages();
      loadConversationInfo();
    }
  }, [conversationId]);

  // Realtime
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`internal-chat-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "internal_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload: any) => {
        const newMsg = payload.new;
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("full_name")
          .eq("id", newMsg.sender_id)
          .single();

        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, { ...newMsg, sender_name: profile?.full_name || "Usuário" }];
        });
        scrollToBottom();

        // Mark as read
        if (user && newMsg.sender_id !== user.id) {
          await (supabase as any)
            .from("internal_conversation_members")
            .update({ last_read_at: new Date().toISOString() })
            .eq("conversation_id", conversationId)
            .eq("user_id", user.id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user?.id]);

  const handleSend = async () => {
    if (!conversationId || !user || (!newMessage.trim() && !pendingFile)) return;

    setSending(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let fileType: string | null = null;

      if (pendingFile) {
        const ext = pendingFile.name.split(".").pop();
        const path = `internal/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("chat-files")
          .upload(path, pendingFile);

        if (uploadError) {
          toast.error(`Erro no upload: ${uploadError.message}`);
          setSending(false);
          return;
        }

        const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
        fileName = pendingFile.name;
        fileType = pendingFile.type.startsWith("image/") ? "imagem" : "documento";
      }

      await (supabase as any).from("internal_messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: newMessage.trim() || null,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
      });

      // Update conversation timestamp
      await (supabase as any)
        .from("internal_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      setNewMessage("");
      setPendingFile(null);
    } catch (err) {
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

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) setPendingFile(file);
        return;
      }
    }
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquareIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Selecione uma conversa ou inicie uma nova</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-background">
        <h3 className="font-semibold">{otherName}</h3>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[70%] rounded-lg px-3 py-2 ${
                  isMe ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {!isMe && (
                  <p className="text-xs font-medium mb-1 opacity-70">{msg.sender_name}</p>
                )}
                {msg.file_url && msg.file_type === "imagem" && isImage(msg.file_url) && (
                  <img
                    src={msg.file_url}
                    alt={msg.file_name || "imagem"}
                    className="rounded max-w-full max-h-60 mb-1 cursor-pointer"
                    onClick={() => window.open(msg.file_url!, "_blank")}
                  />
                )}
                {msg.file_url && msg.file_type === "documento" && (
                  <a
                    href={msg.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 mb-1 text-sm underline ${
                      isMe ? "text-primary-foreground" : "text-foreground"
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    {msg.file_name || "Documento"}
                  </a>
                )}
                {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {format(new Date(msg.created_at), "HH:mm")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending file */}
      {pendingFile && (
        <div className="px-4 py-2 border-t bg-muted/50 flex items-center gap-2">
          {pendingFile.type.startsWith("image/") ? (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm truncate flex-1">{pendingFile.name}</span>
          <Button variant="ghost" size="sm" onClick={() => setPendingFile(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t bg-background flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setPendingFile(file);
            e.target.value = "";
          }}
        />
        <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="h-5 w-5" />
        </Button>
        <Textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Digite uma mensagem..."
          className="min-h-[40px] max-h-[120px] resize-none"
          rows={1}
        />
        <Button onClick={handleSend} disabled={sending || (!newMessage.trim() && !pendingFile)} size="icon">
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

// Simple placeholder icon
const MessageSquareIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
