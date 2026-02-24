
CREATE TABLE public.takeover_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_cliente text NOT NULL,
  solicitante_id uuid NOT NULL,
  solicitante_nome text NOT NULL,
  operador_atual_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

ALTER TABLE public.takeover_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atendentes podem ver solicitacoes"
  ON public.takeover_requests FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Atendentes podem inserir solicitacoes"
  ON public.takeover_requests FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Atendentes podem atualizar solicitacoes"
  ON public.takeover_requests FOR UPDATE TO authenticated
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.takeover_requests;
