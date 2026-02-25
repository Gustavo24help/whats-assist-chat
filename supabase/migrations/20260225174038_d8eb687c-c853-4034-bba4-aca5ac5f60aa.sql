
-- Internal conversations table
CREATE TABLE public.internal_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_group boolean NOT NULL DEFAULT false,
  group_name text
);

ALTER TABLE public.internal_conversations ENABLE ROW LEVEL SECURITY;

-- Internal conversation members
CREATE TABLE public.internal_conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.internal_conversation_members ENABLE ROW LEVEL SECURITY;

-- Internal messages
CREATE TABLE public.internal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text,
  file_url text,
  file_name text,
  file_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Members can see their conversations
CREATE POLICY "Members can view conversations"
ON public.internal_conversations FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.internal_conversation_members
  WHERE conversation_id = id AND user_id = auth.uid()
));

-- RLS: Authenticated users can create conversations
CREATE POLICY "Authenticated users can create conversations"
ON public.internal_conversations FOR INSERT TO authenticated
WITH CHECK (true);

-- RLS: Members can update conversations
CREATE POLICY "Members can update conversations"
ON public.internal_conversations FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.internal_conversation_members
  WHERE conversation_id = id AND user_id = auth.uid()
));

-- RLS: Members can see membership
CREATE POLICY "Members can view members"
ON public.internal_conversation_members FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.internal_conversation_members icm
  WHERE icm.conversation_id = conversation_id AND icm.user_id = auth.uid()
));

-- RLS: Authenticated users can add members
CREATE POLICY "Authenticated users can add members"
ON public.internal_conversation_members FOR INSERT TO authenticated
WITH CHECK (true);

-- RLS: Users can update their own membership (for last_read_at)
CREATE POLICY "Users can update own membership"
ON public.internal_conversation_members FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- RLS: Messages visible to conversation members
CREATE POLICY "Members can view messages"
ON public.internal_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.internal_conversation_members
  WHERE conversation_id = internal_messages.conversation_id AND user_id = auth.uid()
));

-- RLS: Members can send messages
CREATE POLICY "Members can send messages"
ON public.internal_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.internal_conversation_members
    WHERE conversation_id = internal_messages.conversation_id AND user_id = auth.uid()
  )
);

-- Trigger for updated_at on conversations
CREATE TRIGGER update_internal_conversations_updated_at
BEFORE UPDATE ON public.internal_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for internal_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;
