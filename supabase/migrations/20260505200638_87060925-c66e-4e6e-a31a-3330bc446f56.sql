
-- =========================================================
-- 1) STORAGE: restringir leitura de task-attachments a usuários logados
-- =========================================================
DROP POLICY IF EXISTS "Anyone can view task attachments" ON storage.objects;

CREATE POLICY "Authenticated users can view task attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'task-attachments');

-- =========================================================
-- 2) Revogar EXECUTE de funções de TRIGGER (não devem ser
--    chamáveis via API — triggers rodam como owner)
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.aumentar_nao_lidos_nova_msg() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.auto_promote_status_on_valor_manual() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.close_orcamento_on_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.ensure_nome_cliente_preenchido() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_ficha_duplicate_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_chat_takeover() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_orcamento_created() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_task_assigned() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_task_completed() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.reactivate_conversation_on_message() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.registrar_mudanca_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.schedule_bot_reactivation() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_task_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_transacao_on_pagamento_realizado() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.track_bot_toggle() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.track_chat_assumido() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.track_comparecimento_prestador() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.track_ficha_status_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.track_marcos_servico_prestador() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.track_mensagem_enviada() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.track_pagamento_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.track_transacao_criada() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_auto_finalizacao() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_ficha_ativa_on_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_task_priority() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_task_progress() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_task_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_team_member_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_tipo_agendamento() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.mark_first_orcamento() FROM anon, authenticated, public;

-- =========================================================
-- 3) Revogar EXECUTE de RPCs internas para o role anon
--    (continuam acessíveis para authenticated)
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.calculate_conversas_iniciadas(timestamptz, timestamptz, integer, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_and_close_orcamento_forms() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fichas_sem_nome_cliente_recentes() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.find_or_create_internal_conversation(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_unread_cliente_msgs(text[], jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_unread_state_for_user(text[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_avisos(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_internal_conversation_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.redistribute_chats_silent(text[], uuid) FROM anon, public;
