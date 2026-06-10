## Problema 1 — Ficha falha ao salvar / mudar status

### Causa raiz
A migração de hardening de segurança (`20260609215336`) ativou RLS em `bot_snooze_rules` adicionando **apenas** policy de `SELECT` para `authenticated`. Mas a tabela `fichas_de_servico` tem um trigger `set_bot_snooze_on_ficha_status` (`trg_set_bot_snooze`) que chama `recompute_bot_snooze(...)`, e essa função faz `INSERT/UPDATE/DELETE` em `bot_snooze_rules`.

Como nem `trg_set_bot_snooze` nem `recompute_bot_snooze` são `SECURITY DEFINER`, qualquer `UPDATE` em `fichas_de_servico` feito por usuário `authenticated` ou `anon` agora bate em RLS de `bot_snooze_rules` → trigger falha → save da ficha falha com toast genérico. Mesmo cenário com `bot_config` se algum gatilho ler/escrever ali.

### Correção (migration única, sem alterar dados)
1. `ALTER FUNCTION public.recompute_bot_snooze(...) SECURITY DEFINER SET search_path = public;`
2. `ALTER FUNCTION public.trg_set_bot_snooze() SECURITY DEFINER SET search_path = public;` (defesa em profundidade)
3. Manter as policies de SELECT já criadas em `bot_config` e `bot_snooze_rules` (continuam restringindo leitura/escrita direta pelo cliente). Service role e funções `SECURITY DEFINER` continuam podendo escrever — que é o comportamento desejado.

Nenhum dado de ficha, agendamento ou status é alterado. Só muda o owner de execução das funções de trigger.

## Problema 2 — Cursor sai da barra ao apertar Enter

### Causa raiz
Em `ChatWindow.tsx` (linha 3115) e `ChatWindowBeta.tsx` (linha equivalente), a Textarea tem `disabled={... || isSending || uploading}`. Quando o operador aperta Enter:
- `enviarMensagem` seta `isSending=true` → React aplica `disabled=true` no elemento focado → o browser **força blur**.
- Quando `isSending` volta a `false`, o textarea reabilita mas o foco já foi perdido.

### Correção (frontend, mínima)
Nos dois componentes:
1. Remover `isSending || uploading` da prop `disabled` da `Textarea` (mantém `statusConversa === "fechada" || !!pendingFile`). O botão Enviar continua bloqueado por `isSending/uploading`, então não há envio duplo.
2. Como cinto-e-suspensório, após `enviarMensagem` resolver, fazer `textareaRef.current?.focus()` num `finally`.

Não muda nenhum fluxo de envio, anti-duplicação (`isSendingRef.current`) ou exibição de mensagens.

## Arquivos a tocar
- nova migration `supabase/migrations/<timestamp>_fix_bot_snooze_trigger_secdef.sql`
- `src/components/ChatWindow.tsx` (disabled da Textarea + refocus no enviarMensagem)
- `src/components/ChatWindowBeta.tsx` (idem)

## Salvaguardas
- Migration só altera atributo `SECURITY DEFINER` de 2 funções; não toca tabelas, dados ou policies de leitura.
- Mudança no Textarea preserva todas as travas anti-envio-duplo (`isSendingRef`, botão Enviar `disabled`).
- Sem impacto em timezones, valores, agendamentos ou histórico de status.