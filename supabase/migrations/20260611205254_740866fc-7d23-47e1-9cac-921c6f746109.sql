
-- ============================================================
-- Helper: drop ALL existing policies on a table
-- ============================================================
DO $$
DECLARE
  r record;
  tbls text[] := ARRAY[
    'contas_pagar_manual','contas_receber','transacoes_financeiras',
    'conta_corrente_prestador','adiantamentos','ajustes_data_finalizacao',
    'descontos_ajustes','pagamento_webhook_log'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    FOR r IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- REVOKE anon everywhere; GRANT to authenticated + service_role
-- ============================================================
REVOKE ALL ON public.contas_pagar_manual       FROM anon;
REVOKE ALL ON public.contas_receber            FROM anon;
REVOKE ALL ON public.transacoes_financeiras    FROM anon;
REVOKE ALL ON public.conta_corrente_prestador  FROM anon;
REVOKE ALL ON public.adiantamentos             FROM anon;
REVOKE ALL ON public.ajustes_data_finalizacao  FROM anon;
REVOKE ALL ON public.descontos_ajustes         FROM anon;
REVOKE ALL ON public.pagamento_webhook_log     FROM anon;

-- Dívida: Portal do Prestador (anon) ainda precisa LER estas duas
GRANT SELECT ON public.transacoes_financeiras   TO anon;
GRANT SELECT ON public.conta_corrente_prestador TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar_manual       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_receber            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transacoes_financeiras    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conta_corrente_prestador  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adiantamentos             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ajustes_data_finalizacao  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.descontos_ajustes         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamento_webhook_log     TO authenticated;

GRANT ALL ON public.contas_pagar_manual       TO service_role;
GRANT ALL ON public.contas_receber            TO service_role;
GRANT ALL ON public.transacoes_financeiras    TO service_role;
GRANT ALL ON public.conta_corrente_prestador  TO service_role;
GRANT ALL ON public.adiantamentos             TO service_role;
GRANT ALL ON public.ajustes_data_finalizacao  TO service_role;
GRANT ALL ON public.descontos_ajustes         TO service_role;
GRANT ALL ON public.pagamento_webhook_log     TO service_role;

-- Garantir RLS ligado
ALTER TABLE public.contas_pagar_manual       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_receber            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes_financeiras    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_corrente_prestador  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adiantamentos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajustes_data_finalizacao  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.descontos_ajustes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamento_webhook_log     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper SQL function: é um dos 4 papéis financeiros?
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_financeiro_role(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin'::app_role)
      OR public.has_role(_uid, 'chefe'::app_role)
      OR public.has_role(_uid, 'admin_ti'::app_role)
      OR public.has_role(_uid, 'financeiro'::app_role);
$$;

-- ============================================================
-- CATEGORIA 1: 6 tabelas operacionais
-- SELECT/INSERT/UPDATE → authenticated; DELETE → 4 papéis
-- ============================================================

-- contas_pagar_manual
CREATE POLICY "auth_select" ON public.contas_pagar_manual FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.contas_pagar_manual FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.contas_pagar_manual FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "roles_delete" ON public.contas_pagar_manual FOR DELETE TO authenticated USING (public.is_financeiro_role(auth.uid()));

-- contas_receber
CREATE POLICY "auth_select" ON public.contas_receber FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.contas_receber FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.contas_receber FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "roles_delete" ON public.contas_receber FOR DELETE TO authenticated USING (public.is_financeiro_role(auth.uid()));

-- transacoes_financeiras (+ anon SELECT — dívida Portal do Prestador)
CREATE POLICY "anon_select_portal" ON public.transacoes_financeiras FOR SELECT TO anon USING (true);
CREATE POLICY "auth_select" ON public.transacoes_financeiras FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.transacoes_financeiras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.transacoes_financeiras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "roles_delete" ON public.transacoes_financeiras FOR DELETE TO authenticated USING (public.is_financeiro_role(auth.uid()));

-- conta_corrente_prestador (+ anon SELECT — dívida Portal do Prestador)
CREATE POLICY "anon_select_portal" ON public.conta_corrente_prestador FOR SELECT TO anon USING (true);
CREATE POLICY "auth_select" ON public.conta_corrente_prestador FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.conta_corrente_prestador FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.conta_corrente_prestador FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "roles_delete" ON public.conta_corrente_prestador FOR DELETE TO authenticated USING (public.is_financeiro_role(auth.uid()));

-- adiantamentos
CREATE POLICY "auth_select" ON public.adiantamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.adiantamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.adiantamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "roles_delete" ON public.adiantamentos FOR DELETE TO authenticated USING (public.is_financeiro_role(auth.uid()));

-- ajustes_data_finalizacao
CREATE POLICY "auth_select" ON public.ajustes_data_finalizacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.ajustes_data_finalizacao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.ajustes_data_finalizacao FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "roles_delete" ON public.ajustes_data_finalizacao FOR DELETE TO authenticated USING (public.is_financeiro_role(auth.uid()));

-- ============================================================
-- CATEGORIA 2: lock total — descontos_ajustes (4 papéis apenas)
-- ============================================================
CREATE POLICY "roles_all" ON public.descontos_ajustes
  FOR ALL TO authenticated
  USING (public.is_financeiro_role(auth.uid()))
  WITH CHECK (public.is_financeiro_role(auth.uid()));

-- ============================================================
-- CATEGORIA 3: pagamento_webhook_log — só SELECT pelos 4 papéis
-- (INSERT continua via service_role, que ignora RLS)
-- ============================================================
CREATE POLICY "roles_select" ON public.pagamento_webhook_log
  FOR SELECT TO authenticated
  USING (public.is_financeiro_role(auth.uid()));
