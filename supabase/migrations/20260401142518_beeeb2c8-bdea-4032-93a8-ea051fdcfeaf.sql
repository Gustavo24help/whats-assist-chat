
-- Restaurar acesso anon para fichas_de_servico
CREATE POLICY "Anon pode ver fichas" ON public.fichas_de_servico FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir fichas" ON public.fichas_de_servico FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar fichas" ON public.fichas_de_servico FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para clientes
CREATE POLICY "Anon pode ver clientes" ON public.clientes FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir clientes" ON public.clientes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar clientes" ON public.clientes FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para prestadores
CREATE POLICY "Anon pode ver prestadores" ON public.prestadores FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir prestadores" ON public.prestadores FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar prestadores" ON public.prestadores FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon pode deletar prestadores" ON public.prestadores FOR DELETE TO anon USING (true);

-- Restaurar acesso anon para orcamentos
CREATE POLICY "Anon pode ver orcamentos" ON public.orcamentos FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir orcamentos" ON public.orcamentos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar orcamentos" ON public.orcamentos FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para mensagens
CREATE POLICY "Anon pode ver mensagens" ON public.mensagens FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir mensagens" ON public.mensagens FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar mensagens" ON public.mensagens FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para mensagens_prestadores
CREATE POLICY "Anon pode ver mensagens_prestadores" ON public.mensagens_prestadores FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir mensagens_prestadores" ON public.mensagens_prestadores FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar mensagens_prestadores" ON public.mensagens_prestadores FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para categorias
CREATE POLICY "Anon pode ver categorias" ON public.categorias FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir categorias" ON public.categorias FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar categorias" ON public.categorias FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para bot_historico
CREATE POLICY "Anon pode ver bot_historico" ON public.bot_historico FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir bot_historico" ON public.bot_historico FOR INSERT TO anon WITH CHECK (true);

-- Restaurar acesso anon para bot_reactivation_schedule
CREATE POLICY "Anon pode ver bot_reactivation" ON public.bot_reactivation_schedule FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir bot_reactivation" ON public.bot_reactivation_schedule FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar bot_reactivation" ON public.bot_reactivation_schedule FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para ficha_status_historico
CREATE POLICY "Anon pode ver ficha_status_historico" ON public.ficha_status_historico FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir ficha_status_historico" ON public.ficha_status_historico FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar ficha_status_historico" ON public.ficha_status_historico FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para configuracoes
CREATE POLICY "Anon pode ver configuracoes" ON public.configuracoes FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir configuracoes" ON public.configuracoes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar configuracoes" ON public.configuracoes FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon pode deletar configuracoes" ON public.configuracoes FOR DELETE TO anon USING (true);

-- Restaurar acesso anon para transacoes_financeiras
CREATE POLICY "Anon pode ver transacoes" ON public.transacoes_financeiras FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir transacoes" ON public.transacoes_financeiras FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar transacoes" ON public.transacoes_financeiras FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para adiantamentos
CREATE POLICY "Anon pode ver adiantamentos" ON public.adiantamentos FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir adiantamentos" ON public.adiantamentos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar adiantamentos" ON public.adiantamentos FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para conta_corrente_prestador
CREATE POLICY "Anon pode ver conta_corrente" ON public.conta_corrente_prestador FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir conta_corrente" ON public.conta_corrente_prestador FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar conta_corrente" ON public.conta_corrente_prestador FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para descontos_ajustes
CREATE POLICY "Anon pode ver descontos" ON public.descontos_ajustes FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir descontos" ON public.descontos_ajustes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar descontos" ON public.descontos_ajustes FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para conversa_ficha_vinculo
CREATE POLICY "Anon pode ver vinculos" ON public.conversa_ficha_vinculo FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir vinculos" ON public.conversa_ficha_vinculo FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar vinculos" ON public.conversa_ficha_vinculo FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para nps_respostas
CREATE POLICY "Anon pode ver nps" ON public.nps_respostas FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir nps" ON public.nps_respostas FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar nps" ON public.nps_respostas FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para avaliacao_prestador
CREATE POLICY "Anon pode ver avaliacao" ON public.avaliacao_prestador FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir avaliacao" ON public.avaliacao_prestador FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar avaliacao" ON public.avaliacao_prestador FOR UPDATE TO anon USING (true);

-- Restaurar acesso anon para notificacoes
CREATE POLICY "Anon pode inserir notificacoes" ON public.notificacoes FOR INSERT TO anon WITH CHECK (true);

-- Restaurar acesso anon para mensagens_padronizadas
CREATE POLICY "Anon pode ver msg padronizadas" ON public.mensagens_padronizadas FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir msg padronizadas" ON public.mensagens_padronizadas FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar msg padronizadas" ON public.mensagens_padronizadas FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon pode deletar msg padronizadas" ON public.mensagens_padronizadas FOR DELETE TO anon USING (true);

-- Restaurar acesso anon para prestador_historico
CREATE POLICY "Anon pode ver prestador_historico" ON public.prestador_historico FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir prestador_historico" ON public.prestador_historico FOR INSERT TO anon WITH CHECK (true);

-- Restaurar acesso anon para ajustes_data_finalizacao
CREATE POLICY "Anon pode ver ajustes_data" ON public.ajustes_data_finalizacao FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir ajustes_data" ON public.ajustes_data_finalizacao FOR INSERT TO anon WITH CHECK (true);

-- Restaurar acesso anon para mensagens_backup
CREATE POLICY "Anon pode ver mensagens_backup" ON public.mensagens_backup FOR SELECT TO anon USING (true);

-- Restaurar acesso anon para mensagens_backup_teste
CREATE POLICY "Anon pode ver backup_teste" ON public.mensagens_backup_teste FOR SELECT TO anon USING (true);

-- Restaurar acesso anon para daily_goals
CREATE POLICY "Anon pode ver daily_goals" ON public.daily_goals FOR SELECT TO anon USING (true);

-- Restaurar acesso anon para avisos e relacionados
CREATE POLICY "Anon pode ver avisos" ON public.avisos FOR SELECT TO anon USING (true);

-- Restaurar acesso anon para google_ads_metrics (service_role já tem, mas por segurança)
CREATE POLICY "Anon pode ver google_ads" ON public.google_ads_metrics FOR SELECT TO anon USING (true);

-- Restaurar acesso anon para prestadores_chat
CREATE POLICY "Anon pode ver prestadores_chat" ON public.prestadores_chat FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir prestadores_chat" ON public.prestadores_chat FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode atualizar prestadores_chat" ON public.prestadores_chat FOR UPDATE TO anon USING (true);
