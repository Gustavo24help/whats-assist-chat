ALTER TABLE public.avisos
  ADD COLUMN IF NOT EXISTS enviar_popup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enviar_para_todos boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.aviso_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id uuid NOT NULL REFERENCES public.avisos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aviso_id, user_id)
);

ALTER TABLE public.aviso_destinatarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem gerenciar destinatários de avisos" ON public.aviso_destinatarios;
CREATE POLICY "Admins podem gerenciar destinatários de avisos"
ON public.aviso_destinatarios
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Usuários podem ver seus destinatários de avisos" ON public.aviso_destinatarios;
CREATE POLICY "Usuários podem ver seus destinatários de avisos"
ON public.aviso_destinatarios
FOR SELECT
USING (auth.uid() = user_id);
