-- Tabela de auditoria para reconciliação de mensagens entre Twilio e Lovable.
-- Apenas leitura/inserção, NÃO modifica mensagens existentes.
CREATE TABLE IF NOT EXISTS public.twilio_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_by TEXT,
  scope TEXT NOT NULL DEFAULT 'all', -- 'all' | 'cliente' | 'prestador'
  customer_phone TEXT,
  managed_numbers TEXT[],
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_twilio INTEGER NOT NULL DEFAULT 0,
  total_lovable INTEGER NOT NULL DEFAULT 0,
  total_missing INTEGER NOT NULL DEFAULT 0,
  total_extra INTEGER NOT NULL DEFAULT 0,
  total_recovered INTEGER NOT NULL DEFAULT 0,
  total_recovery_errors INTEGER NOT NULL DEFAULT 0,
  loss_rate_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  missing_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  recovery_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  errors_details JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_twilio_recon_created_at
  ON public.twilio_reconciliation_runs(created_at DESC);

ALTER TABLE public.twilio_reconciliation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access twilio_reconciliation_runs"
  ON public.twilio_reconciliation_runs;
CREATE POLICY "Service role full access twilio_reconciliation_runs"
  ON public.twilio_reconciliation_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins podem ver twilio_reconciliation_runs"
  ON public.twilio_reconciliation_runs;
CREATE POLICY "Admins podem ver twilio_reconciliation_runs"
  ON public.twilio_reconciliation_runs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'admin_ti'::app_role));