-- Harden security-definer helper used in RLS for internal chat
REVOKE ALL ON FUNCTION public.is_internal_conversation_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_internal_conversation_member(uuid, uuid) TO authenticated;