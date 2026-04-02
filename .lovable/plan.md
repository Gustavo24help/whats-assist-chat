

## Diagnóstico: Parcelas sempre 1x no Asaas

### O que está acontecendo

O código frontend envia corretamente `parcelas: ficha.pagamento_parcelas` para a edge function, e a edge function inclui `maxInstallmentCount` no payload do Asaas. **O problema não é no código — é na interação com a API do Asaas.**

A API de Payment Links do Asaas trata `maxInstallmentCount` como o **máximo** de parcelas que o cliente pode escolher no checkout. Porém:

1. **Se `billingType` = `PIX` ou `BOLETO`**: o Asaas ignora `maxInstallmentCount` porque parcelamento só funciona em cartão de crédito
2. **Se `billingType` = `UNDEFINED`**: o Asaas permite todas as formas, mas o cliente pode escolher PIX (1x) no checkout e nunca ver a opção de parcelas
3. O campo "Número de Parcelas" na ficha dá a impressão de que o pagamento **será** parcelado, quando na verdade apenas **permite** parcelamento

### Solução proposta

1. **Edge function `create-payment-link`**: Quando `parcelas > 1`, forçar `billingType = 'CREDIT_CARD'` (pois parcelamento só funciona com cartão). Adicionar log claro do billingType final.

2. **Frontend `FichaServicoTab.tsx`**: 
   - Quando o operador define parcelas > 1, mostrar aviso visual: "Parcelamento disponível apenas em cartão de crédito"
   - Se `pagamento_tipo` não for `cartao_credito` e parcelas > 1, sugerir automaticamente a troca para cartão de crédito ou manter `UNDEFINED` mas garantir que `maxInstallmentCount` está presente (o Asaas mostra a opção de cartão parcelado no checkout)

3. **Alternativa mais flexível**: Quando parcelas > 1 e billingType não é CREDIT_CARD, manter billingType como `UNDEFINED` mas **sempre** enviar `maxInstallmentCount` (o Asaas mostrará PIX, boleto e cartão parcelado como opções no checkout — o cliente escolhe). A diferença é remover a condição `parcelas > 1` e **sempre** enviar `maxInstallmentCount` baseado no valor do campo.

### Mudança recomendada (opção 3 — mais simples e flexível)

**`supabase/functions/create-payment-link/index.ts`** — Sempre enviar `maxInstallmentCount` quando parcelas >= 1:

```typescript
// ANTES (condicional):
...(parcelas && parcelas > 1 ? { maxInstallmentCount: parcelas } : {})

// DEPOIS (sempre enviar):
maxInstallmentCount: parcelas && parcelas > 1 ? parcelas : 1,
```

E quando parcelas > 1, forçar que `billingType` inclua cartão:
```typescript
if (parcelas > 1 && billingType !== 'CREDIT_CARD') {
  billingType = 'UNDEFINED'; // Garante que cartão esteja disponível
}
```

**`src/components/FichaServicoTab.tsx`** — Adicionar mensagem informativa abaixo do campo de parcelas quando > 1:

```
"O cliente poderá parcelar em até X vezes no cartão de crédito. Para PIX/boleto o pagamento será à vista."
```

### Arquivos modificados
- `supabase/functions/create-payment-link/index.ts` — garantir `maxInstallmentCount` e `billingType` corretos
- `src/components/FichaServicoTab.tsx` — aviso visual sobre parcelamento

