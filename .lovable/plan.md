

# Destaque Visual de Novo Orçamento no Card da Conversa

## O que será feito

Quando um novo orçamento chegar para uma ficha vinculada a uma conversa, o card dessa conversa na lista lateral ficará com fundo vermelho semi-transparente e um overlay grande escrito "Chegou novo orçamento!" por cima do card. Esse destaque desaparece quando o operador clicar no card (abrir a conversa).

## Como funciona hoje

- O `ConversationCard` já recebe `orcamentosCount` e mostra um badge discreto `💰 N`
- Não há tracking de "orçamento novo" vs "orçamento já visto" — só a contagem total
- O `NotificationContext` já escuta a tabela `notificacoes` para orçamentos, mas isso é separado da lista de conversas

## Plano

### 1. Rastrear orçamentos recém-chegados (ConversationListBeta + ConversationList)

- Adicionar um estado `recentOrcamentoFichas: Set<string>` que guarda os `ficha_id` que receberam orçamento novo
- Adicionar um canal realtime escutando `INSERT` na tabela `orcamentos`
- Quando chega um INSERT, adicionar o `ficha_nome` ao Set
- Quando o operador clica no card dessa conversa, remover do Set (limpar o destaque)
- Passar uma nova prop `hasNewOrcamento: boolean` para o `ConversationCard`

### 2. Estilizar o ConversationCard com destaque vermelho

- Adicionar prop `hasNewOrcamento?: boolean`
- Quando `true`:
  - Fundo vermelho com transparência (`bg-red-500/15` ou similar)
  - Borda esquerda vermelha (`border-l-red-500`)
  - Overlay absoluto posicionado por cima do card com texto grande "Chegou novo orçamento!" em vermelho, semi-transparente, centralizado
  - Animação sutil de pulse para chamar atenção
- Quando o card é clicado, o destaque é removido via callback

### 3. Limpar o destaque ao selecionar

- No handler `onClick` do card na lista, remover o `ficha_id` do Set `recentOrcamentoFichas`
- Isso garante que o destaque aparece apenas até o operador abrir a conversa

### Arquivos modificados
- `src/components/ConversationCard.tsx` — nova prop `hasNewOrcamento`, estilo vermelho + overlay
- `src/components/ConversationListBeta.tsx` — estado de orçamentos recentes, canal realtime, passar prop
- `src/components/ConversationList.tsx` — mesma lógica replicada para o chat clássico

