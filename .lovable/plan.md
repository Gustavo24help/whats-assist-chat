

# Fix: Unread Indicators in Chat BETA

## Problem

Three issues prevent unread indicators from working:

1. **Seeding marks everything as read**: When a conversation has no `mensagem_leitura_operador` record (line 1072), it's set to `perOperatorUnread = false`. Then the seeding block (lines 1099-1118) immediately creates records with `last_read_at = now()`, so even genuinely unread conversations get marked as read.

2. **`unreadCount` uses the wrong data source**: Line 1667 passes `operatorReadMap.get(...)?.nao_lidos` from the OLD `conversa_operador_leitura` table (state on line 101), which has `nao_lidos` always at 0. The correct unread state is in `marcado_nao_lido` (from `mensagem_leitura_operador`).

3. **Badge never shows**: Since `unreadCount` is always 0 and `marcadoNaoLido` is always false (due to seeding), the blue badge condition `(marcadoNaoLido || unreadCount > 0)` is never true.

## Desired Behavior

- Every operator sees ALL conversations' unread state independently
- A conversation is "unread" if the latest client message arrived AFTER the operator's `last_read_at`, OR if manually marked unread
- Reading a conversation (selecting it) updates only THAT operator's read timestamp
- Unread state is independent of ticket assignment

## Plan

### Step 1: Fix the seeding logic

Change line 1072 from `perOperatorUnread = false` to `perOperatorUnread = !!lastClientMsg`. When there's no read record but a client message exists, the conversation should show as unread. The seeding will still create records, but only AFTER `perOperatorUnread` has been computed — so the first render shows unread correctly.

### Step 2: Remove the old `conversa_operador_leitura` state system

Remove the state-level `operatorReadMap` (lines 101-159) that reads from `conversa_operador_leitura` table. This table is unused/stale and causes confusion with the local variable of the same name inside `fetchClientes`.

### Step 3: Pass correct unread count to ConversationCard

Change line 1667 from:
```
unreadCount={operatorReadMap.get(cliente.telefone)?.nao_lidos || 0}
```
to:
```
unreadCount={cliente.marcado_nao_lido ? 1 : 0}
```

This ensures the badge renders whenever `marcado_nao_lido` is true (either from new client messages or manual marking).

### Step 4: Ensure realtime refresh works

The existing realtime channels for `mensagens` and `mensagem_leitura_operador` already call `fetchClientes()`. Verify they remain after removing the old `conversa_operador_leitura` channel.

### Files Modified
- `src/components/ConversationListBeta.tsx` — all changes in one file

