

# Correção da Receita Total e Lucro Bruto no Dashboard TV

## Problemas Encontrados

### 1. Receita Total exclui fichas finalizadas sem pagamento marcado
A query atual filtra `status = 'Finalizado' AND pagamento_realizado = true`, resultando em apenas 22 fichas (R$ 7.440). Porém existem 32 fichas finalizadas em fevereiro totalizando **R$ 9.887**. As 10 fichas restantes (R$ 2.447) estao sendo ignoradas porque `pagamento_realizado = false`.

| Filtro | Fichas | Valor |
|--------|--------|-------|
| Finalizado + Pago | 22 | R$ 7.440 |
| Finalizado (todos) | 32 | R$ 9.887 |
| **Diferenca ignorada** | **10** | **R$ 2.447** |

### 2. Lucro Bruto com formula errada (ainda nao foi corrigido)
Linha 365 do hook ainda calcula: `receitaTotal - totalPecas` (9.887 - 234 = 9.653).
O correto seria: `receitaTotal - totalMaoObra - totalPecas` (9.887 - 7.332 - 234 = **R$ 2.321**, margem ~23%).

## Plano de Alteracoes

### Arquivo: `src/hooks/useDashboardTV.ts`

**Alteracao 1 - Query de receita**: Remover o filtro `.eq('pagamento_realizado', true)` da query de fichas finalizadas (linha 272). "Receita Total" = todas as fichas com status Finalizado, independente de pagamento marcado.

Aplicar a mesma mudanca na query do periodo anterior (linha 314).

**Alteracao 2 - Formula do lucro bruto** (linha 365):
- De: `totalMaoObra > 0 ? receitaTotal - totalPecas : receitaTotal * 0.6`
- Para: `(totalMaoObra > 0 || totalPecas > 0) ? receitaTotal - totalMaoObra - totalPecas : receitaTotal * 0.23`

Aplicar a mesma correcao na formula do periodo anterior (linha ~444).

### Arquivo: `src/hooks/useDashboardSummary.ts`

Aplicar as mesmas duas correcoes para manter consistencia entre os dashboards:
- Remover filtro `pagamento_realizado = true` das queries de receita
- Corrigir formula de lucro liquido

### Resultado Esperado

| Metrica | Antes (errado) | Depois (correto) |
|---------|----------------|-------------------|
| Receita Total | R$ 7.440 | R$ 9.887 |
| Lucro Bruto | R$ 7.246 | R$ 2.321 |
| Margem | 97% | ~23% |

### Impacto nos dados existentes

Nenhum. Os campos `valor_total`, `valor_mao_obra` e `valor_pecas` na base permanecem intactos. A mudanca e apenas no calculo em tempo real para exibicao.

### Nota sobre "Servicos Fechados / Pagos"

O KPI de "Pagos" no funil continuara filtrando por `pagamento_realizado = true` (22 fichas), pois esse e o significado correto do passo "Pago" no funil de vendas. Apenas a **Receita Total** e o **Lucro Bruto** passarao a considerar todos os finalizados.

