-- ============================================================================
-- HARDENING DE SEGURANÇA: Tabela clientes
-- ============================================================================
-- Remove acesso anônimo (não autenticado) à tabela clientes.
-- 
-- Motivo: a tabela contém PII sensível (nome, telefone, CPF, endereço,
-- notas internas). Antes desta migration, qualquer pessoa com a anon key
-- pública conseguia ler/inserir/atualizar todos os 1.337 registros direto
-- pelo endpoint /rest/v1/clientes.
--
-- Auditoria realizada antes desta mudança:
--   - Todas as 12 Edge Functions que tocam `clientes` (twilio-webhook,
--     send-whatsapp, sync-twilio-messages, send-template, toggle-bot-status,
--     check-bot-status, check-unanswered-clients, process-bot-reactivation,
--     reactivate-bots-24h, stop-twilio-flow, twilio-status-callback,
--     sync-twilio-messages-com-recuperacao) usam SUPABASE_SERVICE_ROLE_KEY,
--     que bypassa RLS — nenhuma será afetada.
--   - Frontend usa o cliente Supabase autenticado (atendentes logados),
--     coberto pelas policies "authenticated" — não será afetado.
--   - Nenhum webhook externo (Make/Twilio/Asaas) bate direto no PostgREST
--     da tabela clientes; todos passam por Edge Functions.
--
-- ROLLBACK (em caso de quebra): rodar como migration nova:
--   CREATE POLICY "Anon pode ver clientes" ON public.clientes
--     FOR SELECT TO anon USING (true);
--   CREATE POLICY "Anon pode inserir clientes" ON public.clientes
--     FOR INSERT TO anon WITH CHECK (true);
--   CREATE POLICY "Anon pode atualizar clientes" ON public.clientes
--     FOR UPDATE TO anon USING (true);
-- ============================================================================

DROP POLICY IF EXISTS "Anon pode ver clientes" ON public.clientes;
DROP POLICY IF EXISTS "Anon pode inserir clientes" ON public.clientes;
DROP POLICY IF EXISTS "Anon pode atualizar clientes" ON public.clientes;

-- As seguintes policies permanecem ATIVAS e cobrem todos os fluxos legítimos:
--   • "Atendentes podem ver todos os clientes"   (SELECT, authenticated)
--   • "Atendentes podem inserir clientes"        (INSERT, authenticated)
--   • "Atendentes podem atualizar clientes"      (UPDATE, authenticated)
--   • "Service role clientes"                    (ALL,    service_role)