CREATE TABLE IF NOT EXISTS public.avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  imagem_url text,
  criado_por uuid REFERENCES public.profiles(id),
  criado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aviso_leituras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id uuid NOT NULL REFERENCES public.avisos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aviso_id, user_id)
);

ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aviso_leituras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read avisos" ON public.avisos;
CREATE POLICY "Authenticated users can read avisos"
ON public.avisos
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can create avisos" ON public.avisos;
CREATE POLICY "Admins can create avisos"
ON public.avisos
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update avisos" ON public.avisos;
CREATE POLICY "Admins can update avisos"
ON public.avisos
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete avisos" ON public.avisos;
CREATE POLICY "Admins can delete avisos"
ON public.avisos
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can read their aviso_leituras" ON public.aviso_leituras;
CREATE POLICY "Users can read their aviso_leituras"
ON public.aviso_leituras
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can mark aviso as read" ON public.aviso_leituras;
CREATE POLICY "Users can mark aviso as read"
ON public.aviso_leituras
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their aviso_leituras" ON public.aviso_leituras;
CREATE POLICY "Users can update their aviso_leituras"
ON public.aviso_leituras
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
