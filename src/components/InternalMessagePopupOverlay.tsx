import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PopupData {
  id: string;
  senderName: string;
  content: string;
  conversationId: string;
}

export const InternalMessagePopupOverlay = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [popups, setPopups] = useState<PopupData[]>([]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("internal-msg-popup")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "internal_messages",
      }, async (payload: any) => {
        const msg = payload.new;
        if (msg.sender_id === user.id) return;

        // Check if user is a member of this conversation
        const { data: membership } = await (supabase as any)
          .from("internal_conversation_members")
          .select("id")
          .eq("conversation_id", msg.conversation_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!membership) return;

        // Don't show popup if already on the mensagens page with that conversation open
        // (we can't know selectedConversation from here, but the page itself marks as read)
        if (location.pathname === "/mensagens") return;

        // Get sender name
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("full_name")
          .eq("id", msg.sender_id)
          .single();

        const content = msg.content || (msg.file_name ? `📎 ${msg.file_name}` : "Nova mensagem");

        setPopups(prev => [...prev, {
          id: msg.id,
          senderName: profile?.full_name || "Usuário",
          content: content.length > 80 ? content.substring(0, 80) + "..." : content,
          conversationId: msg.conversation_id,
        }]);

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
          setPopups(prev => prev.filter(p => p.id !== msg.id));
        }, 10000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, location.pathname]);

  const dismiss = (id: string) => {
    setPopups(prev => prev.filter(p => p.id !== id));
  };

  const goToConversation = (popup: PopupData) => {
    dismiss(popup.id);
    // Navigate to mensagens page — the conversation selection will be handled there
    navigate("/mensagens");
  };

  if (popups.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {popups.map(popup => (
        <div
          key={popup.id}
          className="bg-background border border-border rounded-lg shadow-lg p-4 animate-in slide-in-from-right-5 fade-in duration-300"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{popup.senderName}</p>
                <p className="text-xs text-muted-foreground truncate">{popup.content}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => dismiss(popup.id)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" className="mt-2 w-full" onClick={() => goToConversation(popup)}>
            Ir para conversa
          </Button>
        </div>
      ))}
    </div>
  );
};
