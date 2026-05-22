## Problema

Na ficha **FS5-260522** existem 2 orçamentos no banco (1 aprovado, 1 rejeitado, criados às 17:57 de hoje), e o `ficha_ativa_id` do cliente aponta corretamente para essa ficha. Porém o badge `🧾 {orcamentosCount}` não aparece no card da conversa.

## Causa raiz

No `ConversationListBeta.tsx` (Chat BETA), o canal realtime de INSERT em `orcamentos` apenas adiciona a ficha ao set `recentOrcamentoFichas` (que controla o "glow" amarelo de novo orçamento), mas **não dispara um refresh da lista de clientes**. O `orcamentos_count` só é recalculado quando `fetchClientes()` roda — e o polling de rede de proteção do BETA é de **15 minutos**.

Resultado: até o próximo polling (ou refresh manual), o card mostra o glow de novo orçamento mas o contador `🧾 N` continua zerado/desatualizado.

O mesmo padrão existe no `ConversationList.tsx` clássico, só que o polling lá é de 60s, então o atraso é bem menor (mas ainda existe).

## Correção proposta

**Escopo:** apenas frontend, sem mudar dados, sem mudar lógica de negócio.

1. **`src/components/ConversationListBeta.tsx`** — no handler do canal `orcamentos-new-beta`, além de atualizar `recentOrcamentoFichas`, chamar `debouncedFetchClientes()` para que o `orcamentos_count` seja recalculado e o badge apareça imediatamente.

2. **`src/components/ConversationList.tsx`** — mesma correção no canal `orcamentos-new-classic`, chamando `scheduleClientesRefresh()` no handler de INSERT.

Ambas as funções já existem nos arquivos e já são usadas por outros canais realtime (mensagens, fichas, leitura), então é apenas reuso de mecanismo existente, debounced — sem risco de loop ou sobrecarga.

## O que NÃO muda

- Nenhuma query SQL nova, nenhuma migração.
- Nenhuma alteração no `ConversationCard` (o render do badge já está correto).
- Nenhuma alteração na lógica de contagem (`orcamentosCountMap`) nem em `fetchSemOrcamento`.
- Nenhuma alteração de timezone, valores, ou dados persistidos.
- O glow "novo orçamento" continua funcionando exatamente igual.