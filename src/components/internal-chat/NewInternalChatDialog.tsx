import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface UserOption {
  id: string;
  full_name: string;
}

interface NewInternalChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export const NewInternalChatDialog = ({ open, onOpenChange, onCreated }: NewInternalChatDialogProps) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || !user) return;

    const load = async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, full_name")
        .neq("id", user.id)
        .order("full_name");

      setUsers(data?.filter((u: any) => u.full_name) || []);
    };
    load();
  }, [open, user?.id]);

  const filtered = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (targetUserId: string) => {
    if (!user) return;
    setCreating(true);

    try {
      // Check if conversation already exists between these two users
      const { data: myMemberships } = await (supabase as any)
        .from("internal_conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (myMemberships) {
        for (const m of myMemberships) {
          const { data: otherMember } = await (supabase as any)
            .from("internal_conversation_members")
            .select("id")
            .eq("conversation_id", m.conversation_id)
            .eq("user_id", targetUserId)
            .maybeSingle();

          if (otherMember) {
            // Conversation already exists
            onCreated(m.conversation_id);
            onOpenChange(false);
            setCreating(false);
            return;
          }
        }
      }

      // Create new conversation
      const { data: conv, error: convError } = await (supabase as any)
        .from("internal_conversations")
        .insert({ is_group: false })
        .select("id")
        .single();

      if (convError) throw convError;

      // Add both members
      const { error: membersError } = await (supabase as any)
        .from("internal_conversation_members")
        .insert([
          { conversation_id: conv.id, user_id: user.id },
          { conversation_id: conv.id, user_id: targetUserId },
        ]);

      if (membersError) throw membersError;

      onCreated(conv.id);
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao criar conversa");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
          <DialogDescription>Selecione um usuário para conversar</DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ScrollArea className="max-h-[300px]">
          <div className="space-y-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
            ) : (
              filtered.map((u) => (
                <Button
                  key={u.id}
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={creating}
                  onClick={() => handleSelect(u.id)}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium mr-3">
                    {u.full_name.charAt(0).toUpperCase()}
                  </div>
                  {u.full_name}
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
