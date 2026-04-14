

# Plano: Sugestão IA automática aprimorada no Chat Beta

## Resumo

Atualizar a lógica de sugestão automática existente no `ChatWindowBeta.tsx` para: (1) gerar sugestões também quando o operador foi o último a falar e o cliente está inativo há 3+ min, (2) passar contexto completo da ficha na chamada à Edge Function, (3) piscar a conversa na lista quando uma nova sugestão é gerada.

## Arquivos a editar

### 1. `src/components/ChatWindowBeta.tsx`
- Adicionar prop `onSuggestionReady?: (telefone: string) => void`
- Adicionar estados `totalOrcamentos` e `minutosDesdeUltimaMsg` (derivados das mensagens e da ficha)
- Calcular `minutosDesdeUltimaMsg` a partir do timestamp da última mensagem do cliente
- Buscar `totalOrcamentos` da ficha ativa (query ao `orcamentos` table filtrado por `ficha_nome`)
- Refatorar `generateSuggestion` para aceitar `trigger: "cliente_respondeu" | "operador_aguardando"` e incluir contexto rico (fichaStatus, totalOrcamentos, minutosDesdeUltimaMsg, quem falou por último)
- Adicionar useEffect de intervalo (60s) que verifica se o operador foi o último a falar e gera sugestão de reengajamento quando inatividade >= 3 min
- Chamar `onSuggestionReady?.(clienteTelefone)` quando uma sugestão é gerada com sucesso

### 2. `src/pages/ChatBeta.tsx`
- Adicionar estado `conversasComSugestao: Set<string>` para rastrear quais conversas têm sugestão pendente
- Passar callback `onSuggestionReady` ao `ChatWindow` que adiciona o telefone ao Set
- Ao selecionar um cliente (`handleSelectCliente`), remover do Set
- Passar `conversasComSugestao` para o `ConversationList`

### 3. `src/components/ConversationListBeta.tsx`
- Adicionar prop `conversasComSugestao?: Set<string>`
- Passar para o `ConversationCard` como `hasSuggestion` boolean

### 4. `src/components/ConversationCard.tsx`
- Adicionar prop `hasSuggestion?: boolean`
- Quando `true`, mostrar ícone `Sparkles` e classe `animate-pulse ring-1 ring-primary/40 bg-primary/5`

## Detalhes técnicos

**Cálculo de `minutosDesdeUltimaMsg`**: derivado do array `mensagens` já carregado — pegar a `data_hora` da última mensagem do cliente e calcular a diferença com `Date.now()`.

**Cálculo de `totalOrcamentos`**: query simples ao carregar a ficha — `supabase.from('orcamentos').select('id', { count: 'exact' }).eq('ficha_nome', fichaId)`. Reutilizar o `fichaId` já disponível no componente.

**Contexto na chamada**: o body da Edge Function já aceita campos extras (`contexto`) que são ignorados pela function — apenas as `messages` são processadas. O contexto será injetado como a última mensagem `user` no array `formatted`.

**Sem mudanças na Edge Function** — toda a lógica é no frontend.

