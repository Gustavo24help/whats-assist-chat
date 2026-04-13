

# Plan: Centralize Attribution on Last Operator Who Sent a Message

## Problem

Currently, `atendente_id` is only set in the frontend (ChatWindow/ChatWindowBeta) when sending a message AND no operator is assigned yet. Multiple flows bypass this:

- **AprovacaoOrcamentoDialog** — sends via `send-whatsapp` without updating `atendente_id`
- **EnviarLinkPagamentoDialog** — same issue
- **FichaServicoTab** — same issue  
- **ReciboGenerator** — same issue
- **ContasReceber** — same issue
- **send-template** edge function — no attribution at all
- Bot messages should NOT change attribution

## Solution

Centralize the attribution logic in the **`send-whatsapp` edge function** (server-side), so that every message sent by a real operator automatically updates `atendente_id`. This guarantees attribution regardless of which UI component triggered the send.

### Step 1: Update `send-whatsapp` edge function

After successfully saving the message to the `mensagens` table (for client messages only, not prestador), add logic to update `clientes.atendente_id`:

- Only update if `remetente !== 'bot'` (skip bot messages)
- Set `atendente_id` to `userData.user.id` (the authenticated user who invoked the function)
- This covers ALL flows: direct messages, templates via fallback, payment links, receipts, etc.

### Step 2: Update `send-template` edge function

The `send-template` function receives a `userId` parameter. After successfully sending the template, update `clientes.atendente_id` to that `userId` (if provided and not a bot).

### Step 3: Remove redundant frontend auto-assignment

In `ChatWindowBeta.tsx` and `ChatWindow.tsx`, remove the `if (!atendenteAtual)` auto-assignment block inside `enviarMensagemReal()`, since the edge function now handles it. Keep the `atribuirOperador` function for manual assignment and the takeover flow.

### Files Modified
- `supabase/functions/send-whatsapp/index.ts` — add `atendente_id` update after message insert
- `supabase/functions/send-template/index.ts` — add `atendente_id` update after template send
- `src/components/ChatWindowBeta.tsx` — remove redundant auto-assign in `enviarMensagemReal`
- `src/components/ChatWindow.tsx` — remove redundant auto-assign in `enviarMensagemReal`

