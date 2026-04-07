

# Plano: Melhorias no Chat Interno, Notificações, Inatividade, Leitura por Operador e Módulo Tarefas Operacionais

## Resumo

6 frentes de trabalho: (1) Performance e bugs do chat interno, (2) Notificação popup para mensagens internas e atribuição de operador, (3) Logout por inatividade com aviso prévio, (4) Leitura de mensagens por operador individual, (5) Novo módulo "Tarefas Operacionais" com sub-módulos "Conversas a resolver" e "Delegação".

---

## 1. Arrumar Mensagens Internas

### Problemas identificados
- **Lentidão**: O `InternalChatList` faz N+1 queries — para cada conversa, busca membros, perfil, última mensagem e contagem de não lidos **sequencialmente**. Com 10 conversas = ~50 queries.
- **Duplicação de conversas**: O `NewInternalChatDialog` verifica conversas existentes iterando por todas as memberships do usuário em loop (N queries). Se falhar em alguma verificação de timing, cria duplicada.
- **Attachments**: O upload funciona corretamente (bucket `chat-files`, pasta `internal/`), mas precisa validação manual.

### Solução
- **Refatorar `InternalChatList`**: Buscar todas as conversas com uma única query, prefetching de profiles e últimas mensagens em batch (2-3 queries no total em vez de ~50).
- **Corrigir duplicação**: Criar uma função SQL `find_or_create_internal_conversation(user1, user2)` que faz verificação atômica (SELECT + INSERT em transação), eliminando race conditions.
- **Cache de profiles**: Manter um Map de profiles já carregados para evitar re-fetch.

---

## 2. Notificações Popup (Mensagens Internas + Atribuição de Operador)

### 2.1 Popup para mensagens internas
- Criar componente `InternalMessagePopupOverlay` (similar ao `AvisoPopupOverlay`).
- Escutar Realtime em `internal_messages` INSERT.
- Se `sender_id !== currentUser.id` e a conversa **não está aberta** (rota !== `/mensagens` ou `selectedConversation !== conversation_id`), mostrar popup com:
  - Nome do remetente, preview da mensagem
  - Botão "Ir para conversa" (navega para `/mensagens` e seleciona a conversa)
  - Botão "Fechar"
- **Somente marcar como vista quando o usuário ENTRAR na conversa** (não ao ver o popup).

### 2.2 Popup para atribuição de operador ao chat
- Escutar Realtime em `clientes` UPDATE onde `atendente_id` muda para o `currentUser.id`.
- Mostrar popup: "Você foi atribuído à conversa de [nome cliente]"
- Botão "Ir para conversa" → navega para `/chat` e abre a conversa.

### Considerações offline
- Se o computador estiver desligado/fechado, o popup não será visto em tempo real.
- Ao abrir o app, verificar mensagens internas não lidas recentes (últimas 2h) e exibir o popup mais recente pendente.

---

## 3. Logout por Inatividade (2h)

### Implementação
- Criar hook `useInactivityLogout` usado no `AuthProvider` ou `App.tsx`.
- Rastrear atividade: `mousemove`, `keydown`, `click`, `scroll`, `touchstart`.
- Timer de 2h (7.200.000ms). Ao atingir 1h45min (15min antes), exibir modal de aviso:
  - "Você será desconectado em X minutos por inatividade"
  - Botão "Continuar conectado" (reseta o timer)
- Ao atingir 2h sem interação → `supabase.auth.signOut()` + redirect para `/auth`.
- Usar `localStorage` para timestamp da última atividade (persistir entre abas).
- Se o computador estava desligado/fechado: ao reabrir, verificar se `lastActivity + 2h < now()` → deslogar imediatamente.

---

## 4. Leitura de Mensagens por Operador Individual

### Problema atual
- `marcado_nao_lido` é um campo único na tabela `clientes`. Se um operador abre a conversa, marca como lido para todos.

### Solução

**Migração — nova tabela `mensagem_leitura_operador`:**
```sql
CREATE TABLE mensagem_leitura_operador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_telefone TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_telefone, user_id)
);
```

