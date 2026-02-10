
## Bug Fix: WhatsApp message fails on budget approval

### Root Cause

The `send-whatsapp` edge function validates a Bearer token (JWT) on every request. However, the `AprovacaoOrcamentoDialog` component calls this function without including the user's authentication token in the request headers. This causes a **401 Unauthorized** response, silently failing to send the WhatsApp message.

The ficha data updates correctly because those operations use the Supabase client (which automatically includes auth). Only the direct `fetch()` call to `send-whatsapp` is missing the auth header.

### Fix

**File: `src/components/AprovacaoOrcamentoDialog.tsx`**

1. Get the current user's session token from Supabase before making the fetch call
2. Include the `Authorization: Bearer <token>` header in the request to `send-whatsapp`

```text
Before (broken):
  fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    body: ...
  })

After (fixed):
  const { data: { session } } = await supabase.auth.getSession();
  fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: ...
  })
```

### Technical Details

- Only one file needs to change: `AprovacaoOrcamentoDialog.tsx`
- The `supabase` client is already imported in this file (line 14)
- No database or schema changes needed
- No impact on existing data
