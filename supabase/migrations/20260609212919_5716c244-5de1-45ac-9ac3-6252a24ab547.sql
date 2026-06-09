-- Sequence for numero
CREATE SEQUENCE IF NOT EXISTS public.propostas_comerciais_numero_seq START 1;

CREATE TABLE IF NOT EXISTS public.propostas_comerciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id uuid NOT NULL,
  cliente_id uuid NULL,
  numero text NOT NULL UNIQUE,
  versao int NOT NULL DEFAULT 1,
  dados_snapshot jsonb NOT NULL,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  validade_dias int NOT NULL DEFAULT 7,
  pdf_storage_path text NULL,
  aceite_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  aceita_em timestamptz NULL,
  aceita_por_nome text NULL,
  aceita_ip text NULL,
  enviada_whatsapp boolean NOT NULL DEFAULT false,
  enviada_em timestamptz NULL,
  criado_por uuid NULL,
  criado_por_nome text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_propostas_ficha ON public.propostas_comerciais(ficha_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_propostas_token ON public.propostas_comerciais(aceite_token);
CREATE INDEX IF NOT EXISTS idx_propostas_cliente ON public.propostas_comerciais(cliente_id);

GRANT SELECT, INSERT, UPDATE ON public.propostas_comerciais TO authenticated;
GRANT SELECT ON public.propostas_comerciais TO anon;
GRANT ALL ON public.propostas_comerciais TO service_role;
GRANT USAGE ON SEQUENCE public.propostas_comerciais_numero_seq TO authenticated, anon, service_role;

ALTER TABLE public.propostas_comerciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "propostas_select_all" ON public.propostas_comerciais
  FOR SELECT USING (true);

CREATE POLICY "propostas_insert_authenticated" ON public.propostas_comerciais
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "propostas_update_authenticated" ON public.propostas_comerciais
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at_propostas()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_propostas_updated_at ON public.propostas_comerciais;
CREATE TRIGGER trg_propostas_updated_at BEFORE UPDATE ON public.propostas_comerciais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_propostas();