Plano final, simplificado e com os ajustes que você pediu.

## 1. Função central — `toggle-bot-status`

Refatorar `supabase/functions/toggle-bot-status/index.ts`:

- Aceita parâmetros novos (mantendo compatibilidade com os atuais):
  - `requested_action`: `enable_bot` | `disable_bot`
  - `requested_origin`: `manual` | `automatico` | `sistema` | `pre_qualificacao` | `template` | `cron`
  - `trigger_source`: `manual_button` | `manual_template_button` | `system_template` | `automatic_template` | `pre_qualificacao_finalizada` | `cron` | `webhook`
  - `executed_by_user_id` (opcional)
  - `confirmation` (mantém o `LIGAR` atual, sem nova complexidade)
  - `request_id`, `template_name`
- Regra de origem rigorosa:
  - Só vira `manual` quando `requested_origin = manual` E `trigger_source ∈ { manual_button, manual_template_button }`.
  - JWT presente sozinho NÃO transforma em manual — serve apenas para preencher `executed_by_user_id`.
- Decisões de estado:
  - `disable_bot` manual: `bot_habilitado=false`, `bot_desligado_manualmente=true`, `data_bot_desabilitado=now()`.
  - `disable_bot` automático/sistema/template/pre_qualificacao: `bot_habilitado=false`, NÃO toca em `bot_desligado_manualmente` (preserva), `data_bot_desabilitado=now()`.
  - `enable_bot` manual: `bot_habilitado=true`, `bot_desligado_manualmente=false`. Mantém confirmação `LIGAR`.
  - `enable_bot` automático/cron: `bot_habilitado=true`, NÃO altera `bot_desligado_manualmente`. Sem checagem de `atendente_id`.
- **Detecção e log de incoerência (ajuste seu nº 1):** Após qualquer `enable_bot` automático/cron, se o estado final ficar `bot_habilitado=true` E `bot_desligado_manualmente=true`, registrar:
  - `bot_historico.observacao`: `"INCOERENCIA: bot religado por cron sem limpar trava manual antiga"`
  - `system_logs` com `severity=warning`, `event=bot_state_incoherent`, `phone`, `previous_state`, `new_state`, `trigger_source`.
  - Isso não bloqueia a operação — só fica visível para revisarmos depois a utilidade do campo `bot_desligado_manualmente`.
- Auditoria completa em `bot_historico` + `system_logs`: `requested_action`, `resolved_action`, `requested_origin`, `resolved_origin`, `trigger_source`, `executed_by_user_id`, `previous_bot_enabled`, `new_bot_enabled`, `previous_manual_lock`, `new_manual_lock`, `template_name`, `request_id`, `incoherent_state` (bool).
- **Nada de checar `atendente_id` para liberar/bloquear ligar/desligar bot.**

## 2. `stop-twilio-flow` e fim da pré-qualificação

Em `supabase/functions/stop-twilio-flow/index.ts`:

- Parar de inferir `manual` a partir de JWT.
- Aceitar `requested_origin` e `trigger_source` no body.
- Sem esses campos, tratar como automático.
- Não atualizar `clientes.bot_*` direto — delegar tudo à função central.
- Quando o webhook indicar fim da pré-qualificação, chamar central com:
  - `requested_action=disable_bot`
  - `requested_origin=pre_qualificacao`
  - `trigger_source=pre_qualificacao_finalizada`
- Resultado: bot desliga sem criar trava manual, sem depender de `atendente_id`, sem nova `conversation_id`.

## 3. Reativações automáticas

`reactivate-bots-24h` e `process-bot-reactivation`:

- Remover update direto em `clientes.bot_habilitado`.
- Chamar central com `requested_action=enable_bot`, `requested_origin=automatico`, `trigger_source=cron`.
- Sem checagem de `atendente_id`.
- Manter as janelas existentes (10 dias Agendado/Visita, 24h, etc.) iguais ao que está hoje.
- Novas regras (Finalizado/Garantia 1 dia, Perdido) **NÃO** entram agora — ficam para plano dedicado, configurável e auditável, conforme você pediu.

## 4. Segunda checagem antes da IA responder

Em `supabase/functions/send-whatsapp/index.ts`:

- Antes de qualquer envio com `remetente='bot'`, reconsultar `clientes.bot_habilitado` no banco.
- Bloquear se `false`.
- Logar `blocked_before_send=true`, `block_reason='bot_disabled'`, telefone, `request_id`.
- **Sem** checar `atendente_id` ou atendimento humano agora.

## 5. Checkbox por template (ajuste seu nº 2)

Schema:

