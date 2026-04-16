

# Fix: Stale localStorage causing immediate logout

## Root cause (confirmed)

The incognito logs prove auth works perfectly. The difference is **localStorage**. In a normal window, `useInactivityLogout` reads a stale `last-activity-timestamp` on mount. If it's older than 4 hours, it calls `signOut()` immediately — even right after a fresh login, because `Auth.tsx` never updates this key.

## Changes

### 1. `src/pages/Auth.tsx` — Update timestamp on login

After successful `signInWithPassword`, set the activity timestamp before navigating:

```typescript
localStorage.setItem('last-activity-timestamp', String(Date.now()));
```

### 2. `src/contexts/AuthContext.tsx` — Update timestamp on SIGNED_IN

In the `SIGNED_IN` handler, also update the timestamp to cover OAuth, token refresh, and tab restoration:

```typescript
try { localStorage.setItem('last-activity-timestamp', String(Date.now())); } catch {}
```

### 3. `src/hooks/useInactivityLogout.tsx` — Guard mount check

The mount check currently calls `signOut()` blindly. Add a session check first — only sign out if there's actually a session to clear:

```typescript
if (elapsed >= INACTIVITY_TIMEOUT) {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      supabase.auth.signOut().then(() => navigateRef.current("/auth"));
    }
  });
  return;
}
```

## Secondary issue (not auth-related)

The logs also show a **500 error** on a massive `.in()` query with ~400 phone numbers in the URL. This is a PostgREST URL length overflow — separate from the logout issue but should be addressed later with chunking.

