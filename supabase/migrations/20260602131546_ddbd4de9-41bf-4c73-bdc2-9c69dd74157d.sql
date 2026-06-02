-- =============================================================
-- Otimizações de IO/performance (sem alterar dados operacionais)
-- =============================================================

-- 1) Auditoria antes de remover tabelas mortas
DO $$
DECLARE v_bkp_teste bigint; v_bkp bigint; v_webhook bigint;
BEGIN
  SELECT count(*) INTO v_bkp_teste FROM public.mensagens_backup_teste;
  SELECT count(*) INTO v_bkp FROM public.mensagens_backup;
  SELECT count(*) INTO v_webhook FROM public.webhook_debug_logs;

  INSERT INTO public.system_logs (nivel, categoria, mensagem, detalhes, url)
  VALUES (
    'info', 'maintenance',
    'Cleanup tabelas de backup/log antes de drop/truncate',
    jsonb_build_object(
      'mensagens_backup_teste_rows', v_bkp_teste,
      'mensagens_backup_rows', v_bkp,
      'webhook_debug_logs_rows_total', v_webhook,
      'webhook_debug_logs_kept_last_days', 7
    ),
    'migration://otimizacao-io-2026-06-02'
  );
END $$;

-- 2) Drop de tabelas de backup não referenciadas pelo código
DROP TABLE IF EXISTS public.mensagens_backup_teste;
DROP TABLE IF EXISTS public.mensagens_backup;

-- 3) Retenção de webhook_debug_logs: manter apenas últimos 7 dias
DELETE FROM public.webhook_debug_logs
WHERE created_at < now() - interval '7 days';

-- 4) Índices faltantes (tabelas pequenas; CREATE INDEX simples é rápido e seguro)
CREATE INDEX IF NOT EXISTS idx_mensagens_data_hora_desc
  ON public.mensagens (data_hora DESC);

CREATE INDEX IF NOT EXISTS idx_mensagens_remetente_data
  ON public.mensagens (remetente, data_hora DESC);

CREATE INDEX IF NOT EXISTS idx_mensagens_tipo_remetente
  ON public.mensagens (tipo_remetente)
  WHERE tipo_remetente IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fichas_status_created
  ON public.fichas_de_servico (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fichas_created_at_desc
  ON public.fichas_de_servico (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clientes_status_conversa
  ON public.clientes (status_conversa);

CREATE INDEX IF NOT EXISTS idx_clientes_ultima_interacao_desc
  ON public.clientes (ultima_interacao DESC);

CREATE INDEX IF NOT EXISTS idx_orcamentos_data_criacao_desc
  ON public.orcamentos (data_criacao DESC);

CREATE INDEX IF NOT EXISTS idx_mlo_cliente_telefone
  ON public.mensagem_leitura_operador (cliente_telefone);

-- 5) Ajustar RPC get_ultima_msg_cliente para usar índice (cliente_id, data_hora DESC)
--    Mesma assinatura, mesmo retorno; troca MAX/GROUP BY por DISTINCT ON.
CREATE OR REPLACE FUNCTION public.get_ultima_msg_cliente(_telefones text[])
RETURNS TABLE(cliente_id text, ultima_data_hora timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (m.cliente_id)
    m.cliente_id, m.data_hora
  FROM public.mensagens m
  WHERE m.cliente_id = ANY(_telefones)
    AND m.remetente <> 'whatsapp:+554138911555'
  ORDER BY m.cliente_id, m.data_hora DESC
$function$;

-- 6) ANALYZE para o planner usar os novos índices imediatamente
ANALYZE public.mensagens;
ANALYZE public.fichas_de_servico;
ANALYZE public.clientes;
ANALYZE public.mensagem_leitura_operador;
ANALYZE public.orcamentos;
ANALYZE public.webhook_debug_logs;