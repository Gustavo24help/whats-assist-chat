Em `src/components/ConversationCard.tsx` (linhas 282-289), trocar a exibição do remetente da última mensagem para o formato abreviado:

- `Cliente` → `UM: C`
- Bot ou qualquer operador (24help) → `UM: 24`

Mudança apenas visual; o cálculo de `ultimaMsgPor` em `ConversationListBeta.tsx` permanece intacto.

```tsx
{ultimaMsgPor && (
  <span
    className="text-[10px] text-muted-foreground/70 italic shrink-0"
    title={`Última mensagem por ${ultimaMsgPor}`}
  >
    · UM: {ultimaMsgPor === "Cliente" ? "C" : "24"}
  </span>
)}
```