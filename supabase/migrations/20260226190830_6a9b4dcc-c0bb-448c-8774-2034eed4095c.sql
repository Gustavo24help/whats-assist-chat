
-- Fix infinite recursion in internal_conversation_members SELECT policy
-- The current policy does a subquery on the same table, causing infinite recursion.
-- Solution: use a security definer function to check membership.

CREATE OR REPLACE FUNCTION public.is_internal_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.internal_conversation_members
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  )
$$;

-- Fix internal_conversation_members SELECT policy
DROP POLICY IF EXISTS "Members can view members" ON internal_conversation_members;
CREATE POLICY "Members can view members"
  ON internal_conversation_members FOR SELECT
  USING (is_internal_conversation_member(conversation_id, auth.uid()));

-- Fix internal_conversation_members UPDATE policy  
DROP POLICY IF EXISTS "Users can update own membership" ON internal_conversation_members;
CREATE POLICY "Users can update own membership"
  ON internal_conversation_members FOR UPDATE
  USING (user_id = auth.uid());

-- Fix internal_conversations SELECT policy (also references internal_conversation_members)
DROP POLICY IF EXISTS "Members can view conversations" ON internal_conversations;
CREATE POLICY "Members can view conversations"
  ON internal_conversations FOR SELECT
  USING (is_internal_conversation_member(id, auth.uid()));

-- Fix internal_conversations UPDATE policy
DROP POLICY IF EXISTS "Members can update conversations" ON internal_conversations;
CREATE POLICY "Members can update conversations"
  ON internal_conversations FOR UPDATE
  USING (is_internal_conversation_member(id, auth.uid()));

-- Fix internal_messages SELECT policy (references internal_conversation_members)
DROP POLICY IF EXISTS "Members can view messages" ON internal_messages;
CREATE POLICY "Members can view messages"
  ON internal_messages FOR SELECT
  USING (is_internal_conversation_member(conversation_id, auth.uid()));

-- Fix internal_messages INSERT policy (references internal_conversation_members)
DROP POLICY IF EXISTS "Members can send messages" ON internal_messages;
CREATE POLICY "Members can send messages"
  ON internal_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND is_internal_conversation_member(conversation_id, auth.uid())
  );
