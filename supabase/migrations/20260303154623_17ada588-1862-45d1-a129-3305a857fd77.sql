
CREATE TABLE public.daily_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  meta_agendamento_quantidade integer NOT NULL DEFAULT 0,
  meta_agendamento_valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver metas diarias"
  ON public.daily_goals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem inserir metas diarias"
  ON public.daily_goals FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar metas diarias"
  ON public.daily_goals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Atendentes podem ver metas diarias"
  ON public.daily_goals FOR SELECT TO authenticated
  USING (true);
