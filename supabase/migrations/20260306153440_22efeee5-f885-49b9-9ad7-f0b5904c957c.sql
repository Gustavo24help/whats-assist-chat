
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_destino uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'geral',
  referencia_id text NULL,
  titulo text NOT NULL,
  descricao text NULL,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notificacoes FOR SELECT
  TO authenticated
  USING (usuario_destino = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notificacoes FOR UPDATE
  TO authenticated
  USING (usuario_destino = auth.uid());

CREATE POLICY "System can insert notifications"
  ON public.notificacoes FOR INSERT
  TO authenticated
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
