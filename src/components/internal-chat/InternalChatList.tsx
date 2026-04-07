import { useEffect, useState, useCallback } from "react";
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

  const loadConversations = useCallback(async () => {
    if (!user) return;

    // Step 1: Get all my memberships
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

    // Step 2: Get all conversations in one query
    const { data: convs } = await (supabase as any)
      .from("internal_conversations")
      .select("id, updated_at, is_group, group_name")
      .in("id", convIds)
      .order("updated_at", { ascending: false });

    if (!convs || convs.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Step 3: Get ALL members for all conversations in one query
    const { data: allMembers } = await (supabase as any)
      .from("internal_conversation_members")
      .select("conversation_id, user_id")
      .in("conversation_id", convIds)
      .neq("user_id", user.id);

    // Step 4: Collect unique user IDs and fetch profiles in batch
    const otherUserIds = [...new Set((allMembers || []).map((m: any) => m.user_id))];
    const profileMap: Record<string, string> = {};
    
    if (otherUserIds.length > 0) {
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, full_name")
        .in("id", otherUserIds);
      
      profiles?.forEach((p: any) => { profileMap[p.id] = p.full_name || "Usuário"; });
    }

    // Step 5: Get last messages for all conversations in one query
    // We fetch the latest messages and deduplicate by conversation_id
    const { data: allMessages } = await (supabase as any)
      .from("internal_messages")
      .select("conversation_id, content, file_name, created_at, sender_id")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false })
      .limit(convIds.length * 2); // enough to get at least 1 per conv

    const lastMsgMap: Record<string, any> = {};
    allMessages?.forEach((msg: any) => {
      if (!lastMsgMap[msg.conversation_id]) {
        lastMsgMap[msg.conversation_id] = msg;
      }
    });

    // Step 6: Get unread counts in batch
    // For each conversation, count messages after last_read_at from other senders
    const unreadCounts: Record<string, number> = {};
    
    // Batch: get all messages from others in all conversations
    const { data: allOtherMsgs } = await (supabase as any)
      .from("internal_messages")
      .select("conversation_id, created_at")
      .in("conversation_id", convIds)
      .neq("sender_id", user.id)
      .order("created_at", { ascending: false });

    convIds.forEach((cid: string) => {
      const lastRead = lastReadMap[cid];
      const msgs = (allOtherMsgs || []).filter((m: any) => m.conversation_id === cid);
      if (lastRead) {
        unreadCounts[cid] = msgs.filter((m: any) => m.created_at > lastRead).length;
      } else {
        unreadCounts[cid] = msgs.length;
      }
    });

    // Step 7: Build member map per conversation
    const membersByConv: Record<string, string[]> = {};
    (allMembers || []).forEach((m: any) => {
      if (!membersByConv[m.conversation_id]) membersByConv[m.conversation_id] = [];
      membersByConv[m.conversation_id].push(m.user_id);
    });

    // Step 8: Assemble enriched conversations
    const enriched: Conversation[] = convs.map((conv: any) => {
      const otherIds = membersByConv[conv.id] || [];
      const otherId = otherIds[0];
      const otherName = conv.is_group
        ? (conv.group_name || "Grupo")
        : (otherId ? profileMap[otherId] || "Usuário" : "Conversa");

      const lastMsg = lastMsgMap[conv.id];
      const lastMessage = lastMsg?.content || (lastMsg?.file_name ? `📎 ${lastMsg.file_name}` : undefined);

      return {
        ...conv,
        other_member_name: otherName,
        other_member_id: otherId,
        last_message: lastMessage,
        unread_count: unreadCounts[conv.id] || 0,
      };
    });

    setConversations(enriched);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Refresh on realtime
  useEffect(() => {
    const channel = supabase
      .channel("internal-messages-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "internal_messages" }, () => {
        loadConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadConversations]);

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
