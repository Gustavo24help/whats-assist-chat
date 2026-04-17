

## Problema

O login não acontece porque:
- Console do client para em `INITIAL_SESSION` — o handler `handleAuth` **nunca dispara** (não aparece o log `🔐 Auth - Iniciando login`).
- Logs do Supabase Auth não mostram nenhum POST de login recente — confirma que a requisição não sai do navegador.
- Session replay mostra os `<input>` com `value=""` quando a página carrega.

**Causa raiz mais provável:** O autofill do navegador (Chrome/Brave salvou usuário+senha) preenche os campos visualmente, mas como são React controlled inputs (`value={email}`), o state interno permanece `""`. Ao clicar "Entrar", a validação HTML5 `required` **bloqueia o submit silenciosamente** — sem toast, sem console, nada acontece. O usuário vê os campos preenchidos e o botão sem efeito.

Existe um segundo cenário possível (sessão "fantasma" no localStorage que faz o `useEffect` redirecionar imediatamente), mas o sintoma do usuário aponta para o primeiro.

## Solução

Ajustar `src/pages/Auth.tsx` para ser robusto contra autofill **sem alterar nada do fluxo de auth/sessão existente** (preservando dados, redirects e comportamento do AuthContext):

1. **Sincronizar autofill com o state**: usar `ref` nos inputs e, no `handleAuth`, ler `inputRef.current.value` como fallback se o state estiver vazio. Isso resolve 100% dos casos de autofill.

2. **Validação explícita com feedback**: se email/senha vierem vazios após o fallback, mostrar `toast.error("Preencha email e senha")` em vez de deixar o HTML5 bloquear silenciosamente.

3. **Log de submit**: adicionar `console.log` no início do `handleAuth` para que, se o problema persistir, fique evidente no console se o handler está sendo chamado.

4. **Não quebrar nada existente**:
   - Mantém `signInWithPassword`, busca de role, checagem de ponto, `resolvePostLoginRoute`, `localStorage('last-activity-timestamp')`.
   - Mantém `required` nos inputs (defesa em profundidade).
   - Mantém `useEffect` de checagem de sessão.
   - Não toca em `AuthContext`, `ProtectedRoute`, RLS, banco, ou qualquer migration.

## Arquivo afetado

- `src/pages/Auth.tsx` — única alteração

Nenhum dado existente é alterado. Nenhuma migração. Nenhum efeito em usuários já logados.

## Validação pós-correção

Pedir ao usuário para:
1. Recarregar `/auth`, deixar o autofill preencher, clicar Entrar — deve logar.
2. Digitar manualmente — deve continuar logando normalmente.
3. Se ainda falhar, o novo `console.log("🔐 handleAuth chamado")` confirmará se o submit está disparando, e poderemos investigar o próximo passo (sessão fantasma ou token inválido).

