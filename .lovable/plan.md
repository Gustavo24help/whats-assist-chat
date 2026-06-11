# Plano de Hardening de Segurança — 4 Fases

Trabalho dividido em 4 fases independentes. Cada fase só começa após sua aprovação. Nada de mexer em Twilio webhook / lógica do bot fora do escopo explicitamente listado.

---

## Fase 1 — RLS em tabelas financeiras

**Diagnóstico (a confirmar com `supabase--read_query` antes da migração):**
Tabelas financeiras candidatas:
- `contas_pagar_manual` (alvo principal do scanner)
- `contas_receber`
- `transacoes_financeiras`
- `adiantamentos`
- `conta_corrente_prestador`
- `descontos_ajustes`
- `pagamento_webhook_log`
- `ajustes_data_finalizacao`

**Ação:**
1. Para cada uma: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (se ainda não).
2. `DROP POLICY` de qualquer policy `USING (true)` ou que conceda algo a `anon`.
3. `REVOKE ALL ... FROM anon;` e garantir `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role;`.
4. Criar policies novas (SELECT/INSERT/UPDATE/DELETE) restritas a `authenticated` AND (`has_role(auth.uid(),'admin')` OR `has_role(auth.uid(),'chefe')` OR `has_role(auth.uid(),'admin_ti')`).
   - Observação: o projeto não tem role `supervisor`; os papéis equivalentes existentes são `admin`, `chefe`, `admin_ti`. **Pergunta:** usar esses três como "admin/supervisor"? Ou criar role `supervisor` novo?
5. Edge functions seguem funcionando pois usam `service_role` (bypass RLS).

**Antes de aplicar, listo no chat exatamente cada `DROP POLICY` / `CREATE POLICY` para sua aprovação.**

---

## Fase 2 — PII de clientes + buckets de chat

**Tabelas com `USING (true)` para anon (a corrigir):**
`clientes`, `fichas_de_servico`, `mensagens`, `mensagens_prestadores`, `prestadores`, `prestadores_chat`, `nps_respostas`, `avaliacao_prestador`, `orcamentos`, `bot_historico`, `notificacoes`, `conversa_ficha_vinculo`, `ficha_status_historico`, `mensagem_leitura_operador`, etc.

⚠️ **Risco crítico já documentado em memory**: a regra atual do projeto é "RLS OPEN para anon em tabelas operacionais para webhooks". Várias edge functions e o webhook da Twilio podem depender desse acesso anon (mesmo que devessem usar service_role). 

**Plano:**
1. Auditar (via `rg`) cada edge function/integração para confirmar que usa `SERVICE_ROLE_KEY` e não a anon key antes de remover policies anon.
2. Para cada tabela confirmada como segura: drop policies anon `USING (true)`, criar policy `authenticated` (com filtros por role onde aplicável).
3. Tabelas usadas por formulários públicos (ex.: `submit-orcamento`, `public-orcamento-data`, `receber-ficha`) permanecem acessíveis via edge function com service_role — não precisam de anon direto.
4. Atualizar memory `mem://security/system-wide-rls-hardening` refletindo a nova postura.

**Buckets de storage:**
1. Identificar bucket(s) de anexos (`chat-files` confirmado; verificar outros).
2. `storage_update_bucket(public=false)` — se workspace bloquear bucket público, ok; se bloquear privado, reportar.
3. Trocar todas as referências de URL pública por `createSignedUrl` (TTL ~1h) onde os anexos são renderizados:
   - `ChatWindow.tsx`, `ChatWindowBeta.tsx`, `MobileChatScreen.tsx`, `ChatPrestadores.tsx`, `AudioPlayer.tsx`, componentes em `src/components/chat-beta/`, `prestador-chat/`, recibos.
4. Ajustar policies em `storage.objects`: SELECT/INSERT só para `authenticated`; remover policy de listagem ampla.

**Antes de aplicar, listo tabela por tabela + bucket(s) + arquivos do front afetados.**

---

## Fase 3 — Webhooks Make.com no front

**Plano:**
1. `rg -n "make.com|hook.eu|hook.us|hook.integromat"` em `src/` para listar todas as URLs hardcoded e usos do supabase client lendo `configuracoes` (que contém `webhook_*`).
2. Para cada chamada identificada, criar (ou reusar) uma edge function proxy: `proxy-make-<nome>` que:
   - Exige JWT (`verify_jwt` default; valida via `getClaims`).
   - Lê URL de um Supabase secret (`MAKE_WEBHOOK_<NOME>`).
   - Encaminha o body para o Make.
3. Remover `webhook_*` URLs da tabela `configuracoes` (ou ao menos da policy anon — Fase 1 já cobre, mas mantenho aqui).
4. Trocar fetch no front para `supabase.functions.invoke('proxy-make-...')`.

**Antes de aplicar, listo: (a) arquivos front com URLs Make, (b) edge functions novas a criar, (c) nomes dos secrets.**

---

## Fase 4 — Auth nas edge functions (uma de cada vez)

**Diagnóstico primeiro** — para cada função abaixo, vou abrir o código + buscar callers (`rg` no front e em outras functions) e te apresentar uma tabela:

| Função | Caller real | Categoria | Ação proposta |
|---|---|---|---|
| `stop-twilio-flow` | (a confirmar — botão "Assumir"?) | Front operador | `verify_jwt` + check role |
| `twilio-reconcile` | (a confirmar — painel admin?) | Front admin | `verify_jwt` + check role admin |
| `auto-finalizacao` | trigger DB via `net.http_post` | Cron/DB | Shared secret header `x-internal-secret` |
| `webhook-financeiro` | (a confirmar — Make?) | Externo | Shared secret `x-make-secret` |
| `sync-google-ads` | Make | Externo | Shared secret `x-make-secret` |
| `send-recibo`, `send-nps`, `summarize-conversation`, `transcribe-audio`, `clean-description` | (a confirmar) | Provável front | `verify_jwt` |
| `check-unanswered-clients`, `monitor-mensagens` | Cron | Cron | Shared secret |
| `get-twilio-templates`, `update-prestador-idcrm`, `webhook-update-planilha` | (a confirmar) | Misto | Por caller |

**Regra inviolável:** funções chamadas direto pela Twilio (`twilio-webhook`, `twilio-status-callback`) **NÃO** recebem `verify_jwt`. Vou adicionar validação de assinatura `X-Twilio-Signature` usando `TWILIO_AUTH_TOKEN`. **Essas duas serão tratadas em PR/iteração separada e testadas com cuidado — não entram no mesmo lote.**

**Cadência:** uma função por vez. Após cada uma:
- Te aviso o que mudou.
- Você testa o fluxo correspondente (assumir chat, recibo, etc.).
- Só então passo para a próxima.

---

## Ordem de execução proposta

1. **Aprovar este plano geral** (ou ajustar fases).
2. Fase 1 → diagnóstico detalhado + sua aprovação → migração.
3. Fase 2 → diagnóstico + aprovação → migração + refactor signed URLs.
4. Fase 3 → diagnóstico + aprovação → edge functions proxy + refactor front.
5. Fase 4 → tabela de callers por função → aprovação caso a caso.

**Decisões pendentes que preciso de você:**
- (Fase 1) Considerar `admin` + `chefe` + `admin_ti` como o conjunto "admin/supervisor"? Ou criar role `supervisor` novo?
- (Fase 2) Pode haver quebra temporária se alguma automação externa depender de anon — posso prosseguir auditando cada caller antes de cada DROP?
- (Fase 4) OK em deixar `twilio-webhook` e `twilio-status-callback` para uma rodada separada, pós-Fase 4?
