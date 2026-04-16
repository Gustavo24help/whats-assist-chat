

# Correção: Grace period bloqueando SIGNED_OUT legítimo

## Diagnóstico

O problema está no grace period. A sequência no console (imagem 48):

```text
SIGNED_IN          ← sessão VELHA restaurada do localStorage
SIGNED_OUT         ← token refresh FALHOU (sessão inválida) → 400 errors
INITIAL_SESSION    ← tenta usar sessão inválida
```

O `lastSignedInAtRef` é definido em **qualquer** SIGNED_IN, incluindo a restauração automática de sessão do localStorage. Quando o SIGNED_OUT vem 772ms depois para dizer "esses tokens são inválidos", o grace period bloqueia e mantém uma sessão corrupta. Resultado: 400 em todas as queries.

Em aba anônima não há localStorage → não há sessão velha → login funciona.

## Solução

### 1. `AuthContext.tsx` — Grace period inteligente

O grace period deve proteger apenas logins **reais** (via formulário), não restaurações de sessão do localStorage.

- Mudar `lastSignedInAtRef` para só ser definido quando o SIGNED_IN vem **depois** do INITIAL_SESSION (login real do formulário)
- Adicionar flag `initialSessionDoneRef` que fica true após INITIAL_SESSION
- SIGNED_IN antes de INITIAL_SESSION = restauração de sessão → NÃO definir grace
- SIGNED_IN depois de INITIAL_SESSION = login real → definir grace
- No handler de SIGNED_OUT com grace period: em vez de apenas `return`, ainda fazer `getSession()` para confirmar — se a sessão for inválida, aceitar o logout

### 2. `AuthContext.tsx` — Detectar 400 no loadUserProfile

- Se as queries de profile/role retornam erro 400 (PGRST), verificar se a sessão é válida com `getSession()`
- Se `getSession()` retornar null, forçar `signOut()` para limpar tokens corrompidos do localStorage

### 3. Nenhuma outra mudança

ProtectedRoute e useInactivityLogout já estão corretos.

## Detalhes técnicos

```text
Restauração localStorage:
  SIGNED_IN (stale) → NÃO define grace (initialSessionDone = false)
  SIGNED_OUT (token inválido) → getSession() → null → aceitar logout, limpar localStorage

Login real (formulário):
  INITIAL_SESSION (sem sessão) → SIGNED_IN (real) → define grace
  SIGNED_OUT espúrio → grace period → getSession() → sessão válida → ignorar
```

Mudança principal no SIGNED_IN handler:
```typescript
} else if (event === 'SIGNED_IN' && session?.user) {
  // Só ativar grace period para logins reais (após INITIAL_SESSION)
  if (initialSessionDoneRef.current) {
    lastSignedInAtRef.current = Date.now();
  }
  applySessionUser(session.user);
  queueProfileLoad(session.user);
  ...
}
```

Mudança no grace period handler — nunca ignorar cegamente:
```typescript
} else if (event === 'SIGNED_OUT') {
  const timeSinceSignIn = Date.now() - lastSignedInAtRef.current;
  if (lastSignedInAtRef.current > 0 && timeSinceSignIn < SIGNED_OUT_GRACE_MS) {
    console.warn('⚠️ Grace period — verificando sessão...');
    // Mesmo no grace, confirmar com getSession
    setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (!s) {
          console.warn('⚠️ Grace period mas sessão inválida — logout real');
          applySessionUser(null);
          setLoading(false);
        }
      });
    }, 500);
    return;
  }
  // ... resto do handler existente
}
```

