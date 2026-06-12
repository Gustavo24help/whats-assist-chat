
-- Migração B: Lockdown RLS financeiro (idempotente)

ALTER TABLE public.contas_pagar_manual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adiantamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajustes_data_finalizacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_corrente_prestador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.descontos_ajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamento_webhook_log ENABLE ROW LEVEL SECURITY;

-- contas_pagar_manual
DROP POLICY IF EXISTS auth_select   ON public.contas_pagar_manual;
DROP POLICY IF EXISTS auth_insert   ON public.contas_pagar_manual;
DROP POLICY IF EXISTS auth_update   ON public.contas_pagar_manual;
DROP POLICY IF EXISTS roles_delete  ON public.contas_pagar_manual;
CREATE POLICY auth_select  ON public.contas_pagar_manual FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert  ON public.contas_pagar_manual FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update  ON public.contas_pagar_manual FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY roles_delete ON public.contas_pagar_manual FOR DELETE TO authenticated USING (public.is_financeiro_role(auth.uid()));

-- contas_receber
DROP POLICY IF EXISTS auth_select   ON public.contas_receber;
DROP POLICY IF EXISTS auth_insert   ON public.contas_receber;
DROP POLICY IF EXISTS auth_update   ON public.contas_receber;
DROP POLICY IF EXISTS roles_delete  ON public.contas_receber;
CREATE POLICY auth_select  ON public.contas_receber FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert  ON public.contas_receber FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update  ON public.contas_receber FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY roles_delete ON public.contas_receber FOR DELETE TO authenticated USING (public.is_financeiro_role(auth.uid()));

-- adiantamentos
DROP POLICY IF EXISTS auth_select   ON public.adiantamentos;
DROP POLICY IF EXISTS auth_insert   ON public.adiantamentos;
DROP POLICY IF EXISTS auth_update   ON public.adiantamentos;
DROP POLICY IF EXISTS roles_delete  ON public.adiantamentos;
CREATE POLICY auth_select  ON public.adiantamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert  ON public.adiantamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update  ON public.adiantamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY roles_delete ON public.adiantamentos FOR DELETE TO authenticated USING (public.is_financeiro_role(auth.uid()));

-- ajustes_data_finalizacao
DROP POLICY IF EXISTS auth_select   ON public.ajustes_data_finalizacao;
DROP POLICY IF EXISTS auth_insert   ON public.ajustes_data_finalizacao;
DROP POLICY IF EXISTS auth_update   ON public.ajustes_data_finalizacao;
DROP POLICY IF EXISTS roles_delete  ON public.ajustes_data_finalizacao;
CREATE POLICY auth_select  ON public.ajustes_data_finalizacao FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert  ON public.ajustes_data_finalizacao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update  ON public.ajustes_data_finalizacao FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY roles_delete ON public.ajustes_data_finalizacao FOR DELETE TO authenticated USING (public.is_financeiro_role(auth.uid()));

-- transacoes_financeiras
DROP POLICY IF EXISTS auth_select        ON public.transacoes_financeiras;
DROP POLICY IF EXISTS auth_insert        ON public.transacoes_financeiras;
DROP POLICY IF EXISTS auth_update        ON public.transacoes_financeiras;
DROP POLICY IF EXISTS roles_delete       ON public.transacoes_financeiras;
DROP POLICY IF EXISTS anon_select_portal ON public.transacoes_financeiras;
CREATE POLICY auth_select        ON public.transacoes_financeiras FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert        ON public.transacoes_financeiras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update        ON public.transacoes_financeiras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY roles_delete       ON public.transacoes_financeiras FOR DELETE TO authenticated USING (public.is_financeiro_role(auth.uid()));
CREATE POLICY anon_select_portal ON public.transacoes_financeiras FOR SELECT TO anon USING (true);
COMMENT ON POLICY anon_select_portal ON public.transacoes_financeiras IS 'Dívida técnica: leitura anônima exigida pelo Portal do Prestador legado. Remover assim que a Auth do Prestador for implementada.';

-- conta_corrente_prestador
DROP POLICY IF EXISTS auth_select        ON public.conta_corrente_prestador;
DROP POLICY IF EXISTS auth_insert        ON public.conta_corrente_prestador;
DROP POLICY IF EXISTS auth_update        ON public.conta_corrente_prestador;
DROP POLICY IF EXISTS roles_delete       ON public.conta_corrente_prestador;
DROP POLICY IF EXISTS anon_select_portal ON public.conta_corrente_prestador;
CREATE POLICY auth_select        ON public.conta_corrente_prestador FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert        ON public.conta_corrente_prestador FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update        ON public.conta_corrente_prestador FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY roles_delete       ON public.conta_corrente_prestador FOR DELETE TO authenticated USING (public.is_financeiro_role(auth.uid()));
CREATE POLICY anon_select_portal ON public.conta_corrente_prestador FOR SELECT TO anon USING (true);
COMMENT ON POLICY anon_select_portal ON public.conta_corrente_prestador IS 'Dívida técnica: leitura anônima exigida pelo Portal do Prestador legado. Remover assim que a Auth do Prestador for implementada.';

-- descontos_ajustes
DROP POLICY IF EXISTS roles_all ON public.descontos_ajustes;
CREATE POLICY roles_all ON public.descontos_ajustes FOR ALL TO authenticated
  USING (public.is_financeiro_role(auth.uid()))
  WITH CHECK (public.is_financeiro_role(auth.uid()));

-- pagamento_webhook_log
DROP POLICY IF EXISTS roles_select ON public.pagamento_webhook_log;
CREATE POLICY roles_select ON public.pagamento_webhook_log FOR SELECT TO authenticated
  USING (public.is_financeiro_role(auth.uid()));
