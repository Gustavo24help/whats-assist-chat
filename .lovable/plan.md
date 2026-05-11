
## Objetivo

Criar uma tela de histórico que mostra, em ordem cronológica, **tudo que entra no sistema relacionado a links de pagamento** — tanto a criação/recebimento do link (vindo do Make → `update-pagamento`) quanto as confirmações de pagamento (vindas do webhook do Asaas).

## O que já existe vs. o que falta

| Origem | Tabela | Hoje | Ação |
|---|---|---|---|
| Webhook Asaas (PAYMENT_CONFIRMED, PAYMENT_RECEIVED, etc.) | `automation_audit` (etapa=`webhook_pagamento`) | ✅ 122 registros desde 14/04 | Apenas mostrar |
| Reconciliação Asaas manual | `automation_audit` (etapa=`reconcile_asaas`) | ✅ 20 registros | Apenas mostrar |
| Link de pagamento gravado pelo Make (`update-pagamento`) | nenhuma | ❌ Só `console.log` da edge | **Criar log** |
| Link gerado por nós (`create-payment-link`) | nenhuma estruturada | ❌ Só `console.log` | **Criar log** |

## Mudanças

### 1. Nova tabela `pagamento_webhook_log` (migration)

```text
id              uuid PK
created_at      timestamptz
direcao         text  -- 'recebido' | 'enviado'
origem          text  -- 'make_update_pagamento' | 'asaas_webhook' | 'create_payment_link' | 'reconcile_asaas'
ficha_id        text  (nullable)
evento          text  -- ex: 'PAYMENT_CONFIRMED', 'link_atualizado', 'link_criado'
status          text  -- 'success' | 'error' | 'ignored'
pagamento_link  text  (nullable)
valor           numeric (nullable)
auth_source     text  -- 'make' | 'user' | 'asaas' | 'service'
payload         jsonb -- corpo bruto recebido/enviado (truncado se grande)
resposta        jsonb -- resposta enviada/recebida
duracao_ms      integer
erro            text  (nullable)
```

RLS: leitura para `authenticated` (admins/supervisores), insert para `service_role`.

### 2. Instrumentar edge functions para gravar nessa tabela

- `supabase/functions/update-pagamento/index.ts` — gravar entrada (payload, ficha_id, link, auth_source) e saída (sucesso/erro, duração).
- `supabase/functions/asaas-webhook/index.ts` — espelhar para `pagamento_webhook_log` (hoje só vai em `automation_audit`).
- `supabase/functions/create-payment-link/index.ts` — gravar criação de link.
- `supabase/functions/reconcile-asaas-payments/index.ts` — gravar resultado da reconciliação.

Comportamento "fail-safe": qualquer erro de log NÃO interrompe o fluxo principal.

### 3. Backfill (sem perda)

Script de migração que copia o que já existe em `automation_audit` (etapas `webhook_pagamento` e `reconcile_asaas`) para `pagamento_webhook_log` — assim a tela já abre com 142 registros históricos. **Nada é apagado** de `automation_audit`.

### 4. Nova página `Manutenção → Logs de Pagamento`

Rota: `/manutencao/logs-pagamento` (acessível só para admin).

UI:
- Filtros: período (default últimos 7 dias), origem, status, ficha_id, telefone do cliente.
- Lista paginada (50 por página) com colunas: data/hora, origem, ficha, evento, status, valor, link.
- Drawer ao clicar na linha: payload completo (JSON pretty), resposta, erro, duração, auth_source.
- Botão "Copiar JSON" e "Abrir ficha".
- Badge colorido por status (verde/amarelo/vermelho) e por origem.

Adicionar entrada na aba **Manutenção → Ferramentas** chamada "Logs de Pagamento".

## Riscos e cuidados

- **Não alterar comportamento atual** do Make ou do Asaas: log é só observação lateral.
- **Sigilo**: payload pode conter CPF/telefone — RLS restringe a admin/supervisor.
- **Tamanho do payload**: truncar campos > 10 KB para evitar bloat.
- **Compatibilidade**: `automation_audit` continua sendo escrita (não removemos lógica existente), só duplicamos para a nova tabela enriquecida.

## Detalhes técnicos (ref)

- Helper compartilhado em `supabase/functions/_shared/pagamentoLogger.ts` com função `logPagamentoWebhook(supabase, entry)` para padronizar os inserts.
- Frontend: novo hook `usePagamentoWebhookLogs` com `fetchAllPaginated`, componente `PagamentoWebhookLogsViewer` similar ao já existente `SystemLogsViewer`.

## Resultado esperado

Você abre **Manutenção → Logs de Pagamento**, filtra por 18/03/2026 (ou qualquer dia futuro), e vê cada chamada que o Make fez para nos passar o link, cada confirmação do Asaas, com payload, status e duração — clicando em qualquer linha vê o JSON cru.
