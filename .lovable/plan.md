

# Correção: Data de Pagamento Prevista — Diagnóstico e Plano

## O que está errado

### Problema 1: `PopupConfirmacaoFinanceira` calcula a partir de HOJE, não da data de execução
**Linha 34-44**: `calcularDataPagamento()` usa `new Date()` (momento que o popup é aberto) como base. Deveria usar a data de execução do serviço. Também não considera feriados — só pula sábado/domingo.

### Problema 2: `PagamentoPrestadoresTabV2` ignora o valor salvo e recalcula errado
**Linha 199**: `data_pagamento_prevista: addBusinessDays(f.created_at, 2)` — usa `created_at` (data de CRIAÇÃO da ficha), não a data de execução. Ignora completamente o valor `data_pagamento_prevista` que já está salvo na tabela `transacoes_financeiras`.

### Problema 3: DB function `adicionar_dias_uteis` também não considera feriados
A função SQL no banco só verifica sábado/domingo, igual ao frontend.

### Caso FS5-260319
- Ficha criada: provavelmente ~19/03 (quinta)
- Serviço executado: sábado 21/03
- O código calcula: `created_at` (quinta 19) + 2 dias úteis = sexta 20 + segunda 23 = **23/03** ← ERRADO
- Correto: execução (sábado 21) + 2 dias úteis = segunda 24 + terça 25 = **25/03/2026**

## Correções

### 1. `PopupConfirmacaoFinanceira.tsx`
- Alterar `calcularDataPagamento()` para receber uma data base como parâmetro (a `data_execucao`)
- Usar `isBusinessDay` de `businessDays2026.ts` em vez de só checar sábado/domingo
- Usar `data_execucao` (que já é salva como `new Date().toISOString()` na linha 307) como base

### 2. `PagamentoPrestadoresTabV2.tsx`
- Na linha 199: usar o `data_pagamento_prevista` salvo na transação financeira quando existir
- Fallback: recalcular a partir de `updated_at` (proxy da data de finalização), não `created_at`

### 3. Migração SQL para corrigir `adicionar_dias_uteis`
- Adicionar tabela de feriados 2026 ou hardcode no SQL para consistência com o frontend

### 4. Corrigir FS5-260319 no banco
- Atualizar o `data_pagamento_prevista` da transação existente para 25/03/2026

## Impacto
- Pagamentos futuros terão data prevista correta (baseada na execução, com feriados)
- UI exibirá o valor salvo no banco em vez de recalcular errado
- Ficha FS5-260319 corrigida para 25/03/2026

