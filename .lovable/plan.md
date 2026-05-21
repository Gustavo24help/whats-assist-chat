# Aumentar largura da coluna de conversas (Chat Beta)

## Alteração
Em `src/pages/ChatBeta.tsx` (linha 257), a coluna da lista de conversas hoje usa:
- `md:w-[280px] lg:w-[300px]`

Vou aumentar para:
- `md:w-[340px] lg:w-[380px]`

Isso dá mais espaço para nome do cliente, prévia da última mensagem e badges, sem comprometer a janela de chat (que continua flexível) nem o painel lateral direito (`w-[380px] xl:w-[420px]`).

## Escopo
- Apenas alteração de classes Tailwind (UI/apresentação).
- Sem mudanças em lógica, dados ou no `ConversationListBeta`.
- Mobile (`w-full`) permanece igual.

Se preferir outra largura (ex.: 320px / 360px / 400px), me avise antes de aplicar.