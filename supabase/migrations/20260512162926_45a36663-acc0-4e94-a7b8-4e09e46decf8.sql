CREATE TABLE public.contas_pagar_manual (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  categoria TEXT,
  beneficiario_nome TEXT NOT NULL,
  beneficiario_tipo TEXT NOT NULL DEFAULT 'externo',
  prestador_id TEXT,
  ficha_id TEXT,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  forma_pagamento TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  comprovante_url TEXT,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contas_pagar_manual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access contas_pagar_manual"
  ON public.contas_pagar_manual FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access contas_pagar_manual"
  ON public.contas_pagar_manual FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE INDEX idx_contas_pagar_manual_status ON public.contas_pagar_manual(status);
CREATE INDEX idx_contas_pagar_manual_vencimento ON public.contas_pagar_manual(data_vencimento);
CREATE INDEX idx_contas_pagar_manual_prestador ON public.contas_pagar_manual(prestador_id);
CREATE INDEX idx_contas_pagar_manual_ficha ON public.contas_pagar_manual(ficha_id);

CREATE TRIGGER update_contas_pagar_manual_updated_at
  BEFORE UPDATE ON public.contas_pagar_manual
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();