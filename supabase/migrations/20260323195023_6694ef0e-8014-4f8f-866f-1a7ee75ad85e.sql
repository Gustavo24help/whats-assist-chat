
CREATE TABLE public.ajustes_data_finalizacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id text NOT NULL,
  data_anterior timestamptz NOT NULL,
  data_nova timestamptz NOT NULL,
  justificativa text NOT NULL,
  prestador_id text,
  prestador_nome text,
  ajustado_por uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ajustes_data_finalizacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users podem inserir ajustes"
  ON public.ajustes_data_finalizacao
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users podem ver ajustes"
  ON public.ajustes_data_finalizacao
  FOR SELECT
  TO authenticated
  USING (true);
