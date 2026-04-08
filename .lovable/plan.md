

# Plano: Corrigir 3 problemas - Logout em troca de tela, Spam de notificação, Leitura compartilhada

## Problema 1: Logout ao trocar de tela

**Causa raiz:** O `PageLayout` usa `openRoute()` que abre rotas em **nova aba** (`window.open("_blank")`). Cada nova aba carrega o app do zero. No `useInactivityLogout`, ao montar (linha 66-74), ele verifica `localStorage("last-activity-timestamp")` -- se o timestamp estiver desatualizado (throttle de 30s), o app pode considerar a sessão expirada e deslogar imediatamente.

Além disso, a nova aba restaura a sessão Supabase, mas o `INITIAL_SESSION` pode disparar `SIGNED_OUT` primeiro (como visto nos logs do console), causando um flash de logout.

**Correção:**
1. No `useInactivityLogout`, ao verificar a expiração no mount, atualizar o `last-activity-timestamp` para `Date.now()` quando a diferença for < INACTIVITY_TIMEOUT. Isso evita que uma aba recém-aberta herde um timestamp antigo e se auto-deslogue.
2. Adicionar uma tolerância: ao abrir uma nova aba, gravar um marcador `tab-opened-at` no `sessionStorage`. Se o hook detectar que a aba foi aberta há menos de 10 segundos, ignorar a verificação de expiração inicial.

## Problema 2: Spam de notificação de atribuição

**Causa raiz:** O `AtribuicaoOperadorPopup` escuta **todas** as UPDATEs na tabela `clientes`. Quando o `redistributeChats` reatribui N chats para um operador, cada UPDATE individual gera uma notificação popup. Resultado: operador recebe N popups de uma vez.

Além disso, não há deduplicação -- se o mesmo telefone for reatribuído múltiplas vezes (por reconexões Realtime ou atualizações em cascata), popups duplicados aparecem.

**Correção:**
1. Adicionar filtro no `AtribuicaoOperadorPopup`: ignorar updates que vêm de redistribuição automática. Distinguir redistribuição de atribuição manual verificando se existe uma `tarefa_operacional` do tipo `atribuicao_chat` criada recentemente (últimos 10 segundos) para esse telefone.
2. Adicionar deduplicação por telefone: se já existe um popup ativo para o mesmo `clienteTelefone`, não criar outro.
3. Alternativa mais simples e confiável: no `redistributeChats`, antes de atualizar os clientes, gravar os telefones sendo redistribuídos em uma variável/localStorage temporária. O popup verifica essa lista e ignora.

**Abordagem escolhida:** Deduplicação por telefone + flag `redistribuicao_em_andamento` em `localStorage` que o `redistributeChats` ativa antes de redistribuir e desativa depois. O popup ignora eventos enquanto a flag estiver ativa.

## Problema 3: Leitura compartilhada entre operadores

**Causa raiz:** O `clearUnreadMark` no `ChatWindow.tsx` (linhas 1050-1054) ainda faz `update({ marcado_nao_lido: false })` globalmente na tabela `clientes`. Isso marca o chat como lido para **todos** os operadores, não apenas para quem abriu a conversa. A tabela `mensagem_leitura_operador` (per-operator) existe e é preenchida, mas o campo global `marcado_nao_lido` é zerado para todos.

**Correção:**
1. Remover a atualização global de `marcado_nao_lido = false` do `clearUnreadMark`. Manter apenas o upsert na `mensagem_leitura_operador`.
2. Na `ConversationList`, mudar a lógica de "não lida" para usar a tabela `mensagem_leitura_operador` do operador atual, comparando `last_read_at` com a última mensagem do cliente, em vez de confiar no campo global `marcado_nao_lido`.
3. Manter a trigger `mark_client_unread_on_new_message` como está (ela marca globalmente, o que é ok como "broadcast" de nova mensagem), mas a verificação de leitura passa a ser per-operator.

---

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/hooks/useInactivityLogout.tsx` | Tolerância para novas abas, não deslogar ao montar se aba é recente |
| `src/hooks/useLogoutRedistribution.ts` | Gravar flag `redistribuicao-em-andamento` durante redistribuição |
| `src/components/AtribuicaoOperadorPopup.tsx` | Ignorar eventos durante redistribuição + dedup por telefone |
| `src/components/ChatWindow.tsx` | Remover update global de `marcado_nao_lido` |
| `src/components/ConversationList.tsx` | Usar `mensagem_leitura_operador` per-operator para determinar status de leitura |

## Ordem de implementação

1. Fix do logout em troca de tela (useInactivityLogout)
2. Fix do spam de notificação (redistributeChats + AtribuicaoOperadorPopup)
3. Fix da leitura compartilhada (ChatWindow + ConversationList)

