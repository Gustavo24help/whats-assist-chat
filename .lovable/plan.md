

# Fix: Pagamento Clientes Tab — 218 "Novos" + Aba de Problemas + Renomeações

## Problema Raiz: 218 "Novos"
A coluna `pagamento_visto_por_chefe` foi adicionada com default `false`. Todas as 219 fichas pagas existentes estão marcadas como "não vistas", gerando 218 falsos "novos". Solução: migração para marcar todas as fichas pagas existentes como já vistas.

## Mudanças Planejadas

### 1. Migração SQL
- `UPDATE fichas_de_servico SET pagamento_visto_por_chefe = true WHERE pagamento_realizado = true` — corrige o backfill dos 219 registros existentes.

### 2. Reestruturar as abas internas (3 abas em vez de 2)

| Aba | Conteúdo |
|-----|----------|
| **Pendentes e pagos recentemente** | Fichas pendentes + pagas dentro de 1 dia útil OU não vistas pelo chefe |
| **Pagos Recentemente** | Todos os pagos dos últimos 5 dias úteis (sem pendentes) |
| **Problemas Reportados** | Fichas que têm `[PROBLEMA PAGAMENTO` nas notas |

### 3. Renomear tab "Pendentes e Recentes" → "Pendentes e pagos recentemente"

### 4. Aba "Problemas Reportados"
- Filtrar fichas cujas `notas` contenham `[PROBLEMA PAGAMENTO` 
- Mostrar o texto do problema extraído das notas
- Cards com visual diferenciado (borda vermelha/amber)

### 5. Aba "Pagos Recentemente"
- Fichas pagas nos últimos 5 dias úteis
- Sem pendentes misturados
- Visual simplificado similar ao histórico atual

### Arquivos Modificados
- `src/components/financeiro/PagamentoClientesTabV2.tsx` — reestruturar abas, adicionar aba problemas
- Migração SQL — backfill `pagamento_visto_por_chefe`

