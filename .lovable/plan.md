

# Bug: Ranking de Prestadores mostrando 0 para filtro "Mês"

## Causa Raiz

A tabela `orcamentos` tem **1673 registros**, mas a query do Supabase no `fetchData()` (linha 217-219) **não especifica nenhum limite**, fazendo o Supabase aplicar o limite padrão de **1000 linhas**. Isso significa que ~673 orçamentos são silenciosamente descartados.

Como a ordenação padrão do Supabase tende a retornar registros mais antigos primeiro, muitos orçamentos de março (mês atual) ficam de fora dos 1000 retornados. Quando o filtro "Este Mês" é aplicado no `orcamentosFiltrados`, quase todos os orçamentos do mês estão faltando, resultando em **0 enviados** para todos os prestadores.

O mesmo problema pode afetar a query de `fichas_de_servico` (linha 211-215), que atualmente retorna fichas com 4 status diferentes e provavelmente também excede 1000 registros.

## Dados confirmados
- 420 orçamentos existem em março 2026 (134 aprovados, 150 pendentes, 136 rejeitados)
- Top prestador tem 54 orçamentos enviados este mês
- Query retorna apenas 1000 dos 1673 totais

## Correção

### `src/pages/PrestadoresReport.tsx` — `fetchData()`

1. **Queries paginadas**: Para ambas as queries (`orcamentos` e `fichas_de_servico`), implementar fetch paginado para garantir que TODOS os registros sejam carregados:

```typescript
// Helper para buscar todos os registros sem limite de 1000
const fetchAll = async (table, selectQuery, filters) => {
  let allData = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data } = await supabase
      .from(table)
      .select(selectQuery)
      ...filters
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
};
```

2. Aplicar a paginação nas 3 queries:
   - `orcamentos` (1673 registros, excede 1000)
   - `fichas_de_servico` principal (potencialmente excede 1000)
   - `fichas_de_servico` para mapa de orçamentos (busca por IDs, pode exceder 1000)

## Impacto
- Todos os orçamentos serão carregados independente do volume
- O ranking e contagens refletirão os dados reais
- Filtro "Este Mês" passará a mostrar os 420 orçamentos corretamente

