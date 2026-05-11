
CREATE TABLE public.pagamento_webhook_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  direcao text NOT NULL CHECK (direcao IN ('recebido','enviado')),
  origem text NOT NULL,
  ficha_id text,
  evento text,
  status text NOT NULL DEFAULT 'success',
  pagamento_link text,
  valor numeric,
  auth_source text,
  payload jsonb,
  resposta jsonb,
  duracao_ms integer,
  erro text
);

CREATE INDEX idx_pag_webhook_log_created_at ON public.pagamento_webhook_log (created_at DESC);
CREATE INDEX idx_pag_webhook_log_ficha ON public.pagamento_webhook_log (ficha_id);
CREATE INDEX idx_pag_webhook_log_origem ON public.pagamento_webhook_log (origem);

ALTER TABLE public.pagamento_webhook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/supervisor podem ver logs de pagamento"
  ON public.pagamento_webhook_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'admin_ti'::app_role));

CREATE POLICY "Service role pode inserir logs de pagamento"
  ON public.pagamento_webhook_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Backfill a partir de automation_audit
INSERT INTO public.pagamento_webhook_log
  (created_at, direcao, origem, ficha_id, evento, status, payload, erro)
SELECT
  created_at,
  'recebido' AS direcao,
  CASE etapa
    WHEN 'webhook_pagamento' THEN 'asaas_webhook'
    WHEN 'reconcile_asaas'   THEN 'reconcile_asaas'
    ELSE etapa
  END AS origem,
  ficha_id,
  CASE
    WHEN detalhe ~ 'Event: [A-Z_]+' THEN substring(detalhe FROM 'Event: ([A-Z_]+)')
    ELSE NULL
  END AS evento,
  CASE
    WHEN status = 'success' THEN 'success'
    WHEN status = 'started' THEN 'success'
    WHEN status = 'error' THEN 'error'
    ELSE status
  END AS status,
  jsonb_build_object('detalhe', detalhe, 'payment_id', payment_id, 'origem_audit', etapa) AS payload,
  CASE WHEN status = 'error' THEN detalhe ELSE NULL END AS erro
FROM public.automation_audit
WHERE etapa IN ('webhook_pagamento', 'reconcile_asaas');
