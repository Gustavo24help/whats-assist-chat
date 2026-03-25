CREATE OR REPLACE FUNCTION public.can_manage_avisos(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'chefe'::app_role)
      OR public.has_role(_user_id, 'admin_ti'::app_role)
$$;

DROP POLICY IF EXISTS "Admins podem criar avisos" ON public.avisos;
DROP POLICY IF EXISTS "Admins podem atualizar avisos" ON public.avisos;
DROP POLICY IF EXISTS "Admins podem deletar avisos" ON public.avisos;
DROP POLICY IF EXISTS "Admins podem gerenciar destinatarios" ON public.aviso_destinatarios;

CREATE POLICY "Gestores podem criar avisos"
ON public.avisos
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_avisos(auth.uid()));

CREATE POLICY "Gestores podem atualizar avisos"
ON public.avisos
FOR UPDATE
TO authenticated
USING (public.can_manage_avisos(auth.uid()))
WITH CHECK (public.can_manage_avisos(auth.uid()));

CREATE POLICY "Gestores podem deletar avisos"
ON public.avisos
FOR DELETE
TO authenticated
USING (public.can_manage_avisos(auth.uid()));

CREATE POLICY "Gestores podem gerenciar destinatarios"
ON public.aviso_destinatarios
FOR ALL
TO authenticated
USING (public.can_manage_avisos(auth.uid()))
WITH CHECK (public.can_manage_avisos(auth.uid()));