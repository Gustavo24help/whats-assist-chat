

# Plan: Chat BETA Filter Reorganization + Finalization Confirmation

## 1. Move conversation filters from sidebar to conversation list column

**Current state**: The dropdowns for "Ativas/Inativas/Todas" and "Todas/Não Lidas" live in `ChatBetaFilterSidebar.tsx`.

**Change**: Move these two Select dropdowns into the top of `ConversationListBeta.tsx` (above the search bar). The sidebar keeps only: Operador, FilterDropdown (advanced), Tags, and Status counts.

**Files**: `ChatBetaFilterSidebar.tsx`, `ConversationListBeta.tsx`

**Behavior when operator filter is selected**: The status counts in the sidebar filter by operator, but the "Ativas/Inativas/Todas" dropdown (now in the conversation list) applies independently. When an operator is selected, the conversation status filter auto-switches to "todas" so all that operator's conversations appear.

**Default selection**: Ativas + Todas pre-selected.

## 2. Finalization confirmation dialog (both chats)

**Current state**: In `FichaServicoTab.tsx` line 1108, changing the status Select immediately calls `updateFicha({ status: value })`, which triggers auto-save and NPS/payment flows.

**Change**: Intercept the `onValueChange` of the status Select. When the new value is "Finalizado", show an AlertDialog with:
- Message: "Você quer Finalizar essa Ficha de Serviço? Se você prosseguir será gerado o pagamento de forma automática"
- Buttons: "Prosseguir" / "Não Prosseguir"
- Only call `updateFicha({ status: 'Finalizado' })` if the user confirms

Since `FichaServicoTab.tsx` is shared by both chats, this single change covers both.

**File**: `FichaServicoTab.tsx`

## Summary of file changes

| File | Change |
|------|--------|
| `ChatBetaFilterSidebar.tsx` | Remove the two Select dropdowns (Ativas/Inativas/Todas and Todas/Não Lidas). Remove related props. |
| `ConversationListBeta.tsx` | Add two Select dropdowns at the top of the list (when `hideFilters` is true, use external values but render the dropdowns). |
| `ChatBeta.tsx` | Update prop passing to reflect the filter relocation. |
| `FichaServicoTab.tsx` | Add AlertDialog state. Wrap status change in confirmation when target is "Finalizado". |

