-- Estrutura para detalhes internos de usuários (RH / operações)
CREATE TABLE IF NOT EXISTS public.user_internal_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  admission_date DATE,
  position_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_position_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_custom_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_name)
);

CREATE TABLE IF NOT EXISTS public.user_internal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  history_type TEXT NOT NULL,
  description TEXT NOT NULL,
  reference_id TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_internal_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_position_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_internal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read user_internal_profiles"
ON public.user_internal_profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage user_internal_profiles"
ON public.user_internal_profiles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read user_position_options"
ON public.user_position_options
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage user_position_options"
ON public.user_position_options
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read user_custom_permissions"
ON public.user_custom_permissions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage user_custom_permissions"
ON public.user_custom_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read user_internal_history"
ON public.user_internal_history
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage user_internal_history"
ON public.user_internal_history
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.set_user_internal_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_internal_profiles_updated_at ON public.user_internal_profiles;
CREATE TRIGGER trg_user_internal_profiles_updated_at
BEFORE UPDATE ON public.user_internal_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_user_internal_profiles_updated_at();

INSERT INTO public.user_position_options (name)
VALUES
  ('Atendente'),
  ('Supervisor'),
  ('Coordenador')
ON CONFLICT (name) DO NOTHING;
