

# Sessão persistente entre abas + inatividade de 4 horas

## Resumo

Tornar o sistema de autenticação robusto como Gmail/Canva: abrir novas abas mantém a sessão ativa; deslogar apenas após **4 horas** de inatividade real (com aviso de 15 minutos).

## Problemas atuais

1. **SIGNED_OUT transitório** — Após login, o Supabase emite `SIGNED_OUT` espúrio (token antigo expirado). O delay de `setTimeout(0)` é insuficiente para filtrar isso.
2. **Novas abas deslogadas** — O `ProtectedRoute` vê `user=null` momentaneamente e redireciona para `/auth` antes da sessão ser restaurada do localStorage.
3. **Timeout de 2 horas** — Atualmente configurado para 2h, precisa ser 4h.

## Plano de implementação

### 1. `src/contexts/AuthContext.tsx` — Grace period no SIGNED_OUT + retry no loadUserProfile

- Adicionar `lastSignedInAtRef` e constante `SIGNED_OUT_GRACE_MS = 3000`
- No evento `SIGNED_IN`: registrar `lastSignedInAtRef.current = Date.now()`
- No evento `SIGNED_OUT`: se ocorreu < 3s após SIGNED_IN, ignorar completamente; caso contrário, aguardar 500ms e confirmar com `getSession()` antes de aceitar logout
- No `loadUserProfile`: adicionar retry (3 tentativas, 300ms entre cada) na query de `user_roles` para cobrir o delay de propagação do JWT no RLS

### 2. `src/components/ProtectedRoute.tsx` — Verificação dupla antes de redirecionar

- Quando `loading=false` e `user=null`, fazer `supabase.auth.getSession()` para confirmar
- Mostrar spinner enquanto confirma; só redirecionar para `/auth` se a verificação também retornar sem sessão
- Adicionar estado `verifyingSession` com `useState`

### 3. `src/hooks/useInactivityLogout.tsx` — Timeout de 4 horas

- Alterar `INACTIVITY_TIMEOUT` de `2 * 60 * 60 * 1000` para `4 * 60 * 60 * 1000`

### 4. Atualizar memória

- Atualizar `mem://auth/inactivity-logout-policy` para refletir 4 horas
- Atualizar `mem://technical/auth-initialization-stability` com as novas defesas

## Detalhes técnicos

```text
Login ──▶ SIGNED_IN (registra timestamp)
           │
           ▼
  SIGNED_OUT espúrio (< 3s)?
    SIM ──▶ ignorar, manter sessão
    NÃO ──▶ aguardar 500ms ──▶ getSession()
              │
              ├─ sessão existe ──▶ restaurar (transitório)
              └─ sem sessão ──▶ logout real

Nova aba ──▶ ProtectedRoute ──▶ user=null?
              │
              ▼
         getSession() direto
           │
           ├─ sessão existe ──▶ renderizar normalmente
           └─ sem sessão ──▶ redirecionar /auth
```

Nenhuma alteração no banco de dados. A política RLS de `user_roles` já está correta (`auth.uid() = user_id`).

