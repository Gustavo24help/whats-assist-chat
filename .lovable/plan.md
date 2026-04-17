

## Cenário reportado

> "Vejo o chat A. Marco A como não lido. Saio para abrir o chat B. Volto na lista — A aparece como lido."

## Causa raiz

Estado: `manual_unread_at` é gravado corretamente quando o operador marca como não lido em `ConversationList.tsx::toggleUnreadMark`. Mas quando ele **abre o chat A para olhar** (mesmo que seja para depois marcar como não lido), o `ChatWindow.tsx` dispara `clearUnreadMark()` (linha 416) que faz upsert com `manual_unread_at: null`.

O fluxo real do usuário é provavelmente:

1. Abre o chat A → `clearUnreadMark` zera tudo (esperado).
2. Sem fechar o chat A, vai na lista da esquerda e clica no ícone "marcar como não lido" do chat A → `toggleUnreadMark` grava `manual_unread_at = now()`.
3. Clica no chat B → o `useEffect` do `ChatWindow` reage à mudança de `clienteTelefone`, mas **antes de desmontar** o A, há uma corrida: o `setSelectedTelefone(B)` re-renderiza o `ChatWindow` com a nova prop, e o effect de cleanup/setup roda. Não há `clearUnreadMark` no B em A, **mas** o problema também pode ser:

   - Ao clicar em B, o `ChatWindow` faz `clearUnreadMark()` para B (correto) — mas se houver algum re-render que dispare o effect com a chave A novamente (ex: realtime de `clientes`), `clearUnreadMark` em A é chamado e apaga a marcação.
   - Ou: o `toggleUnreadMark` foi feito **enquanto o ChatWindow de A ainda estava montado**, e qualquer re-render do effect dele (mudança de `user`, refetch, etc.) re-dispara `clearUnreadMark()` de A, sobrescrevendo o `manual_unread_at` que acabou de ser gravado.

A linha 416 (`clearUnreadMark()`) roda **toda vez que o effect de inicialização re-executa**, não só na primeira montagem. Qualquer dependência que mude (incluindo o próprio `user` chegando após hidratação) limpa a marcação.

Confirmação do bug: o effect na linha ~415 tem como dependência `clienteTelefone` (e provavelmente `user`). Ao marcar como não lido **com o chat A ainda aberto**, e em seguida o `user` ou outro hook re-render disparar o effect, `clearUnreadMark` é chamado e sobrescreve `manual_unread_at = null`.

## Solução

Tornar `clearUnreadMark` **idempotente em relação a marcações manuais recentes**:

1. **`ChatWindow.tsx::clearUnreadMark`**: antes de fazer o upsert que limpa `manual_unread_at`, verificar se já existe um `manual_unread_at` que foi gravado **depois** da última montagem desse chat (ex: nos últimos 60s). Se sim, NÃO limpar — respeita a intenção explícita do operador.

   Implementação: guardar `mountTimestamp` em `useRef` no início do effect. No `clearUnreadMark`, fazer um SELECT antes do upsert. Se `manual_unread_at > mountTimestamp`, abortar a limpeza (apenas atualizar `last_read_at`, sem mexer em `manual_unread_at`).

2. **Garantir que `clearUnreadMark` só rode na primeira montagem do chat**, não em re-execuções do effect por mudança de `user`. Mover para um `useEffect` separado com dependência apenas em `[clienteTelefone]` e usar um `Set` ou ref para rastrear telefones já marcados como lidos nesta sessão de visualização.

3. **Mesmo fix em `ChatWindowBeta.tsx`** (linha 1194) — código espelhado.

4. **Não tocar no `ConversationList.tsx`** — a lógica de `toggleUnreadMark` está correta.

## Validação anti-regressão

- Abrir um chat não lido → continua marcando como lido ao abrir (caso normal).
- Marcar manualmente como não lido com chat aberto e trocar de chat → marcação **persiste**.
- Recarregar a lista → chat continua aparecendo como não lido.
- Reabrir o chat marcado manualmente → aí sim limpa (intenção clara).

## Arquivos afetados

- `src/components/ChatWindow.tsx` — ajustar `clearUnreadMark` + effect de montagem.
- `src/components/ChatWindowBeta.tsx` — mesmo ajuste.

Nenhuma migração. Nenhuma mudança em dados existentes.

