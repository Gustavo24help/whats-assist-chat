

# 4 Melhorias: Responder Mensagem + Corrigir Chat Interno + Avisos Melhorados

## 1. Responder mensagem no WhatsApp (Chat principal)

O ChatWindow ja possui a infraestrutura de `reply_to_message_id` no banco e o componente `QuotedMessage` para exibir citacoes, alem do `ReplyIndicator` ja criado mas nao utilizado. Falta apenas conectar tudo.

**Alteracoes em `src/components/ChatWindow.tsx`:**
- Adicionar estado `replyingTo: Mensagem | null`
- Adicionar opcao "Responder" no `MessageContextMenu` (via callback)
- Ao clicar em "Responder", setar `replyingTo` com a mensagem selecionada
- Exibir o `ReplyIndicator` acima da area de input quando `replyingTo` estiver preenchido
- Ao enviar, incluir `reply_to_message_id` na mensagem temporaria e no insert do banco
- Limpar `replyingTo` apos envio

**Alteracoes em `src/components/MessageContextMenu.tsx`:**
- Adicionar prop `onReply?: () => void`
- Adicionar item de menu "Responder" com icone de seta

**Alteracoes em `supabase/functions/send-whatsapp/index.ts`:**
- Verificar se precisa passar `reply_to_message_id` para gravar no banco (a funcao ja insere na tabela `mensagens`)

---

## 2. Corrigir Chat Interno (nao abre novas conversas)

**Causa raiz:** As politicas RLS das tabelas `internal_conversations` e `internal_conversation_members` possuem auto-referencia com bug. Por exemplo:

```text
icm.conversation_id = icm.conversation_id  -- sempre TRUE, deveria ser:
icm.conversation_id = internal_conversation_members.conversation_id
```

E nas politicas de `internal_conversations`:
```text
internal_conversation_members.conversation_id = internal_conversation_members.id
-- deveria ser:
internal_conversation_members.conversation_id = internal_conversations.id
```

**Correcao via migracao SQL:**
- Recriar as politicas de SELECT e UPDATE em `internal_conversations` com a expressao correta referenciando `internal_conversations.id`
- Recriar a politica de SELECT em `internal_conversation_members` com referencia correta a `internal_conversation_members.conversation_id`

---

## 3. Avisos: Arquivar + Scroll + Autor + Deletar

**Migracao SQL:**
- Adicionar coluna `arquivado boolean DEFAULT false` na tabela `avisos`
- Adicionar politica RLS de UPDATE para admins na tabela `avisos`
- Adicionar politica RLS de DELETE para admins na tabela `avisos`

**Alteracoes em `src/pages/Avisos.tsx`:**
- **Arquivar:** Adicionar botao "Arquivar" no card do aviso e no dialog. Ao arquivar, atualizar `arquivado = true`. Filtrar a lista principal para mostrar apenas `arquivado = false`
- **Tab Arquivados:** Adicionar nova tab "Arquivados" que mostra apenas avisos com `arquivado = true`, com opcao de desarquivar
- **Scroll em avisos longos:** No Dialog de detalhes, envolver o conteudo em `ScrollArea` com `max-h-[60vh]` para avisos muito longos
- **Autor:** Mostrar `criado_por_nome` na lista de avisos (abaixo da data), nao apenas no dialog
- **Deletar:** Botao "Apagar" visivel apenas para admins, com confirmacao (AlertDialog) antes de deletar permanentemente

---

## Resumo de arquivos alterados

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Corrigir RLS do chat interno + adicionar coluna `arquivado` + RLS UPDATE/DELETE em avisos |
| `src/components/ChatWindow.tsx` | Estado `replyingTo`, ReplyIndicator, reply_to_message_id no envio |
| `src/components/MessageContextMenu.tsx` | Opcao "Responder" no menu de contexto |
| `src/pages/Avisos.tsx` | Tab arquivados, scroll, autor na lista, botao deletar/arquivar |

**Seguranca de dados:** Nenhum dado existente sera modificado. A nova coluna `arquivado` tera default `false`, preservando todos os avisos atuais como nao-arquivados. As correcoes de RLS apenas ajustam a logica de acesso sem alterar dados.

