

## Plano: Filtro de data de pagamento em Prestadores e Clientes

### Diagnóstico

O filtro que oculta pagamentos de prestadores cuja data prevista ainda não chegou **existe no código** (linha 196 de `PagamentoPrestadoresTabV2.tsx`), mas pode não estar funcionando corretamente porque:
- Ele filtra client-side após buscar TODAS as fichas finalizadas — se houver muitas fichas (>1000), a query do Supabase trunca e o filtro pode perder dados
- Preciso verificar se ele está de fato filtrando corretamente

### O que será feito

**1. Garantir filtro de "data de pagamento prevista" no Prestadores**
- Confirmar que o filtro `data_pagamento_prevista <= hoje` está ativo e funcional na aba Pendentes
- Se necessário, corrigir a lógica

**2. Adicionar filtro de data visual em ambas as abas**

Em **Pagamento Prestadores**:
- DatePicker com label "Filtrar por data de pagamento prevista"
- Padrão: data de hoje
- Filtra fichas cuja `data_pagamento_prevista` cai no dia selecionado (pendentes) ou cuja `data_pagamento_realizada` cai no dia selecionado (histórico/pagos)
- Opção "Todas as datas" para ver tudo que já venceu

Em **Pagamento Clientes**:
- DatePicker com label "Filtrar por data"
- Filtra por `updated_at` (data de finalização) no dia selecionado
- Padrão: sem filtro (mostra todos pendentes)

**3. Arquivos alterados**
- `src/components/financeiro/PagamentoPrestadoresTabV2.tsx` — adicionar DatePicker + garantir filtro
- `src/components/financeiro/PagamentoClientesTabV2.tsx` — adicionar DatePicker

