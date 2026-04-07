
-- Cadeia de redistribuição de chats ao deslogar
CREATE TABLE public.atribuicao_cadeia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  destino_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, ordem)
);

ALTER TABLE public.atribuicao_cadeia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chain" ON public.atribuicao_cadeia
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chain" ON public.atribuicao_cadeia
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own chain" ON public.atribuicao_cadeia
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete own chain" ON public.atribuicao_cadeia
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Horário de saída previsto
CREATE TABLE public.horario_saida_previsto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  hora_saida TIME NOT NULL DEFAULT '18:00',
  lembrete_minutos_antes INTEGER NOT NULL DEFAULT 15,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.horario_saida_previsto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exit time" ON public.horario_saida_previsto
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own exit time" ON public.horario_saida_previsto
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own exit time" ON public.horario_saida_previsto
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete own exit time" ON public.horario_saida_previsto
  FOR DELETE TO authenticated USING (user_id = auth.uid());
