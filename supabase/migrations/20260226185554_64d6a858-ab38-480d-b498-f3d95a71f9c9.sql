
-- ============================================================
-- 1. FIX: internal_conversations RLS (self-referencing bug)
-- ============================================================

-- DROP buggy policies
DROP POLICY IF EXISTS "Members can view conversations" ON internal_conversations;
DROP POLICY IF EXISTS "Members can update conversations" ON internal_conversations;

-- Recreate with correct reference
CREATE POLICY "Members can view conversations"
  ON internal_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM internal_conversation_members
      WHERE internal_conversation_members.conversation_id = internal_conversations.id
        AND internal_conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update conversations"
  ON internal_conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM internal_conversation_members
      WHERE internal_conversation_members.conversation_id = internal_conversations.id
        AND internal_conversation_members.user_id = auth.uid()
    )
  );

-- ============================================================
-- 2. FIX: internal_conversation_members RLS (self-referencing bug)
-- ============================================================

DROP POLICY IF EXISTS "Members can view members" ON internal_conversation_members;

CREATE POLICY "Members can view members"
  ON internal_conversation_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM internal_conversation_members icm
      WHERE icm.conversation_id = internal_conversation_members.conversation_id
        AND icm.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Avisos: add arquivado column + UPDATE/DELETE policies
-- ============================================================

ALTER TABLE avisos ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false;

-- Allow admins to update avisos (for archiving)
CREATE POLICY "Admins podem atualizar avisos"
  ON avisos FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete avisos
CREATE POLICY "Admins podem deletar avisos"
  ON avisos FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
