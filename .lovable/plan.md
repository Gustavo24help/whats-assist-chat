

# Diagnóstico e Correção — /prestadores (Relatório de Prestadores)

## Bugs Encontrados

### Bug 1: "Serviços" conta fichas SEM orçamento aprovado
**Causa**: `totalServicos` conta TODAS as fichas "Finalizado" atribuídas ao prestador (linha 207), mas 37 de 275 fichas finalizadas (13%) não possuem nenhum orçamento aprovado correspondente. Isso acontece porque algumas fichas são atribuídas diretamente a prestadores sem passar pelo fluxo de orçamento (ex: fichas FGM, fichas manuais). Isso é **comportamento correto** — serviços existem sem orçamento. Porém, a UI deveria deixar claro que "Serviços" != "Orçamentos Aceitos".

### Bug 2: "Não Aprovados" aparece como 0 (INCORRETO)
**Causa**: O código (linha 219-226) verifica `o.status === "rejeitado" || o.status === "Não Aprovado"`. O status `"Não Aprovado"` NÃO existe no enum — os valores reais são: `pendente`, `aprovado`, `rejeitado`. Logo, rejeitados com status `"rejeitado"` deveriam ser contados corretamente. **Porém**, a condição adicional na linha 221-224 conta orçamentos `aprovado` de outro prestador como rejeitado — e esses dependem do `fichasParaOrcamentos` estar populado, o que está. 

O verdadeiro problema: **o filtro de período está cortando**. Quando `periodoFiltro = "mes_atual"`, os orçamentos são filtrados por `data_criacao` no mês atual. Os rejeitados de meses anteriores não aparecem. Os rejeitados do mês atual existem (134 no total neste mês), mas a lógica de contagem depende de `fichasParaOrcamentos` conter a ficha — e fichas que estão com status "Perdido" ou "Ficha Criada" NÃO são carregadas na query principal de fichas (linha 147: `IN ('Finalizado', 'Agendado', 'Em andamento')`).

**Resultado**: Orçamentos rejeitados de fichas que ficaram como "Perdido" não são contados, porque `fichasParaOrcamentos` não tem essas fichas (a query de fichas para orçamentos usa IDs dos orçamentos, mas a lógica de "rejeitado" para aprovados-com-outro-prestador depende de `ficha.prestador_id`, que pode ser null para fichas perdidas).

### Bug 3: Tempo de Resposta NULL
**Causa**: O cálculo (linhas 236-244) compara `ficha.created_at` com `orc.data_criacao`. Dados do banco mostram que EXISTEM tempos válidos (25min, 42min, 1222min, etc.). O problema é que `fichasParaOrcamentos` só é populado com fichas cujos IDs aparecem em orçamentos — **mas 2 orçamentos têm `data_criacao` NULL**, e mais importante: quando o filtro de período corta os orçamentos, os IDs de fichas correspondentes também são cortados do mapa. Se um prestador tem orçamentos mas todos fora do período filtrado, `fichasParaOrcamentos` pode estar vazio para ele.

**Diagnóstico confirmado**: O tempo de resposta DEVERIA funcionar para prestadores com orçamentos no período atual. Se está aparecendo como N/A para TODOS, o problema está provavelmente no fato de que `fichasParaOrcamentos` é populado UMA VEZ no `fetchData()` com TODOS os orçamentos, mas os orçamentos filtrados no `useMemo` são um subconjunto — porém a contagem de tempo usa `orcamentosDoPrestador` que é dos filtrados. Se `fichasParaOrcamentos` contém a ficha (populado do dataset completo), deveria funcionar. **O bug real**: muitos orçamentos não têm uma ficha correspondente no mapa porque a query `fichasParaOrcamentos` busca por `o.ficha_nome` mas se o orçamento não tem ficha (ficha deletada ou ID errado), retorna null.

### Bug 4: Mão de Obra e Peças com valores suspeitos
**Causa**: `valorTotalMaoObra` e `valorTotalPecas` somam de `fichasFinalizadas` (linhas 231-232). Os dados do banco mostram que **algumas fichas têm valor_mao_obra = 0 e valor_pecas = 0 mas valor_total > 0** (ex: FS9-260317 tem total=0, FGM3@260305 tem total=0). Também há fichas onde `valor_total` é o valor arredondado para o cliente, não a soma simples de mão de obra + peças. O `valor_total` na ficha é o **valor cobrado do cliente** (com margem), enquanto `valor_mao_obra` e `valor_pecas` são os custos do prestador. Isso está correto, mas a UI pode confundir.

### Bug 5: Ticket Médio
**Causa**: `ticketMedio = valorTotal / fichasFinalizadas.length` (linha 233). `valorTotal` é a soma de `valor_total` (valor ao cliente). Incluindo fichas com `valor_total = 0`, isso dilui a média. Média real do banco: R$ 339,13 considerando todas as 255 finalizadas, mas fichas com valor 0 puxam para baixo.

## Correções Propostas

### 1. Corrigir contagem de "Não Aprovados" (rejeitados)
- Contar orçamentos com `status === "rejeitado"` diretamente, sem depender de `fichasParaOrcamentos`
- Remover a verificação `"Não Aprovado"` que não existe no enum
- Para orçamentos `aprovado` de outro prestador: manter a lógica mas tratar o caso onde `ficha.prestador_id` é null

### 2. Corrigir Tempo de Resposta
- Garantir que `fichasParaOrcamentos` é populado para TODOS os orçamentos (não só os filtrados)
- Tratar `data_criacao` null (2 orçamentos)
- Usar os dados já corretamente carregados — o bug pode ser que `fichasParaOrcamentos` não está encontrando fichas por causa de IDs que não existem mais

### 3. Ticket Médio: excluir fichas com valor_total = 0
- Filtrar fichas com `valor_total > 0` ao calcular ticket médio

### 4. Mão de Obra e Peças: usar `transacoes_financeiras` como fonte de verdade
- Os valores de mão de obra e peças na `fichas_de_servico` são os valores do prestador, não do cliente
- Idealmente cruzar com `transacoes_financeiras` para dados financeiros mais precisos
- Alternativa simples: manter fichas como fonte mas documentar na UI que são "custos do prestador"

### 5. Clarificar UI
- Na tabela, separar claramente "Serviços Executados" de "Orçamentos Aceitos"
- Mostrar "Rejeitados" usando contagem direta de `status = 'rejeitado'`

## Arquivos a Modificar
- `src/pages/PrestadoresReport.tsx` — correções na lógica de cálculo das métricas

