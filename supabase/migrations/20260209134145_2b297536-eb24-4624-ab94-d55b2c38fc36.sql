
-- Enable RLS on webhook_debug_logs
ALTER TABLE public.webhook_debug_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read debug logs
CREATE POLICY "Admins can view debug logs"
ON public.webhook_debug_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System (service role) can insert logs
CREATE POLICY "System can insert debug logs"
ON public.webhook_debug_logs
FOR INSERT
WITH CHECK (true);

-- System can update debug logs
CREATE POLICY "System can update debug logs"
ON public.webhook_debug_logs
FOR UPDATE
USING (true);
