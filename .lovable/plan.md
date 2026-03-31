

## Diagnóstico do Bug

### O que aconteceu com o telefone 4196580655

1. **17/03** — Bot desativado automaticamente (Twilio handoff)
2. **23/03 13:35** — Bot desativado manualmente pelo operador
3. **23/03 17:07** — Ficha `FGM5@260317` mudou para **"Perdido"**
4. **23/03 17:07** — Trigger `schedule_bot_reactivation` criou agendamento para **24/03 17:07** (24h depois) — correto
5. **24/03 a 31/03** — **Ninguém processou o agendamento** → bot ficou desativado por 8 dias

### Causa raiz

O cron job `reactivate-bots-every-5min` chama a função `reactivate-bots-24h`, mas essa função **foi desativada** (retorna sem fazer nada). A função correta que processa os agendamentos é `process-bot-reactivation`, porém **não existe nenhum cron job chamando ela**.

Resumindo: a trigger cria o agendamento no banco, mas nenhum processo periódico executa os agendamentos pendentes.

### Outros agendamentos pendentes

O registro `scheduled_at: 2026-03-24` com `executed: false` confirma que há agendamentos acumulados sem processar.

---

## Plano de Correção

### 1. Atualizar `reactivate-bots-24h` para chamar `process-bot-reactivation`

Em vez de criar um novo cron job (o que exigiria uma migration), a solução mais simples é fazer a função `reactivate-bots-24h` (que já tem cron a cada 5 min) chamar internamente a lógica de `process-bot-reactivation` — ou seja, mover o código de processamento dos agendamentos para dentro dela.

A função passará a:
- Buscar registros em `bot_reactivation_schedule` onde `executed = false` e `scheduled_at <= now()`
- Reativar o bot de cada cliente
- Registrar no `bot_historico`
- Marcar o agendamento como `executed = true`

### 2. Processar agendamentos pendentes agora

Após o deploy, a próxima execução do cron (em até 5 min) vai processar automaticamente o agendamento pendente do telefone 4196580655 e qualquer outro acumulado.

### Arquivos modificados
- `supabase/functions/reactivate-bots-24h/index.ts` — reativar com a lógica de processamento de agendamentos

