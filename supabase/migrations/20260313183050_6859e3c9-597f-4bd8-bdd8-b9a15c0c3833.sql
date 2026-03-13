
-- Add missing columns to avisos table
ALTER TABLE public.avisos ADD COLUMN IF NOT EXISTS enviar_popup boolean NOT NULL DEFAULT false;
ALTER TABLE public.avisos ADD COLUMN IF NOT EXISTS enviar_para_todos boolean NOT NULL DEFAULT true;

-- Create aviso_destinatarios table
CREATE TABLE IF NOT EXISTS public.aviso_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id uuid NOT NULL REFERENCES public.avisos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (aviso_id, user_id)
);

ALTER TABLE public.aviso_destinatarios ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can do everything
CREATE POLICY "Admins podem gerenciar destinatarios"
  ON public.aviso_destinatarios
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Users can see their own entries
CREATE POLICY "Usuarios podem ver seus proprios destinatarios"
  ON public.aviso_destinatarios
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
