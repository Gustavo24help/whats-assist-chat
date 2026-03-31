
-- =====================================================
-- MASSIVE SECURITY FIX: Change all {public} policies to {authenticated}
-- This prevents unauthenticated access to all business data
-- Edge functions use service_role which bypasses RLS, so they're unaffected
-- Database triggers use SECURITY DEFINER which also bypasses RLS
-- =====================================================

-- 1. PRESTADOR_HISTORICO
DROP POLICY IF EXISTS "Atendentes podem inserir historico prestador" ON public.prestador_historico;
DROP POLICY IF EXISTS "Atendentes podem ver historico prestador" ON public.prestador_historico;
CREATE POLICY "Atendentes podem inserir historico prestador" ON public.prestador_historico FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver historico prestador" ON public.prestador_historico FOR SELECT TO authenticated USING (true);

-- 2. FICHA_STATUS_HISTORICO
DROP POLICY IF EXISTS "Atendentes podem ver histórico de status" ON public.ficha_status_historico;
DROP POLICY IF EXISTS "Sistema pode atualizar histórico de status" ON public.ficha_status_historico;
DROP POLICY IF EXISTS "Sistema pode inserir histórico de status" ON public.ficha_status_historico;
CREATE POLICY "Atendentes podem ver histórico de status" ON public.ficha_status_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sistema pode atualizar histórico de status" ON public.ficha_status_historico FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Sistema pode inserir histórico de status" ON public.ficha_status_historico FOR INSERT TO authenticated WITH CHECK (true);
-- Service role for triggers
CREATE POLICY "Service role ficha_status_historico" ON public.ficha_status_historico FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. INTERNAL_MESSAGES (already use auth.uid() checks but applied to public)
DROP POLICY IF EXISTS "Members can send messages" ON public.internal_messages;
DROP POLICY IF EXISTS "Members can view messages" ON public.internal_messages;
CREATE POLICY "Members can send messages" ON public.internal_messages FOR INSERT TO authenticated WITH CHECK ((sender_id = auth.uid()) AND is_internal_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Members can view messages" ON public.internal_messages FOR SELECT TO authenticated USING (is_internal_conversation_member(conversation_id, auth.uid()));

-- 4. INTERNAL_CONVERSATION_MEMBERS
DROP POLICY IF EXISTS "Members can view members" ON public.internal_conversation_members;
DROP POLICY IF EXISTS "Users can update own membership" ON public.internal_conversation_members;
CREATE POLICY "Members can view members" ON public.internal_conversation_members FOR SELECT TO authenticated USING (is_internal_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Users can update own membership" ON public.internal_conversation_members FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 5. INTERNAL_CONVERSATIONS
DROP POLICY IF EXISTS "Members can update conversations" ON public.internal_conversations;
DROP POLICY IF EXISTS "Members can view conversations" ON public.internal_conversations;
CREATE POLICY "Members can update conversations" ON public.internal_conversations FOR UPDATE TO authenticated USING (is_internal_conversation_member(id, auth.uid()));
CREATE POLICY "Members can view conversations" ON public.internal_conversations FOR SELECT TO authenticated USING (is_internal_conversation_member(id, auth.uid()));

-- 6. MENSAGENS_PRESTADORES
DROP POLICY IF EXISTS "Atendentes podem atualizar mensagens_prestadores" ON public.mensagens_prestadores;
DROP POLICY IF EXISTS "Atendentes podem inserir mensagens_prestadores" ON public.mensagens_prestadores;
DROP POLICY IF EXISTS "Atendentes podem ver mensagens_prestadores" ON public.mensagens_prestadores;
CREATE POLICY "Atendentes podem atualizar mensagens_prestadores" ON public.mensagens_prestadores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir mensagens_prestadores" ON public.mensagens_prestadores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver mensagens_prestadores" ON public.mensagens_prestadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role mensagens_prestadores" ON public.mensagens_prestadores FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. NPS_RESPOSTAS
DROP POLICY IF EXISTS "Atendentes podem atualizar NPS" ON public.nps_respostas;
DROP POLICY IF EXISTS "Atendentes podem inserir NPS" ON public.nps_respostas;
DROP POLICY IF EXISTS "Atendentes podem ver todos os NPS" ON public.nps_respostas;
CREATE POLICY "Atendentes podem atualizar NPS" ON public.nps_respostas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir NPS" ON public.nps_respostas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver todos os NPS" ON public.nps_respostas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role nps_respostas" ON public.nps_respostas FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. PRESTADORES
DROP POLICY IF EXISTS "Atendentes podem atualizar prestadores" ON public.prestadores;
DROP POLICY IF EXISTS "Atendentes podem deletar prestadores" ON public.prestadores;
DROP POLICY IF EXISTS "Atendentes podem inserir prestadores" ON public.prestadores;
DROP POLICY IF EXISTS "Atendentes podem ver todos os prestadores" ON public.prestadores;
CREATE POLICY "Atendentes podem atualizar prestadores" ON public.prestadores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem deletar prestadores" ON public.prestadores FOR DELETE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir prestadores" ON public.prestadores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver todos os prestadores" ON public.prestadores FOR SELECT TO authenticated USING (true);

-- 9. FICHAS_DE_SERVICO
DROP POLICY IF EXISTS "Atendentes podem atualizar fichas" ON public.fichas_de_servico;
DROP POLICY IF EXISTS "Atendentes podem inserir fichas" ON public.fichas_de_servico;
DROP POLICY IF EXISTS "Atendentes podem ver todas as fichas" ON public.fichas_de_servico;
CREATE POLICY "Atendentes podem atualizar fichas" ON public.fichas_de_servico FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir fichas" ON public.fichas_de_servico FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver todas as fichas" ON public.fichas_de_servico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role fichas_de_servico" ON public.fichas_de_servico FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 10. DESCONTOS_AJUSTES
DROP POLICY IF EXISTS "Atendentes podem atualizar descontos" ON public.descontos_ajustes;
DROP POLICY IF EXISTS "Atendentes podem inserir descontos" ON public.descontos_ajustes;
DROP POLICY IF EXISTS "Atendentes podem ver descontos" ON public.descontos_ajustes;
CREATE POLICY "Atendentes podem atualizar descontos" ON public.descontos_ajustes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir descontos" ON public.descontos_ajustes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver descontos" ON public.descontos_ajustes FOR SELECT TO authenticated USING (true);

-- 11. CLIENTES
DROP POLICY IF EXISTS "Atendentes podem atualizar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Atendentes podem inserir clientes" ON public.clientes;
DROP POLICY IF EXISTS "Atendentes podem ver todos os clientes" ON public.clientes;
CREATE POLICY "Atendentes podem atualizar clientes" ON public.clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver todos os clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role clientes" ON public.clientes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12. GOOGLE_ADS_METRICS
DROP POLICY IF EXISTS "Admins e supervisores podem ver métricas" ON public.google_ads_metrics;
DROP POLICY IF EXISTS "Sistema pode atualizar métricas" ON public.google_ads_metrics;
DROP POLICY IF EXISTS "Sistema pode inserir métricas" ON public.google_ads_metrics;
CREATE POLICY "Admins e supervisores podem ver métricas" ON public.google_ads_metrics FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Service role google_ads_metrics" ON public.google_ads_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 13. ORCAMENTOS
DROP POLICY IF EXISTS "Atendentes podem atualizar orçamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Atendentes podem inserir orçamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Atendentes podem ver todos os orçamentos" ON public.orcamentos;
CREATE POLICY "Atendentes podem atualizar orçamentos" ON public.orcamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir orçamentos" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver todos os orçamentos" ON public.orcamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role orcamentos" ON public.orcamentos FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 14. WHATSAPP_TEMPLATES
DROP POLICY IF EXISTS "Admins podem atualizar templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Admins podem deletar templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Admins podem inserir templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Atendentes podem ver todos os templates" ON public.whatsapp_templates;
CREATE POLICY "Admins podem atualizar templates" ON public.whatsapp_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins podem deletar templates" ON public.whatsapp_templates FOR DELETE TO authenticated USING (true);
CREATE POLICY "Admins podem inserir templates" ON public.whatsapp_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver todos os templates" ON public.whatsapp_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role whatsapp_templates" ON public.whatsapp_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 15. CONVERSA_FICHA_VINCULO
DROP POLICY IF EXISTS "Atendentes podem atualizar vinculos" ON public.conversa_ficha_vinculo;
DROP POLICY IF EXISTS "Atendentes podem criar vinculos" ON public.conversa_ficha_vinculo;
DROP POLICY IF EXISTS "Atendentes podem ver vinculos" ON public.conversa_ficha_vinculo;
CREATE POLICY "Atendentes podem atualizar vinculos" ON public.conversa_ficha_vinculo FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem criar vinculos" ON public.conversa_ficha_vinculo FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver vinculos" ON public.conversa_ficha_vinculo FOR SELECT TO authenticated USING (true);

-- 16. PRESTADORES_CHAT
DROP POLICY IF EXISTS "Atendentes podem atualizar prestadores_chat" ON public.prestadores_chat;
DROP POLICY IF EXISTS "Atendentes podem inserir prestadores_chat" ON public.prestadores_chat;
DROP POLICY IF EXISTS "Atendentes podem ver prestadores_chat" ON public.prestadores_chat;
CREATE POLICY "Atendentes podem atualizar prestadores_chat" ON public.prestadores_chat FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir prestadores_chat" ON public.prestadores_chat FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver prestadores_chat" ON public.prestadores_chat FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role prestadores_chat" ON public.prestadores_chat FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 17. TAGS
DROP POLICY IF EXISTS "Atendentes podem atualizar tags" ON public.tags;
DROP POLICY IF EXISTS "Atendentes podem deletar tags" ON public.tags;
DROP POLICY IF EXISTS "Atendentes podem inserir tags" ON public.tags;
DROP POLICY IF EXISTS "Atendentes podem ver todas as tags" ON public.tags;
CREATE POLICY "Atendentes podem atualizar tags" ON public.tags FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem deletar tags" ON public.tags FOR DELETE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir tags" ON public.tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver todas as tags" ON public.tags FOR SELECT TO authenticated USING (true);

-- 18. PROFILES
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are created automatically" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
-- Service role needed for handle_new_user trigger
CREATE POLICY "Service role profiles" ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 19. USER_ROLES
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert user roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all user roles" ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Service role needed for manage-users edge function
CREATE POLICY "Service role user_roles" ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 20. CONFIGURACOES
DROP POLICY IF EXISTS "Admins podem atualizar configurações" ON public.configuracoes;
DROP POLICY IF EXISTS "Admins podem deletar configurações" ON public.configuracoes;
DROP POLICY IF EXISTS "Admins podem inserir configurações" ON public.configuracoes;
DROP POLICY IF EXISTS "Admins podem ver todas as configurações" ON public.configuracoes;
CREATE POLICY "Admins podem atualizar configurações" ON public.configuracoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins podem deletar configurações" ON public.configuracoes FOR DELETE TO authenticated USING (true);
CREATE POLICY "Admins podem inserir configurações" ON public.configuracoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins podem ver todas as configurações" ON public.configuracoes FOR SELECT TO authenticated USING (true);

-- 21. BOT_REACTIVATION_SCHEDULE
DROP POLICY IF EXISTS "Atendentes podem ver agendamentos" ON public.bot_reactivation_schedule;
DROP POLICY IF EXISTS "Sistema pode atualizar agendamentos" ON public.bot_reactivation_schedule;
DROP POLICY IF EXISTS "Sistema pode inserir agendamentos" ON public.bot_reactivation_schedule;
CREATE POLICY "Atendentes podem ver agendamentos" ON public.bot_reactivation_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sistema pode atualizar agendamentos" ON public.bot_reactivation_schedule FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Sistema pode inserir agendamentos" ON public.bot_reactivation_schedule FOR INSERT TO authenticated WITH CHECK (true);
-- Service role for triggers/edge functions
CREATE POLICY "Service role bot_reactivation_schedule" ON public.bot_reactivation_schedule FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 22. MENSAGENS
DROP POLICY IF EXISTS "Atendentes podem atualizar mensagens" ON public.mensagens;
DROP POLICY IF EXISTS "Atendentes podem inserir mensagens" ON public.mensagens;
DROP POLICY IF EXISTS "Atendentes podem ver todas as mensagens" ON public.mensagens;
CREATE POLICY "Atendentes podem atualizar mensagens" ON public.mensagens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir mensagens" ON public.mensagens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver todas as mensagens" ON public.mensagens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role mensagens" ON public.mensagens FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 23. MENSAGENS_BACKUP_QUEUE (change from public ALL to service_role only)
DROP POLICY IF EXISTS "Service role full access" ON public.mensagens_backup_queue;
CREATE POLICY "Service role full access" ON public.mensagens_backup_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 24. ADIANTAMENTOS
DROP POLICY IF EXISTS "Atendentes podem atualizar adiantamentos" ON public.adiantamentos;
DROP POLICY IF EXISTS "Atendentes podem inserir adiantamentos" ON public.adiantamentos;
DROP POLICY IF EXISTS "Atendentes podem ver adiantamentos" ON public.adiantamentos;
CREATE POLICY "Atendentes podem atualizar adiantamentos" ON public.adiantamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir adiantamentos" ON public.adiantamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver adiantamentos" ON public.adiantamentos FOR SELECT TO authenticated USING (true);

-- 25. AVALIACAO_PRESTADOR
DROP POLICY IF EXISTS "Atendentes podem atualizar avaliacoes prestador" ON public.avaliacao_prestador;
DROP POLICY IF EXISTS "Atendentes podem inserir avaliacoes prestador" ON public.avaliacao_prestador;
DROP POLICY IF EXISTS "Atendentes podem ver todas avaliacoes prestador" ON public.avaliacao_prestador;
CREATE POLICY "Atendentes podem atualizar avaliacoes prestador" ON public.avaliacao_prestador FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir avaliacoes prestador" ON public.avaliacao_prestador FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver todas avaliacoes prestador" ON public.avaliacao_prestador FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role avaliacao_prestador" ON public.avaliacao_prestador FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 26. MENSAGENS_PADRONIZADAS
DROP POLICY IF EXISTS "Atendentes podem atualizar mensagens padronizadas" ON public.mensagens_padronizadas;
DROP POLICY IF EXISTS "Atendentes podem deletar mensagens padronizadas" ON public.mensagens_padronizadas;
DROP POLICY IF EXISTS "Atendentes podem inserir mensagens padronizadas" ON public.mensagens_padronizadas;
DROP POLICY IF EXISTS "Atendentes podem ver todas as mensagens padronizadas" ON public.mensagens_padronizadas;
CREATE POLICY "Atendentes podem atualizar mensagens padronizadas" ON public.mensagens_padronizadas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem deletar mensagens padronizadas" ON public.mensagens_padronizadas FOR DELETE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir mensagens padronizadas" ON public.mensagens_padronizadas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver todas as mensagens padronizadas" ON public.mensagens_padronizadas FOR SELECT TO authenticated USING (true);

-- 27. CONTA_CORRENTE_PRESTADOR
DROP POLICY IF EXISTS "Atendentes podem atualizar conta corrente" ON public.conta_corrente_prestador;
DROP POLICY IF EXISTS "Atendentes podem inserir na conta corrente" ON public.conta_corrente_prestador;
DROP POLICY IF EXISTS "Atendentes podem ver conta corrente" ON public.conta_corrente_prestador;
CREATE POLICY "Atendentes podem atualizar conta corrente" ON public.conta_corrente_prestador FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir na conta corrente" ON public.conta_corrente_prestador FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver conta corrente" ON public.conta_corrente_prestador FOR SELECT TO authenticated USING (true);

-- 28. CATEGORIAS
DROP POLICY IF EXISTS "Atendentes podem atualizar categorias" ON public.categorias;
DROP POLICY IF EXISTS "Atendentes podem inserir categorias" ON public.categorias;
DROP POLICY IF EXISTS "Atendentes podem ver todas as categorias" ON public.categorias;
CREATE POLICY "Atendentes podem atualizar categorias" ON public.categorias FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir categorias" ON public.categorias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver todas as categorias" ON public.categorias FOR SELECT TO authenticated USING (true);

-- 29. DASHBOARD_METAS
DROP POLICY IF EXISTS "Admins e supervisores podem ver metas" ON public.dashboard_metas;
DROP POLICY IF EXISTS "Admins podem atualizar metas" ON public.dashboard_metas;
DROP POLICY IF EXISTS "Admins podem inserir metas" ON public.dashboard_metas;
CREATE POLICY "Admins e supervisores podem ver metas" ON public.dashboard_metas FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Admins podem atualizar metas" ON public.dashboard_metas FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins podem inserir metas" ON public.dashboard_metas FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 30. WEBHOOK_DEBUG_LOGS
DROP POLICY IF EXISTS "Admins can view debug logs" ON public.webhook_debug_logs;
DROP POLICY IF EXISTS "System can insert debug logs" ON public.webhook_debug_logs;
DROP POLICY IF EXISTS "System can update debug logs" ON public.webhook_debug_logs;
CREATE POLICY "Admins can view debug logs" ON public.webhook_debug_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role webhook_debug_logs" ON public.webhook_debug_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 31. TRANSACOES_FINANCEIRAS
DROP POLICY IF EXISTS "Atendentes podem atualizar transações" ON public.transacoes_financeiras;
DROP POLICY IF EXISTS "Atendentes podem inserir transações" ON public.transacoes_financeiras;
DROP POLICY IF EXISTS "Atendentes podem ver transações" ON public.transacoes_financeiras;
CREATE POLICY "Atendentes podem atualizar transações" ON public.transacoes_financeiras FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Atendentes podem inserir transações" ON public.transacoes_financeiras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atendentes podem ver transações" ON public.transacoes_financeiras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role transacoes_financeiras" ON public.transacoes_financeiras FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 32. STORAGE POLICIES for chat-files bucket
DROP POLICY IF EXISTS "Atendentes podem atualizar arquivos de chat" ON storage.objects;
DROP POLICY IF EXISTS "Atendentes podem deletar arquivos de chat" ON storage.objects;
DROP POLICY IF EXISTS "Atendentes podem fazer upload de arquivos de chat" ON storage.objects;
DROP POLICY IF EXISTS "Atendentes podem ver arquivos de chat" ON storage.objects;
CREATE POLICY "Atendentes podem atualizar arquivos de chat" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'chat-files');
CREATE POLICY "Atendentes podem deletar arquivos de chat" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'chat-files');
CREATE POLICY "Atendentes podem fazer upload de arquivos de chat" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-files');
CREATE POLICY "Atendentes podem ver arquivos de chat" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-files');

-- 33. PRESTADOR_HISTORICO - add service_role for edge functions
CREATE POLICY "Service role prestador_historico" ON public.prestador_historico FOR ALL TO service_role USING (true) WITH CHECK (true);
