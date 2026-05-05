# Mapeamento de Policies `anon` → Quem usa → Plano de fechamento

> Atualizado: 2026-05-05  
> Objetivo: documentar **antes** de qualquer migration. Cada linha mostra qual sistema externo (Make, Twilio Studio, Asaas, etc.) escreve/lê cada tabela com a chave anon, o que quebra se a policy for removida hoje, e o caminho de internalização.

## Legenda
- 🔴 **Crítico** — remover hoje quebra fluxo de receita, atendimento ou bot
- 🟡 **Médio** — remover hoje quebra função interna não crítica (relatório, log)
- 🟢 **Seguro** — pode remover agora, ninguém externo usa
- ✅ **Já internalizado** — existe edge function equivalente, anon pode ser fechado após validação

---

## 🔴 Tabelas críticas — NÃO remover anon ainda

### `fichas_de_servico` + `ficha_status_historico`
- **Quem escreve via anon:** Make.com (cenário "Criar ficha do bot") via INSERT direto; Make (cenário "Atualizar status") via UPDATE
- **Quem lê via anon:** ninguém externo — UI usa role `authenticated`
- **Quebra se remover:** bot para de criar fichas; mudança de status do Studio Flow falha
- **Internalização:**
  - INSERT → ✅ edge `criar-ficha-do-bot` (criada, aguardando Make ser repontado)
  - UPDATE status → ⚠️ falta edge `atualizar-status-ficha` (próxima prioridade)
  - histórico → trigger no banco já popula `ficha_status_historico`, mover anon para service_role
- **Ação:** repontar Make → remover anon SELECT primeiro (UI não precisa) → depois INSERT/UPDATE

### `mensagens` + `mensagens_prestadores`
- **Quem escreve via anon:** Twilio webhook (via Make antigo — ainda existe?) e provavelmente Make de sync
- **Quem lê via anon:** ninguém — UI autenticada
- **Quebra se remover:** mensagens recebidas do WhatsApp não são gravadas
- **Internalização:** ✅ `twilio-webhook`, `sync-twilio-messages`, `sync-twilio-messages-com-recuperacao`, `recover-prestador-history` já existem e usam service_role
- **Ação:** **VERIFICAR** se Make.com ainda escreve direto. Se não → remover anon imediato. Logs Twilio apontam direto pra edge `twilio-webhook`?

### `clientes`
- **Quem escreve via anon:** Make (atualização de telefone/nome do bot)
- **Quem lê via anon:** ninguém
- **Quebra se remover:** Make falha ao normalizar cliente
- **Internalização:** ✅ `criar-ficha-do-bot` já faz upsert do cliente. Falta edge dedicada `upsert-cliente` se Make ainda usar
- **Ação:** auditar cenários Make → repontar → remover anon

### `transacoes_financeiras`, `conta_corrente_prestador`, `descontos_ajustes`, `adiantamentos`
- **Quem escreve via anon:** Make (cenário "Asaas → financeiro") — provavelmente substituído por `asaas-webhook` e `webhook-financeiro`
- **Quem lê via anon:** ninguém — UI autenticada
- **Quebra se remover:** se ainda existir Make ativo, registros de pagamento não entram
- **Internalização:** ✅ edges `asaas-webhook`, `webhook-financeiro`, `reconcile-asaas-payments`, `update-pagamento` já existem
- **Ação:** **VERIFICAR LOGS Make** — se últimas execuções estão vazias/erradas, anon pode cair. Remover SELECT primeiro (zero risco).

### `bot_historico` + `bot_reactivation_schedule`
- **Quem escreve via anon:** Make/Studio Flow (registro de ações do bot, agendamento reactivation 24h/10d)
- **Quem lê via anon:** ninguém
- **Internalização:** ✅ `reactivate-bots-24h`, `process-bot-reactivation`, `toggle-bot-status` já existem e usam service_role
- **Ação:** confirmar que Studio Flow chama edges, não INSERT direto. Repontar e fechar.

### `conversa_ficha_vinculo`
- **Quem escreve via anon:** Make (vincula conversa do prestador à ficha)
- **Internalização:** falta edge — adicionar `vincular-conversa-ficha`
- **Ação:** criar edge → repontar Make → fechar anon

