
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE IF NOT EXISTS public.convites_prestador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id text NOT NULL REFERENCES public.fichas_de_servico(id) ON DELETE CASCADE,
  prestador_cpf text NOT NULL,
  prestador_nome text,
  prestador_telefone text,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aceito','recusado','expirado','cancelado')),
  resumo_texto text,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  respondido_em timestamptz,
  lembrete_enviado boolean NOT NULL DEFAULT false,
  message_sid text,
  enviado_por_id uuid,
  enviado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convites_ficha ON public.convites_prestador(ficha_id);
CREATE INDEX IF NOT EXISTS idx_convites_status_expira ON public.convites_prestador(status, expira_em);

GRANT SELECT, INSERT, UPDATE ON public.convites_prestador TO authenticated;
GRANT ALL ON public.convites_prestador TO service_role;

ALTER TABLE public.convites_prestador ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read convites" ON public.convites_prestador;
CREATE POLICY "auth read convites" ON public.convites_prestador
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth insert convites" ON public.convites_prestador;
CREATE POLICY "auth insert convites" ON public.convites_prestador
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth update convites" ON public.convites_prestador;
CREATE POLICY "auth update convites" ON public.convites_prestador
  FOR UPDATE TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_convites_updated_at ON public.convites_prestador;
CREATE TRIGGER trg_convites_updated_at BEFORE UPDATE ON public.convites_prestador
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='convites_prestador';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.convites_prestador';
  END IF;
END $$;
