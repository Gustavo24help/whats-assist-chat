
-- 1. Fix bot_historico: change from public to authenticated only
DROP POLICY IF EXISTS "Atendentes podem ver histórico do bot" ON public.bot_historico;
DROP POLICY IF EXISTS "Sistema pode inserir histórico do bot" ON public.bot_historico;

CREATE POLICY "Authenticated podem ver histórico do bot"
  ON public.bot_historico FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated podem inserir histórico do bot"
  ON public.bot_historico FOR INSERT TO authenticated
  WITH CHECK (true);

-- Allow service role inserts (edge functions use service role)
CREATE POLICY "Service role pode inserir histórico do bot"
  ON public.bot_historico FOR INSERT TO service_role
  WITH CHECK (true);

-- 2. Enable RLS on twilio_sync_control
ALTER TABLE public.twilio_sync_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated podem ver twilio_sync_control"
  ON public.twilio_sync_control FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role full access twilio_sync_control"
  ON public.twilio_sync_control FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. Enable RLS on mensagens_backup
ALTER TABLE public.mensagens_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated podem ver mensagens_backup"
  ON public.mensagens_backup FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role full access mensagens_backup"
  ON public.mensagens_backup FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4. Enable RLS on mensagens_backup_teste
ALTER TABLE public.mensagens_backup_teste ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated podem ver mensagens_backup_teste"
  ON public.mensagens_backup_teste FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role full access mensagens_backup_teste"
  ON public.mensagens_backup_teste FOR ALL TO service_role
  USING (true) WITH CHECK (true);
