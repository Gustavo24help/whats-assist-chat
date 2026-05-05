
-- mensagens_backup
DROP POLICY IF EXISTS "Anon pode ver mensagens_backup" ON public.mensagens_backup;
DROP POLICY IF EXISTS "Anon SELECT mensagens_backup" ON public.mensagens_backup;
DROP POLICY IF EXISTS "anon_select_mensagens_backup" ON public.mensagens_backup;

-- mensagens_backup_teste
DROP POLICY IF EXISTS "Anon pode ver mensagens_backup_teste" ON public.mensagens_backup_teste;
DROP POLICY IF EXISTS "Anon SELECT mensagens_backup_teste" ON public.mensagens_backup_teste;
DROP POLICY IF EXISTS "anon_select_mensagens_backup_teste" ON public.mensagens_backup_teste;

-- notificacoes (drop anon insert)
DROP POLICY IF EXISTS "Anon pode inserir notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Anon INSERT notificacoes" ON public.notificacoes;

-- system_logs (drop anon insert; keep authenticated)
DROP POLICY IF EXISTS "Anon pode inserir system_logs" ON public.system_logs;
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.system_logs;
DROP POLICY IF EXISTS "Anyone can insert system_logs" ON public.system_logs;
DROP POLICY IF EXISTS "Public insert system_logs" ON public.system_logs;
-- Recriar política restrita a authenticated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'system_logs'
      AND policyname = 'Authenticated can insert system_logs'
  ) THEN
    CREATE POLICY "Authenticated can insert system_logs"
      ON public.system_logs FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- conversa_operador_leitura
DROP POLICY IF EXISTS "anon_full_access_conversa_leitura" ON public.conversa_operador_leitura;

-- daily_goals
DROP POLICY IF EXISTS "Anon pode ver daily_goals" ON public.daily_goals;

-- avisos
DROP POLICY IF EXISTS "Anon pode ver avisos" ON public.avisos;

-- google_ads_metrics
DROP POLICY IF EXISTS "Anon pode ver google_ads" ON public.google_ads_metrics;

-- ficha_coaching
DROP POLICY IF EXISTS "anon_full_access_coaching" ON public.ficha_coaching;

-- categorias (manter SELECT anon, remover write)
DROP POLICY IF EXISTS "Anon pode inserir categorias" ON public.categorias;
DROP POLICY IF EXISTS "Anon pode atualizar categorias" ON public.categorias;

-- mensagens_padronizadas (remover write anon, manter SELECT se existir)
DROP POLICY IF EXISTS "Anon pode inserir mensagens_padronizadas" ON public.mensagens_padronizadas;
DROP POLICY IF EXISTS "Anon pode atualizar mensagens_padronizadas" ON public.mensagens_padronizadas;
DROP POLICY IF EXISTS "Anon pode deletar mensagens_padronizadas" ON public.mensagens_padronizadas;
