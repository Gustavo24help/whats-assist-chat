

# Plan: Toggle para Edição Manual do Valor Total

## Resumo
Adicionar um checkbox/switch ao lado do campo "Valor Total" que permite alternar entre modo automático (calculado) e modo manual (editável). No modo manual, exibir um alerta de cautela. No modo automático, o cálculo acontece sozinho como hoje.

## Mudanças

### 1. FichaServicoTab.tsx - Campo Valor Total (linhas ~1390-1435)

**Adicionar estado local**: `editarManualmente` (boolean, default false)

**Substituir o campo atual por**:
- Um Switch/Checkbox com label "Editar manualmente" ao lado do label "Valor Total"
- Quando **desmarcado** (padrão): campo read-only com fundo cinza, cálculo automático (comportamento atual)
- Quando **marcado**: campo editável, fundo branco, e exibir um Alert amarelo/warning abaixo dizendo:
  > "⚠ Atenção: Editar o valor total manualmente desativa o cálculo automático. Use com cautela e verifique se o valor está correto."

**Quando desmarcar o switch**: recalcular o valor total automaticamente (chamar a mesma lógica de cálculo que já existe no `updateFicha`)

### 2. Ajuste no updateFicha (linha ~673-694)

Condicionar o auto-cálculo: só recalcular `valor_total` se `editarManualmente` for false. Se o usuário estiver em modo manual, não sobrescrever o valor.

### 3. Permitir onChange no Input quando manual

Quando `editarManualmente` for true, o Input do valor_total terá um `onChange` que chama `updateFicha({ valor_total: novoValor })` sem disparar o recálculo.

## Arquivos modificados
- `src/components/FichaServicoTab.tsx` — único arquivo alterado

