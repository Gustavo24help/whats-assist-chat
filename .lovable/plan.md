## Matriz revisada — escritas por operador `user`

Auditoria feita em `src/**` (`.from('<tabela>').(insert|update|delete|upsert)`):

| Tabela | Lê (front) | Escreve (front) | Componentes que escrevem | Política proposta |
|---|---|---|---|---|
| `contas_pagar_manual` | operador | **operador** | `NovoLancamentoManualDialog` (INSERT), `PagamentoPrestadoresTabV2` (UPDATE pago/cancelado/pendente) | SELECT/INSERT/UPDATE → authenticated; DELETE → 4 papéis |
| `contas_receber` | operador | **operador** | `ContasReceber` (UPDATE pago/cancelado), `PagamentosOrfaos` (UPDATE), `PagamentoClientesTab` (UPDATE) | SELECT/INSERT/UPDATE → authenticated; DELETE → 4 papéis |
| `transacoes_financeiras` | operador + anon (portal) | **operador** | `PopupConfirmacaoFinanceira` (INSERT), `PagamentoPrestadoresTabV2` (INSERT/UPDATE), `AjustarDataFinalizacaoDialog` (UPDATE), `TrocaPrestadorPagamentoDialog` (INSERT/UPDATE), `PagamentoClientesTab` (UPDATE), `ContasReceber`/`PagamentosOrfaos` (UPDATE) | SELECT → authenticated + **anon (dívida)**; INSERT/UPDATE → authenticated; DELETE → 4 papéis |
| `conta_corrente_prestador` | operador + anon (portal) | **operador** | `PopupConfirmacaoFinanceira` (INSERT) | SELECT → authenticated + **anon (dívida)**; INSERT/UPDATE → authenticated; DELETE → 4 papéis |
| `adiantamentos` | operador | **operador** | `NovoAdiantamentoDialog` (INSERT), `PopupConfirmacaoFinanceira` (UPDATE consumo) | SELECT/INSERT/UPDATE → authenticated; DELETE → 4 papéis |
| `ajustes_data_finalizacao` | back-office | **operador** | `AjustarDataFinalizacaoDialog` (INSERT) — usado no fluxo de finalização da ficha | SELECT/INSERT/UPDATE → authenticated; DELETE → 4 papéis |
| `descontos_ajustes` | back-office | — | **nenhum componente front escreve** (confirmado por `rg`) | **Lock total: FOR ALL → 4 papéis** |
| `pagamento_webhook_log` | back-office (`PagamentoWebhookLogsViewer`) | — | só edges escrevem | **Lock total leitura: SELECT → 4 papéis** (INSERT continua só service_role / sem policy) |

**Tabelas com lock total nos 4 papéis (FOR ALL):** apenas `descontos_ajustes` e `pagamento_webhook_log`.

### Confirmação edge functions (todas usam `SERVICE_ROLE_KEY`)

Verificado via `rg "SERVICE_ROLE" supabase/functions/`:

- `webhook-financeiro` ✅ (linha 39)
- `asaas-webhook` ✅ (linha 325) — registra pagamento automático
- `auto-finalizacao` ✅ (linha 43) — gera link e atualiza contas_receber/transacoes
- `processar-pagamento` ✅ (linha 36)
- `reconcile-asaas-payments` ✅ (linha 28)
- `_shared/pagamentoLogger.ts` ✅ (recebe client service_role do caller)

→ **REVOKE anon não quebra fluxo automático de pagamento.**

### Role `financeiro`

- Continua sendo criada na Migração A (`ALTER TYPE app_role ADD VALUE 'financeiro'`).
- Função: gate das **telas** de back-office no front (`/contas-pagar`, `/financeiro`, `/planilha-controle-pagamentos`, `/planilha-controle-financeiro`, `/pagamentos-orfaos`, `/logs-pagamento`) e do **DELETE** no banco.
- O gate de tela é mudança de front (ProtectedRoute / sidebar) — **fica para uma fase posterior**, não entra nesta migração de RLS.

### Migração A (enum)

```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro';
```

### Migração B (policies) — padrão por categoria

**Categoria 1 (6 tabelas operacionais):** `contas_pagar_manual`, `contas_receber`, `transacoes_financeiras`, `conta_corrente_prestador`, `adiantamentos`, `ajustes_data_finalizacao`

Para cada uma:
1. DROP de todas as policies anon existentes.
2. REVOKE ALL FROM anon (exceto SELECT em `transacoes_financeiras` e `conta_corrente_prestador` — mantém GRANT SELECT anon + policy anon SELECT como dívida do Portal do Prestador, com TODO marcado).
3. GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated; GRANT ALL TO service_role.
4. Policies novas:
   - `SELECT` → `authenticated` (USING true)
   - `INSERT` → `authenticated` (WITH CHECK true)
   - `UPDATE` → `authenticated` (USING true WITH CHECK true)
   - `DELETE` → `authenticated` AND (`has_role(uid,'admin')` OR `chefe` OR `admin_ti` OR `financeiro`)

**Categoria 2 (lock total):** `descontos_ajustes`
1. DROP policies anon, REVOKE anon.
2. GRANT ALL TO service_role; GRANT SELECT,INSERT,UPDATE,DELETE TO authenticated.
3. Policy única `FOR ALL TO authenticated USING (has_role(...4 papéis...)) WITH CHECK (mesma)`.

**Categoria 3 (log de webhook):** `pagamento_webhook_log`
1. Policy SELECT restrita aos 4 papéis (substitui a atual com `supervisor`).
2. Sem policy INSERT/UPDATE/DELETE (só service_role escreve, bypass RLS).

### Ordem de execução

1. Você aprova esta matriz.
2. Eu chamo `supabase--migration` com a **Migração A** (enum).
3. Após approval do Postgres, chamo `supabase--migration` com a **Migração B** completa (todas as 8 tabelas).
4. Você testa: operador comum criando lançamento manual, marcando pagamento, novo adiantamento, ajuste de data — e Portal do Prestador continua abrindo.

**Riscos zero esperados:**
- Operador `user` mantém todas as escritas que já fazia hoje (estavam liberadas para `authenticated`).
- Edges com service_role continuam funcionando.
- Portal do Prestador (anon) continua lendo `transacoes_financeiras` e `conta_corrente_prestador`.
- Único impacto: anon perde escrita (que nunca deveria ter tido) e operador comum perde DELETE em financeiro (que provavelmente nunca usou pela UI).

Aprovo a matriz e rodo as duas migrações?