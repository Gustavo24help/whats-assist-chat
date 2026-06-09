
-- 1) Enable RLS on bot_config and bot_snooze_rules (auth read, service_role only writes)
ALTER TABLE public.bot_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_config_auth_read" ON public.bot_config FOR SELECT TO authenticated USING (true);

ALTER TABLE public.bot_snooze_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_snooze_rules_auth_read" ON public.bot_snooze_rules FOR SELECT TO authenticated USING (true);

-- 2) Remove anon write/delete access from public.configuracoes
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='configuracoes'
      AND 'anon' = ANY(roles)
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.configuracoes', r.policyname);
  END LOOP;
END $$;

-- 3) Remove the broad anon ALL policy from contas_pagar_manual
DROP POLICY IF EXISTS "Anon full access contas_pagar_manual" ON public.contas_pagar_manual;

-- 4) Restrict propostas_comerciais SELECT to authenticated only.
--    Public proposal viewing/acceptance goes through the `aceitar-proposta` edge function
--    (service_role), so anon does not need direct SELECT access.
DROP POLICY IF EXISTS "propostas_select_all" ON public.propostas_comerciais;
CREATE POLICY "propostas_select_authenticated" ON public.propostas_comerciais
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.propostas_comerciais FROM anon;
