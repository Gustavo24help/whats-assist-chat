# Mapeamento de Policies `anon` — snapshot real do banco

> Atualizado: 2026-05-06 (snapshot direto do `pg_policies`)
> 64 policies `anon` ativas em 24 tabelas

## Snapshot atual (verificado via SQL)

| Tabela | # policies anon | Operações |
|---|---|---|
| `adiantamentos` | 3 | SELECT, INSERT, UPDATE |
| `ajustes_data_finalizacao` | 2 | SELECT, INSERT |
| `avaliacao_prestador` | 3 | SELECT, INSERT, UPDATE |
| `bot_historico` | 2 | SELECT, INSERT |
| `bot_reactivation_schedule` | 3 | SELECT, INSERT, UPDATE |
| `categorias` | 1 | SELECT |
| `configuracoes` | 4 | SELECT, INSERT, UPDATE, DELETE |
| `conta_corrente_prestador` | 3 | SELECT, INSERT, UPDATE |
| `conversa_ficha_vinculo` | 3 | SELECT, INSERT, UPDATE |
| `descontos_ajustes` | 3 | SELECT, INSERT, UPDATE |
| `ficha_grupo_membros` | 1 | ALL |
| `ficha_grupos` | 1 | ALL |
| `ficha_status_historico` | 3 | SELECT, INSERT, UPDATE |
| `fichas_de_servico` | 3 | SELECT, INSERT, UPDATE |
| `mensagens` | 3 | SELECT, INSERT, UPDATE |
| `mensagens_padronizadas` | 4 | SELECT, INSERT, UPDATE, DELETE |
| `mensagens_prestadores` | 3 | SELECT, INSERT, UPDATE |
| `nps_respostas` | 3 | SELECT, INSERT, UPDATE |
| `orcamentos` | 3 | SELECT, INSERT, UPDATE |
| `prestador_historico` | 2 | SELECT, INSERT |
| `prestadores` | 4 | SELECT, INSERT, UPDATE, DELETE |
| `prestadores_chat` | 3 | SELECT, INSERT, UPDATE |
| `system_logs` | 1 | INSERT (anon+authenticated) |
| `transacoes_financeiras` | 3 | SELECT, INSERT, UPDATE |

**Total: 64 policies / 24 tabelas**

---

## Plano de fechamento por fase

### 🟢 Fase 1 — Quick wins (zero risco)

Estas tabelas **não são escritas por Make.com / Twilio / Asaas** ou têm edge function equivalente já em produção. Podem ser fechadas hoje.

| Tabela | Ação |
|---|---|
| `mensagens_padronizadas` | manter SELECT anon (templates podem ser públicos), remover INSERT/UPDATE/DELETE |
| `categorias` | manter SELECT, remover escrita |
| `system_logs` | já restrito a INSERT, manter |
| `ajustes_data_finalizacao` | UI autenticada — remover ambas |
| `ficha_grupos` + `ficha_grupo_membros` | UI autenticada — remover ALL |
| `bot_reactivation_schedule` | edge `process-bot-reactivation` usa service_role — remover anon |

### 🟡 Fase 2 — Auditoria Make (validar antes)

Tabelas que **podem** ainda ter Make legado escrevendo. Antes de remover anon, validar nos logs do Make que não há cenário ativo.

- `fichas_de_servico` + `ficha_status_historico` — bot cria via `criar-ficha-do-bot` (já existe), mas Make pode escrever direto
- `mensagens` + `mensagens_prestadores` — Twilio webhook é `twilio-webhook` (existe), mas confirmar que não há Make sync paralelo
- `transacoes_financeiras` + `conta_corrente_prestador` + `descontos_ajustes` + `adiantamentos` — financeiro tem `asaas-webhook` + `webhook-financeiro`
- `prestadores` + `prestadores_chat` + `prestador_historico` — sync de CRM externo
- `bot_historico` — Studio Flow registra ações
- `configuracoes` — pode ser lida por Make
- `nps_respostas` + `avaliacao_prestador` — resposta NPS via Twilio
- `orcamentos` — form público (já tem `submit-orcamento` + `public-orcamento-data`)
- `conversa_ficha_vinculo` — Make vincula

### 🔴 Fase 3 — Internalizações pendentes (criar edge antes de fechar)

- `atualizar-status-ficha` (substituir UPDATE direto do Make)
- `vincular-conversa-ficha`
- `upsert-cliente`
- `sync-prestadores`
- estender `twilio-webhook` para detectar resposta NPS

### Fase 4 — Realtime
RLS em `realtime.messages` filtrando por claims JWT. Alto risco de quebra — testar em staging.

---

## Notas importantes (validações feitas em 2026-05-06)

- ✅ `webhook-update-planilha` **NUNCA foi chamada** (zero logs). Confirma que o erro `Last_Name` do Zoho vem 100% da Mailhook externa (`ngap9o3fy5p9...@hook.us2.make.com`), NÃO do nosso sistema.
- ✅ `criar-ficha-do-bot` já existe e cobre INSERT em `fichas_de_servico` para o bot.
- ⚠️ Antes de Fase 2, **listar cenários ativos no Make.com** e cruzar com edges existentes. Sem essa lista, qualquer fechamento é arriscado.