- Migração de schema: `ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS disable_bot_on_send boolean NOT NULL DEFAULT false;`
- Migração de dados (separada e explícita), conforme impacto já mostrado:
  - `UPDATE whatsapp_templates SET disable_bot_on_send = true WHERE desliga_bot = true;`
  - 6 templates afetados: `aviso_pagamento_3`, `cobranca_cliente_2`, `novas_informacoes_cliente`, `novo_orcamento_2`, `nps_avaliacao`, `recibo_confirmado`.
  - 2 templates ficam `false`: `april_fishery_1`, `april_fishery_2`.

UI (`src/components/TemplateManagement.tsx`):

- Substituir a coluna “Desliga bot” por um checkbox “Desligar bot ao enviar este template”, controlando `disable_bot_on_send`.
- Tooltip: “Quando marcado, o bot será desligado automaticamente na conversa após o envio deste template.”
- A UI escreve apenas `disable_bot_on_send`. `desliga_bot` fica como legado, sem ser editado na UI.

Envio (`AbrirConversaDialog.tsx`, `NovaConversaDialog.tsx`, `send-template`):

- Carregar `disable_bot_on_send` do template.
- Resolução: `disable_bot_on_send ?? desliga_bot ?? false` (após a migração explícita acima, o fallback praticamente nunca dispara; default seguro = `false`).
- Se `true` E envio for de operador: chamar central com `requested_action=disable_bot`, `requested_origin=template`, `trigger_source=manual_template_button`.
- Se `true` E envio for automatizado: `requested_origin=template`, `trigger_source=system_template` ou `automatic_template`.
- Se `false`: **não** chamar central, **não** alterar bot.
- Template **nunca** liga bot.
- Template **nunca** apaga histórico.
- Template **nunca** cria `conversation_id` nova — auditar `send-template` para confirmar que só insere mensagem na conversa existente (hoje já faz; vou apenas preservar).
- **Sem regra extra de “trava manual por template”** — o estado resultante depende apenas da função central conforme item 1.

## 6. Botões da interface

`src/components/ChatWindow.tsx` e `src/components/ChatWindowBeta.tsx`:

- “Desligar bot”: `requested_action=disable_bot`, `requested_origin=manual`, `trigger_source=manual_button`.
- “Ligar bot/Reativar bot”: `requested_action=enable_bot`, `requested_origin=manual`, `trigger_source=manual_button`. Mantém confirmação `LIGAR` que já existe.
- Toasts só após confirmação do backend.

## 7. O que NÃO muda agora

- `atendente_id`, `atribuicao_cadeia`, `useLogoutRedistribution`, `ConversationList(Beta)` — nenhuma mudança.
- Nenhuma regra nova de reativação por status de ficha — fica para plano dedicado.
- Nenhuma alteração em mensagens antigas, fichas, valores financeiros, horários, histórico.
- Nenhum update em massa em `bot_historico`.
- Campo `bot_desligado_manualmente` continua existindo. **Nesta fase ele NÃO bloqueia a IA** (a IA só olha `bot_habilitado`). Discutimos a utilidade dele depois, com base nos logs de incoerência do item 1.

## 8. Validação pós-deploy

1. Operador clica “Desligar bot” → bot desliga, `bot_desligado_manualmente=true`.
2. Operador clica “Ligar bot” + confirma `LIGAR` → bot liga, `bot_desligado_manualmente=false`.
3. Pré-qualificação finaliza → bot desliga com origem `pre_qualificacao_finalizada`, sem nova trava manual.
4. `stop-twilio-flow` chamado sem `manual_button` → registra automático, não vira manual.
5. Cron reativa em conversa que estava com `bot_desligado_manualmente=true` → bot liga, trava antiga preservada, log de incoerência gerado.
6. IA tenta responder com `bot_habilitado=false` → bloqueada e logada.
7. Template com `disable_bot_on_send=false` → envio não toca no bot.
8. Template com `disable_bot_on_send=true` → envio desliga bot, sem criar conversa nova, sem apagar histórico.
9. Templates existentes migrados → comportamento idêntico ao atual (6 desligam, 2 não).
10. Template novo criado → default `false`, não desliga bot até marcarem o checkbox.

Pode implementar exatamente esse plano.

Apenas reforçando a regra principal:

Nesta fase, a IA/bot deve obedecer somente ao campo bot_habilitado.

- bot_habilitado = true → bot pode responder.

- bot_habilitado = false → bot não pode responder.

Não usar atendente_id, atendimento humano ou bot_desligado_manualmente para bloquear a IA neste momento.

O campo bot_desligado_manualmente continua existindo apenas como controle/auditoria legado nesta etapa. Se ficar bot_habilitado=true e bot_desligado_manualmente=true após cron, apenas registrar warning/incoerência, como você descreveu, sem bloquear o funcionamento.

Pode seguir.

&nbsp;