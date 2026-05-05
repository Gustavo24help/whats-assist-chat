# Fase 1 — Remover anon das tabelas seguras

Remover policies `anon` de tabelas que **nenhum sistema externo** (Make, Twilio, Asaas) escreve/lê. Reduz ~8 findings de uma vez sem quebrar nada.

## Tabelas alvo e policies a remover

| Tabela | Policies anon a dropar | Motivo |
|---|---|---|
| `mensagens_backup` | SELECT anon | Backup interno, ninguém externo lê |
| `mensagens_backup_teste` | SELECT anon | Backup interno |
| `notificacoes` | INSERT anon | Notificações geradas por triggers/edges (service_role) |
| `system_logs` | INSERT anon (manter authenticated) | Logs internos do app autenticado |
| `conversa_operador_leitura` | ALL anon (`anon_full_access_conversa_leitura`) | Apenas UI autenticada usa |
| `daily_goals` | SELECT anon (`Anon pode ver daily_goals`) | Métricas internas |
| `avisos` | SELECT anon (`Anon pode ver avisos`) | Comunicação interna autenticada |
| `google_ads_metrics` | SELECT anon (`Anon pode ver google_ads`) | Make usa service_role no edge `sync-google-ads` |
| `ficha_coaching` | ALL anon (`anon_full_access_coaching`) | Edge `vendas-assistant` usa service_role |
| `categorias` | INSERT anon, UPDATE anon (manter SELECT por enquanto) | Lookup, escrita só admin via UI |
| `mensagens_padronizadas` | INSERT/UPDATE/DELETE anon (manter SELECT) | Templates editados só por UI |

Total: ~11 tabelas, ~17 policies removidas, **8+ findings resolvidos**.

## Salvaguardas

- **Não removo** policies `authenticated` ou `service_role` — só as `anon`.
- **Não toco** em tabelas usadas por Make/Twilio/Asaas (fichas, mensagens, transacoes, bot_historico, etc.) — Fase 2/3.
- **Não altero** dados, apenas RLS.
- Após migration, verificar console do app por erros 401/403 no preview.

## Detalhes técnicos

Single migration SQL com `DROP POLICY IF EXISTS` para cada policy listada. Idempotente.

Após aplicar:
1. Marcar findings como `fixed` via `manage_security_finding`:
   - `mensagens_backup_anon_readable`
   - `notificacoes_anon_insert`
   - `system_logs_anon_insert`
   - `conversa_operador_leitura_anon_full_access`
   - `daily_goals_anon_readable`
   - `avisos_anon_readable`
   - `google_ads_metrics_anon_readable`
   - `ficha_coaching_anon_full_access`
   - `categorias_anon_write_access` (parcial — SELECT anon mantido temporariamente; se quiser zerar, removo SELECT também)

2. Atualizar `.lovable/anon-policies-map.md` marcando estas como ✅ fechadas.

## O que NÃO entra nesta fase

- `fichas_de_servico`, `mensagens`, `mensagens_prestadores`, `transacoes_financeiras`, `clientes`, `prestadores*`, `bot_historico`, `bot_reactivation_schedule`, `conversa_ficha_vinculo`, `nps_respostas`, `avaliacao_prestador`, `orcamentos`, `configuracoes`, `adiantamentos`, `descontos_ajustes`, `conta_corrente_prestador`, `ajustes_data_finalizacao`, `ficha_status_historico`, `ficha_grupos*` → Fase 2 (auditoria Make) e Fase 3 (criar edges faltantes).
- `realtime.messages` → Fase 4.
