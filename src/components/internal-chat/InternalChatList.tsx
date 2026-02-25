import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conversation {
  id: string;
  updated_at: string;
  is_group: boolean;
  group_name: string | null;
  other_member_name?: string;
  other_member_id?: string;
  last_message?: string;
  unread_count: number;
}

interface InternalChatListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

export const InternalChatList = ({ selectedId, onSelect, onNewChat }: InternalChatListProps) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = async () => {
    if (!user) return;

    const { data: memberships } = await (supabase as any)
      .from("internal_conversation_members")
      .select("conversation_id, last_read_at")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convIds = memberships.map((m: any) => m.conversation_id);
    const lastReadMap: Record<string, string | null> = {};
    memberships.forEach((m: any) => {
      lastReadMap[m.conversation_id] = m.last_read_at;
    });

    const { data: convs } = await (supabase as any)
      .from("internal_conversations")
      .select("id, updated_at, is_group, group_name")
      .in("id", convIds)
      .order("updated_at", { ascending: false });

    if (!convs) {
      setLoading(false);
      return;
    }

    const enriched: Conversation[] = [];

    for (const conv of convs) {
      // Get other members
      const { data: members } = await (supabase as any)
        .from("internal_conversation_members")
        .select("user_id")
        .eq("conversation_id", conv.id)
        .neq("user_id", user.id);

      let otherName = "Conversa";
      let otherId: string | undefined;
      if (members && members.length > 0) {
        otherId = members[0].user_id;
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("full_name")
          .eq("id", members[0].user_id)
          .single();
        otherName = profile?.full_name || "Usuário";
      }

      // Get last message
      const { data: lastMsgs } = await (supabase as any)
        .from("internal_messages")
        .select("content, file_name, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const lastMsg = lastMsgs?.[0];
      const lastMessage = lastMsg?.content || (lastMsg?.file_name ? `📎 ${lastMsg.file_name}` : undefined);

      // Count unread
      const lastRead = lastReadMap[conv.id];
      let unreadCount = 0;
      if (lastRead) {
        const { count } = await (supabase as any)
          .from("internal_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .neq("sender_id", user.id)
          .gt("created_at", lastRead);
        unreadCount = count || 0;
      } else {
        const { count } = await (supabase as any)
          .from("internal_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .neq("sender_id", user.id);
        unreadCount = count || 0;
      }

      enriched.push({
        ...conv,
        other_member_name: conv.is_group ? (conv.group_name || "Grupo") : otherName,
        other_member_id: otherId,
        last_message: lastMessage,
        unread_count: unreadCount,
      });
    }

    setConversations(enriched);
    setLoading(false);
  };

  useEffect(() => {
    loadConversations();
  }, [user?.id]);

  // Refresh on realtime
  useEffect(() => {
    const channel = supabase
      .channel("internal-messages-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "internal_messages" }, () => {
        loadConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return (
    <div className="flex flex-col h-full border-r bg-background">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-lg">Mensagens</h2>
        <Button size="sm" onClick={onNewChat}>
          <Plus className="h-4 w-4 mr-1" />
          Nova
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma conversa ainda</p>
            <p className="text-xs mt-1">Clique em "Nova" para iniciar</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left p-4 border-b transition-colors hover:bg-muted/50 ${
                selectedId === conv.id ? "bg-muted" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm truncate">{conv.other_member_name}</span>
                <div className="flex items-center gap-2">
                  {conv.unread_count > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {conv.unread_count}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              </div>
              {conv.last_message && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{conv.last_message}</p>
              )}
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
};
