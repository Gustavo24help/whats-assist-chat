

# Correções: Mensagem de pagamento, parcelamento Asaas, e formatação de valores

## 1. Remover "Olá" da mensagem de link de pagamento

A mensagem padrão atual em dois lugares começa com `Olá, {nome}! 😊`. Remover o "Olá" para ficar apenas `{nome}! 😊` ou similar.

**Arquivos:**
- `src/components/EnviarLinkPagamentoDialog.tsx` (linha 34) — mensagem do dialog
- `src/components/FichaServicoTab.tsx` (linha 166) — mensagem do envio automático

**De:**
```
Olá${nomeCliente ? `, ${nomeCliente}` : ''}! 😊\n\nSegue o link para pagamento...
```
**Para:**
```
${nomeCliente ? `${nomeCliente}, s` : 'S'}egue o link para pagamento...
```

---

## 2. Parcelamento não funciona no Asaas

O `create-payment-link` só envia `maxInstallmentCount` quando `billingType === 'CREDIT_CARD'`. Porém, a API de Payment Links do Asaas aceita parcelamento via `maxInstallmentCount` independente do `billingType`. O campo só se aplica ao checkout quando o cliente escolhe cartão de crédito, mas deve ser enviado sempre que `parcelas > 1`.

**Arquivo:** `supabase/functions/create-payment-link/index.ts` (linhas 88-90)

**De:**
```js
...(parcelas && parcelas > 1 && billingType === 'CREDIT_CARD' ? {
  maxInstallmentCount: parcelas,
} : {}),
```
**Para:**
```js
...(parcelas && parcelas > 1 ? {
  maxInstallmentCount: parcelas,
} : {}),
```

Isso permite que o link de pagamento ofereça parcelamento ao cliente quando ele escolher cartão de crédito no checkout, independente da forma de pagamento pré-selecionada na ficha.

---

## 3. Formatação de valores: de `1000.00` para `1.000,00`

Os campos de valor (Mão de Obra, Peças, Valor Total) usam `<Input type="number">`, que exibe no formato americano (`1000.00`). Para mostrar no formato brasileiro (`1.000,00`), trocar para `type="text"` com máscara de formatação.

### Abordagem segura (sem afetar dados existentes)
- Trocar `type="number"` para `type="text"` nos inputs de valor
- Exibir o valor formatado em pt-BR (`1.000,00`)
- No `onChange`, fazer parse reverso (remover pontos, trocar vírgula por ponto) para manter o número real no state
- O valor numérico real que vai para o banco **não muda** — apenas a exibição muda
- Função utilitária:
  - `formatarInputMoeda(valor: number): string` → formata para exibição
  - `parseMoedaInput(texto: string): number` → converte de volta para número

**Arquivo:** `src/components/FichaServicoTab.tsx`
- Linhas 1362-1369 (valor_mao_obra)
- Linhas 1409-1416 (valor_pecas)
- Linhas 1510-1517 (valor_total)

### Salvaguarda
- O `parseFloat` ou parser customizado só é chamado no `onChange`
- O valor salvo no banco continua sendo um `number` puro (ex: `1000`, não `"1.000,00"`)
- Nenhum cálculo existente (margem, arredondamento, subtotal) é alterado — todos continuam recebendo o mesmo número

## Arquivos alterados
- `src/components/EnviarLinkPagamentoDialog.tsx` — remover "Olá"
- `src/components/FichaServicoTab.tsx` — remover "Olá" + formatação pt-BR nos inputs de valor
- `supabase/functions/create-payment-link/index.ts` — parcelamento sem restrição de billingType

