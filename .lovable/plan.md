

# Diagnóstico e Correções: Contas a Receber / Contas a Pagar + Build Error

## Problema Identificado

### 1. Fichas "fantasma" inflando as listas
Uma atualização em massa em 06/04/2026 (todas com `updated_at: 2026-04-06 14:51:55`) fez com que 18 fichas antigas (criadas entre Nov/2025 e Mar/2026) passassem o filtro `FINANCEIRO_CUTOFF` (`2026-03-13`). Essas fichas:
- Não têm link de pagamento (nunca tiveram cobrança Asaas)
- Estão como `pagamento_realizado = false/null`
- Aparecem na lista de "Pendentes" sem link, sem sentido real de cobrança

São 19 fichas sem link dos 42 "pendentes" — quase metade da lista não deveria estar ali.

### 2. Asaas está funcionando
Os links Asaas existem nas fichas recentes (abril). O webhook Asaas não tem logs recentes, mas isso é normal se não houve pagamentos confirmados hoje. A integração em si está OK.

### 3. Build error em `sync-twilio-messages`
Erros de TypeScript por tipos implícitos `any` e tipo `never` em queries. Pré-existente, não relacionado às mudanças recentes.

## Solução

### Contas a Receber (`PagamentoClientesTabV2.tsx`)
- Adicionar filtro baseado em `created_at` além do `updated_at`: fichas com `created_at` anterior ao cutoff E sem `pagamento_link` serão excluídas da lista de pendentes
- Isso remove as fichas antigas que foram "arrastadas" pelo bulk update sem afetar fichas legítimas

### Contas a Pagar (`PagamentoPrestadoresTabV2.tsx`)
- Mesmo problema: a query busca todas as fichas Finalizadas com `valor > 0` e prestador, sem filtro de cutoff. Fichas muito antigas sem transação financeira aparecem como "pendentes de pagamento ao prestador"
- Adicionar filtro equivalente para excluir fichas antigas sem relevância financeira

### Build error (`sync-twilio-messages/index.ts`)
- Adicionar tipagem explícita para `response: Response` e `data: any`
- Tipar o retorno de `findOutgoingPlaceholder` e o parâmetro `supabase`

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/components/financeiro/PagamentoClientesTabV2.tsx` | Filtrar fichas antigas sem link de pagamento |
| `src/components/financeiro/PagamentoPrestadoresTabV2.tsx` | Filtrar fichas antigas sem transação financeira relevante |
| `supabase/functions/sync-twilio-messages/index.ts` | Corrigir erros de tipagem TypeScript |