### `nps_respostas` + `avaliacao_prestador`
- **Quem escreve via anon:** Make (recebe resposta NPS do cliente via Twilio)
- **Internalização:** ✅ `send-nps` envia, mas **falta edge para receber** resposta. Atualmente `twilio-webhook` poderia detectar e gravar.
- **Ação:** estender `twilio-webhook` para detectar respostas NPS e gravar via service_role

### `orcamentos`
- **Quem escreve via anon:** form público de orçamento
- **Internalização:** ✅ `submit-orcamento` + `public-orcamento-data` já cobrem
- **Ação:** confirmar que form usa edges (não cliente direto). Se sim → remover anon.

### `prestadores` + `prestadores_chat` + `prestador_historico`
- **Quem escreve via anon:** Make (sync do CRM/planilha externa)
- **Internalização:** ⚠️ parcial — `update-prestador-idcrm` existe, falta `sync-prestadores`
- **Ação:** alta prioridade — dados sensíveis (CPF, PIX, banco)

### `ajustes_data_finalizacao`
- **Quem escreve via anon:** UI já é autenticada — provavelmente policy duplicada legado
- **Ação:** 🟢 **provavelmente seguro remover anon** — verificar uso no frontend

### `configuracoes`
- **Quem escreve via anon:** ⚠️ **DESCONHECIDO** — pode ser Make lendo URL de webhook
- **Ação:** auditar antes. Ler é menos crítico que escrever — fechar INSERT/UPDATE/DELETE primeiro.

---

## 🟡 Médio — provavelmente seguro, validar com 1 query

### `ficha_grupos` + `ficha_grupo_membros`
- **Uso:** vincular fichas duplicadas. UI autenticada gerencia.
- **Ação:** 🟢 verificar se algum Make agrupa fichas. Se não → remover anon.

### `ficha_coaching`
- **Quem escreve via anon:** edge `vendas-assistant` (mas usa service_role, não precisa de anon)
- **Ação:** 🟢 remover anon — service_role já cobre

### `mensagens_padronizadas`
- **Uso:** templates. UI autenticada CRUD.
- **Ação:** 🟢 manter SELECT anon talvez (templates públicos?), remover INSERT/UPDATE/DELETE anon

### `categorias`
- **Uso:** lookup interno
- **Ação:** 🟢 remover INSERT/UPDATE anon. SELECT pode ficar se algo público depende.

---

## 🟢 Seguro — remover agora

| Tabela | Motivo |
|---|---|
| `mensagens_backup`, `mensagens_backup_teste` | Backups, ninguém externo escreve |
| `notificacoes` (anon INSERT) | Notificações geradas por triggers/server, não por webhook |
| `system_logs` (anon INSERT) | Logs internos |
| `conversa_operador_leitura` (anon ALL) | Apenas UI autenticada |
| `daily_goals` (anon SELECT) | Métricas internas |
| `avisos` (anon SELECT) | Comunicação interna |
| `google_ads_metrics` (anon SELECT) | Make usa service_role no edge `sync-google-ads` |

---

## Realtime (`realtime.messages`)
- **Problema:** qualquer authenticated subscreve qualquer canal
- **Solução:** RLS policy em `realtime.messages` filtrando por `auth.uid()` ou claims JWT
- **Risco de quebra:** alto — todos os hooks de realtime do frontend dependem disso
- **Ação:** fase separada — testar em staging primeiro

---

## Plano de execução proposto (3 fases)

### Fase 1 — Quick wins (sem risco)
Remover anon das tabelas 🟢 acima. Reduz ~7-8 findings de uma vez sem quebrar nada.

### Fase 2 — Auditoria Make
1. Listar cenários Make.com ativos
2. Para cada um: verificar última execução bem-sucedida e se a edge equivalente já existe
3. Repontar Make → edge function (ou desativar cenário)
4. Após 7 dias rodando paralelo sem divergência → remover anon

### Fase 3 — Internalizações pendentes
Criar edges faltantes:
- `atualizar-status-ficha`
- `vincular-conversa-ficha`
- `sync-prestadores`
- `upsert-cliente` (se Make ainda usar)
- Estender `twilio-webhook` para NPS

### Fase 4 — Realtime hardening
RLS em `realtime.messages` com testes de regressão no chat.
