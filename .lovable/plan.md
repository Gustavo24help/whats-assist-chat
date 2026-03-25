

# Fix: Bot messages showing as "Atendente (não identificado)"

## Problem

Bot messages sent via the Twilio flow have `remetente = 'whatsapp:+554138911555'` (the 24help number), `tipo_remetente = NULL`, `operador_nome = NULL`, and `enviado_por_id = NULL`. The current rendering logic checks `tipo_remetente === 'bot'` or `remetente === 'bot'`, but neither matches for these messages. They fall through all conditions and render with no badge (or the user sees them as unidentified operators).

Similarly, **template messages** saved by `send-template` edge function set `remetente: 'atendente'` but do NOT set `tipo_remetente` or `operador_nome`, so even when sent by a known operator, the attribution may be lost.

### Root causes:
1. **Old messages in DB** have `tipo_remetente = NULL` — the webhook only started setting this field recently
2. **send-template function** doesn't save `tipo_remetente` or `operador_nome`
3. **ChatWindow rendering** doesn't have a heuristic fallback for unidentified atendente messages (should assume bot if no `enviado_por_id`)

## Plan

### 1. Fix ChatWindow rendering heuristic (frontend)

**File: `src/components/ChatWindow.tsx`** — In the sender badge logic (lines ~2588-2645):

Change the detection order so that after checking `tipo_remetente === 'bot'`, add a **fallback heuristic**: if `isAtendente(msg.remetente)` is true AND `enviado_por_id` is null AND `operador_nome` is null AND `tipo_remetente` is not explicitly set — then it's a bot message (no human operator sent it).

```
Current flow:
  isAtendente? → tipo_remetente=bot? → enviado_por.full_name? → operador_nome? → null (broken)

Fixed flow:
  isAtendente? → tipo_remetente=bot OR (no enviado_por_id AND no operador_nome)? → 🤖 Bot
             → enviado_por.full_name? → initial+tooltip
             → operador_nome? → initial+tooltip
```

### 2. Fix send-template to save attribution (backend)

**File: `supabase/functions/send-template/index.ts`** — When inserting the message (line ~146), add:
- `tipo_remetente: 'atendente'`
- `operador_nome`: fetch from profiles table using `userId`

This ensures template messages sent by operators are properly attributed.

### 3. Backfill existing NULL records (migration)

**SQL migration**: Update old messages that have `tipo_remetente IS NULL` and `enviado_por_id IS NULL` and `remetente` matches system numbers → set `tipo_remetente = 'bot'`.

```sql
UPDATE mensagens
SET tipo_remetente = 'bot'
WHERE tipo_remetente IS NULL
  AND enviado_por_id IS NULL
  AND (remetente = 'whatsapp:+554138911555'
    OR remetente = 'whatsapp:+14155238886'
    OR remetente = 'atendente'
    OR remetente = 'bot');
```

And for template messages with `enviado_por_id` set but no `tipo_remetente`:
```sql
UPDATE mensagens
SET tipo_remetente = 'atendente'
WHERE tipo_remetente IS NULL
  AND enviado_por_id IS NOT NULL;
```

## Summary of files changed
- `src/components/ChatWindow.tsx` — fix sender badge fallback logic
- `supabase/functions/send-template/index.ts` — add `tipo_remetente` and `operador_nome` on insert
- New SQL migration — backfill `tipo_remetente` for existing records

