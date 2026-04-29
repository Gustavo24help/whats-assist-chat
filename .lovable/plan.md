Compactar o card de conversa do ChatBeta em 3 linhas e aplicar borda colorida por status.

## Layout novo (`ConversationCard.tsx`)

**Linha 1** — Nome · Telefone (sem `whatsapp:+55`) · `📋 OS-XXXX`
- Sanitizar telefone só na exibição: remover prefixo `whatsapp:` e `+55`. DB intacto.
- Ex.: `whatsapp:+5511987654321` → `(11) 98765-4321` (ou apenas `11987654321` se a formatação ficar longa). Mantém `title={telefone}` original em hover.

**Linha 2** — Status da ficha · `🔥 Sem orçamento` (quando aplicável)
- Texto do status (sem bolinha colorida — removida).
- Trocar emoji `💰 Sem orçamento` → `🔥 Sem orçamento`.
- Manter ícones inline já existentes: ✅/❌ pagamento, badge `🧾 N` orçamentos, `🆕` (overlay separado), `⏳ Status há Xmin`.

**Linha 3** — `Operador` · `⏰ MMmin` (tempo desde criação da ficha) · `UM: C / 24`
- Operador: só o nome, sem prefixo "Operador:".
- `⏰` agora = tempo desde `ficha.created_at` (formato `MMmin` se < 60, senão `Xh`).
- `UM:` mantém formato atual.

Tags movidas para tooltip ou linha 0 reduzida (mantém `flex-wrap` discreto acima da linha 1, altura mínima removida quando vazio). Bookmark + menu `⋮` continuam no canto superior direito.

## Borda colorida (3px, contorno completo)

Substituir `border-l-4` por `border-[3px]` em volta do card todo. Cor pela regra:

| Condição | Cor |
|---|---|
| `fichaStatus === "Ficha Criada"` | vermelho (`border-red-500`) |
| sem ficha (`!fichaId`) | amarelo (`border-yellow-500`) |
| `fichaStatus ∈ {Finalizado, Perdido, Garantia}` | verde (`border-green-500`) |
| qualquer outro status | azul (`border-blue-500`) |

Função `getCardBorderColor(fichaId, fichaStatus)` retorna a classe Tailwind. Aplicada sempre, exceto quando `isSelected` (mantém destaque primary) ou `hasNewOrcamento` (mantém vermelho pulsante atual).

Alertas existentes (não-lido azul, `statusAlertColor` laranja) deixam de pintar borda — viram apenas background sutil para não conflitar com a nova borda semântica.

## Mudanças que permanecem do plano anterior

- Reatribuir 💰: `🧾 N` (qtd orçamentos), `🆕` (novo orçamento), `🔥` (sem orçamento — atualizado nesta rodada).
- Remover bolinha colorida do status.
- ⏰ = tempo desde criação da ficha; ⏳ = tempo no status atual.
- Atualizar Legenda (popover em `ConversationListBeta.tsx`) com os novos ícones + nova entrada "Borda do card: vermelho/amarelo/verde/azul" explicando o significado.

## Implementação técnica

1. **`ConversationCard.tsx`**:
   - Helper `formatTelefoneDisplay(tel)` removendo `whatsapp:` e `+55`, formatando como `(DD) NNNNN-NNNN`.
   - Helper `getCardBorderColor()` conforme tabela.
   - Reescrever bloco JSX em 3 linhas conforme acima.
   - Adicionar prop `fichaCreatedAt?: string | null`; calcular `⏰ MMmin` com `differenceInMinutes`.
   - Remover `<div w-2 h-2 rounded-full ...>`.
   - Substituir emojis 💰 conforme regras.
   - Trocar `border-l-4` por `border-[3px]` + classe dinâmica.

2. **`ConversationListBeta.tsx`**:
   - Passar `fichaCreatedAt={fichaData?.created_at ?? null}` ao `<ConversationCard>`.
   - Atualizar conteúdo do popover Legenda com novos ícones e seção de cores da borda.

Sem alterações no banco, queries, filtros ou contagens.