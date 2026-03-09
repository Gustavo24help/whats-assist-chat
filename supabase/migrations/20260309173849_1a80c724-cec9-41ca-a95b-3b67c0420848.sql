
-- 1) user_internal_profiles
CREATE TABLE public.user_internal_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  admission_date DATE,
  position_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_internal_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select user_internal_profiles" ON public.user_internal_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert user_internal_profiles" ON public.user_internal_profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update user_internal_profiles" ON public.user_internal_profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_internal_profiles_updated_at
  BEFORE UPDATE ON public.user_internal_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) user_position_options
CREATE TABLE public.user_position_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_position_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select user_position_options" ON public.user_position_options FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert user_position_options" ON public.user_position_options FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed initial positions
INSERT INTO public.user_position_options (name) VALUES ('Atendente'), ('Supervisor'), ('Coordenador');

-- 3) user_custom_permissions
CREATE TABLE public.user_custom_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_name)
);

ALTER TABLE public.user_custom_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select user_custom_permissions" ON public.user_custom_permissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert user_custom_permissions" ON public.user_custom_permissions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete user_custom_permissions" ON public.user_custom_permissions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) user_internal_history
CREATE TABLE public.user_internal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  history_type TEXT NOT NULL,
  description TEXT NOT NULL,
  reference_id TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_internal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select user_internal_history" ON public.user_internal_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert user_internal_history" ON public.user_internal_history FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
