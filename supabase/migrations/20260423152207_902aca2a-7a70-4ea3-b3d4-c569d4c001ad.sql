-- Add explicit manual_unread boolean flag to mensagem_leitura_operador
ALTER TABLE public.mensagem_leitura_operador
  ADD COLUMN IF NOT EXISTS manual_unread boolean NOT NULL DEFAULT false;

-- Backfill: any record where manual_unread_at is set AND it is more recent than last_read_at (or last_read_at is null)
-- represents an active manual unread mark, so flip the flag.
UPDATE public.mensagem_leitura_operador
SET manual_unread = true
WHERE manual_unread_at IS NOT NULL
  AND (last_read_at IS NULL OR manual_unread_at > last_read_at)
  AND manual_unread = false;

-- Helpful index for the new lookup pattern
CREATE INDEX IF NOT EXISTS idx_mensagem_leitura_operador_user_unread
  ON public.mensagem_leitura_operador (user_id, manual_unread)
  WHERE manual_unread = true;