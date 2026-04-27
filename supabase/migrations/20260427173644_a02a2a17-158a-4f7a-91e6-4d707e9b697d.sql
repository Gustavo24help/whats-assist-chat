
CREATE TABLE public.system_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nivel TEXT NOT NULL DEFAULT 'info',
  categoria TEXT NOT NULL DEFAULT 'system',
  mensagem TEXT NOT NULL,
  detalhes JSONB,
  url TEXT,
  user_agent TEXT,
  user_id UUID,
  user_email TEXT,
  user_name TEXT
);

CREATE INDEX idx_system_logs_created_at ON public.system_logs (created_at DESC);
CREATE INDEX idx_system_logs_nivel ON public.system_logs (nivel);
CREATE INDEX idx_system_logs_categoria ON public.system_logs (categoria);
CREATE INDEX idx_system_logs_user_id ON public.system_logs (user_id);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can insert logs — needed to capture pre-auth errors
CREATE POLICY "Anyone can insert system logs"
ON public.system_logs FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admin / chefe / admin_ti can read
CREATE POLICY "Admins can read system logs"
ON public.system_logs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'chefe'::app_role)
  OR public.has_role(auth.uid(), 'admin_ti'::app_role)
);

-- Only admin_ti can delete
CREATE POLICY "Admin TI can delete system logs"
ON public.system_logs FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin_ti'::app_role));