- Quando o operador abre uma conversa, faz UPSERT em `mensagem_leitura_operador` com timestamp atual.
- A contagem de não lidos no `ConversationList` passa a consultar: mensagens com `data_hora > last_read_at` do operador logado (em vez do campo global `marcado_nao_lido`).
- O campo `marcado_nao_lido` continua existindo como fallback/compatibilidade mas não é mais a fonte primária.
- Cada operador vê seu próprio estado de leitura independente.

---

## 5. Módulo "Tarefas Operacionais" (nova página)

### Diferença do módulo existente
O módulo "Tarefas" existente (`/tarefas`) é focado em gestão de projetos internos (App/Sistema, Outros). O novo módulo é **operacional**, focado no dia a dia dos atendimentos.

### 5.1 Sub-módulo: Conversas a Resolver
- Lista fichas com status diferente de "Finalizado", "Perdido", "Não foi adiante".
- Colunas: ID Ficha, Cliente, Status, Prestador, Última interação, Tempo no status
- Botão "Ir para conversa" → abre `/chat` com o cliente selecionado
- Filtros: por status, prestador, operador atribuído, ordenação por urgência

### 5.2 Sub-módulo: Delegação
- Criar tarefas operacionais com campos:
  - Título, descrição, nível de urgência (baixa/média/alta/crítica)
  - Atribuir a um ou mais usuários
  - Vincular a uma ficha (opcional)
  - Prazo (data/hora)
  - Tolerância de repetição do aviso (ex: "repetir a cada 30min", "não repetir", "repetir a cada 1h")
  - Status: pendente / em andamento / resolvido
- Botão "Ir para conversa" se houver ficha vinculada
- **Notificação popup** ao atribuído (similar ao de aviso), com frequência de repetição configurável
- Ao marcar como resolvido, notifica o criador

**Migração — tabela `tarefas_operacionais`:**
```sql
CREATE TABLE tarefas_operacionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  urgencia TEXT DEFAULT 'media', -- baixa, media, alta, critica
  criado_por UUID REFERENCES auth.users(id),
  ficha_id TEXT,
  status TEXT DEFAULT 'pendente', -- pendente, em_andamento, resolvido
  prazo TIMESTAMPTZ,
  tolerancia_aviso_minutos INTEGER DEFAULT 0, -- 0 = não repetir
  ultimo_aviso_em TIMESTAMPTZ,
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tarefas_operacionais_atribuidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID REFERENCES tarefas_operacionais(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(tarefa_id, user_id)
);
```

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `src/components/internal-chat/InternalChatList.tsx` | Refatorar queries para batch |
| `src/components/internal-chat/NewInternalChatDialog.tsx` | Função atômica anti-duplicação |
| `src/components/InternalMessagePopupOverlay.tsx` | **Novo** — popup de mensagem interna |
| `src/components/AtribuicaoOperadorPopup.tsx` | **Novo** — popup de atribuição |
| `src/hooks/useInactivityLogout.tsx` | **Novo** — hook de inatividade |
| `src/components/InactivityWarningModal.tsx` | **Novo** — modal de aviso 15min |
| `src/pages/TarefasOperacionais.tsx` | **Novo** — página com tabs |
| `src/components/tarefas-op/ConversasResolver.tsx` | **Novo** — sub-módulo conversas |
| `src/components/tarefas-op/DelegacaoTab.tsx` | **Novo** — sub-módulo delegação |
| `src/components/tarefas-op/DelegacaoFormDialog.tsx` | **Novo** — formulário de criação |
| `src/components/TarefaOpPopupOverlay.tsx` | **Novo** — popup de delegação |
| `src/components/ConversationList.tsx` | Usar `mensagem_leitura_operador` por usuário |
| `src/components/ChatWindow.tsx` | UPSERT em `mensagem_leitura_operador` ao abrir |
| `src/App.tsx` | Rota + overlays + hook de inatividade |
| `src/components/PageLayout.tsx` | Menu item "Tarefas Operacionais" |
| Migrações SQL | 2 tabelas novas + RLS |

---

## Ordem de implementação

1. Migrações SQL (tabelas + RLS)
2. Refatorar chat interno (performance + anti-duplicação)
3. Hook de inatividade + modal de aviso
4. Leitura por operador individual
5. Popups de notificação (mensagens internas + atribuição)
6. Módulo Tarefas Operacionais (Conversas a Resolver + Delegação)

