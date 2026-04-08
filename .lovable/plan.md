
Objetivo: corrigir de forma definitiva o problema em que páginas protegidas publicadas abrem a Home ou perdem o destino original, especialmente quando são abertas em nova aba.

Diagnóstico provável
- O problema não parece ser da rota em si, porque `ProtectedRoute` já tenta enviar `returnTo`.
- Há inconsistência no fluxo de navegação/auth:
  1. `useOpenInNewTab` usa `window.open(path, "_blank")` e, no modo mesma aba, usa `window.location.href`, ou seja, faz navegação “hard” fora do React Router.
  2. Algumas páginas ainda têm checagens próprias de sessão (`Chat` e `ChatPrestadores`) que redirecionam para `/auth` sem preservar `returnTo`.
  3. O login hoje depende só do `returnTo` vindo na URL; quando ele some em algum ponto, o fallback volta para `/`.
- Isso explica o sintoma visto nos logs: o usuário é autenticado, mas o `Auth` registra redirecionamento para `/`, não para a página solicitada.

Plano de implementação
1. Centralizar a lógica de “destino pretendido”
- Criar uma função utilitária única para resolver o destino pós-login:
  - prioridade 1: `returnTo` da URL
  - prioridade 2: destino pendente salvo localmente
  - prioridade 3: `/`
- Validar esse destino para aceitar apenas rotas internas do app, evitando quebra de navegação.

2. Tornar a navegação em nova aba robusta
- Refatorar `useOpenInNewTab` para:
  - usar URL absoluta baseada em `window.location.origin`
  - salvar o destino antes de abrir a nova aba
  - no modo mesma aba, usar navegação do router em vez de `window.location.href`
- Isso evita hard reload desnecessário e reduz perda de contexto.

3. Fazer o auth respeitar sempre o destino real
- Ajustar `Auth.tsx` para consumir a mesma lógica centralizada de destino.
- Ao detectar sessão existente ou após login, redirecionar para o destino resolvido, não diretamente para `/`.
- Limpar o destino pendente depois do redirecionamento para não contaminar navegações futuras.

4. Eliminar redirecionamentos concorrentes
- Remover ou adaptar as checagens locais de sessão em `Chat.tsx` e `ChatPrestadores.tsx`, deixando `ProtectedRoute` ser a fonte principal de proteção.
- Onde ainda houver redirecionamento manual para `/auth`, incluir preservação do destino atual.

5. Endurecer o `ProtectedRoute`
- Manter o `returnTo` atual, mas passar a salvar também o destino pendente localmente como redundância.
- Preservar pathname + querystring completos, para não quebrar casos como `/chat?telefone=...`.

Arquivos que devem ser ajustados
- `src/hooks/useOpenInNewTab.ts`
- `src/pages/Auth.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/Chat.tsx`
- `src/pages/ChatPrestadores.tsx`
- possivelmente um novo utilitário, algo como `src/lib/authRedirect.ts`

Safeguards
- Não mexer em dados do banco, horários, registros ou lógica operacional do sistema.
- A correção ficará restrita à navegação/autenticação no frontend.
- Queries como `?telefone=...` continuarão intactas.

Validação após implementação
- Abrir em nova aba pelo menu lateral:
  - Dashboard TV
  - Dashboard
  - Chat
  - Settings
- Testar com sessão ativa.
- Testar com sessão expirada, confirmando que:
  - vai para login
  - após login volta exatamente para a rota original
  - não cai na Home por engano
- Testar também no domínio publicado, não só no preview.
