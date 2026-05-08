## Diagnóstico rápido

O problema está claro: hoje os crons `reactivate-bots-24h` e `process-bot-reactivation` chamam `toggle-bot-status` com `enable_bot` automaticamente. Pior: `toggle-bot-status` permite religar mesmo quando `bot_desligado_manualmente=true`, apenas registrando “incoerência”. Isso já aconteceu nos logs: o bot foi religado por cron mantendo a trava manual.

## Plano de correção urgente

1. **Bloquear reativação automática quando houver trava manual**
   - Alterar `toggle-bot-status` para recusar qualquer `enable_bot` automático/cron quando `bot_desligado_manualmente=true`.
   - Retornar sucesso com `skipped: true` e motivo `manual_lock`, sem ligar o bot.
   - Registrar em `bot_historico` e `system_logs` que a reativação foi bloqueada.

2. **Endurecer os crons de reativação**
   - Em `reactivate-bots-24h` e `process-bot-reactivation`, antes de chamar `toggle-bot-status`, consultar o cliente.
   - Se `bot_desligado_manualmente=true` ou houver `atendente_id`, não religar.
   - Marcar o agendamento como executado para não tentar de novo em loop.
   - Registrar observação clara: “reativação ignorada por trava manual/atendente”.

3. **Criar proteção imediata no banco**
   - Rodar uma atualização pontual para marcar como executados os agendamentos pendentes de clientes com `bot_desligado_manualmente=true` ou `atendente_id` preenchido.
   - Isso não altera mensagens, fichas, datas, valores ou histórico operacional; apenas impede reativações futuras já agendadas.

4. **Corrigir a proteção fail-closed do envio**
   - Revisar o fluxo de envio automático: `send-whatsapp` só bloqueia quando o caller marca explicitamente `tipo_remetente='bot'` ou `remetente='bot'`.
   - Garantir que envios de automação/bot passem com essa marcação ou sejam bloqueados quando o cliente está com `bot_habilitado=false`.
   - Não bloquear mensagens manuais de operador autenticado.

5. **Deploy e validação**
   - Deploy das funções alteradas.
   - Testar: tentar religar via cron/automático um cliente com trava manual deve ser ignorado.
   - Confirmar no banco que `whatsapp:+554188915521` continua `bot_habilitado=false`.
   - Conferir logs para garantir que não houve nova ativação automática.