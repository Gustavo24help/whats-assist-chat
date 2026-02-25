

# Ordenacao Alfabetica na Tabela de Prestadores

## O que sera feito

Adicionar botoes de ordenacao clicaveis nos cabecalhos "Nome" e "Categoria" da tabela de prestadores. Ao clicar, a lista sera ordenada alfabeticamente (A-Z ou Z-A), ignorando numeros no inicio/meio do texto para evitar que prefixos numericos (ex: "321 Joao") interfiram na ordenacao.

## Como funciona

- Clicar no cabecalho "Nome" ordena por nome (A-Z). Clicar novamente inverte (Z-A).
- Clicar no cabecalho "Categoria" ordena por categoria, mesma logica.
- Um icone de seta indica a direcao atual da ordenacao.
- Campos CPF, Telefone e ID CRM nao terao ordenacao.

## Detalhes tecnicos

**Arquivo:** `src/components/PrestadorManagement.tsx`

1. Adicionar estado de ordenacao:
```text
sortField: "nome" | "categoria" | null
sortDirection: "asc" | "desc"
```

2. Criar funcao de comparacao que remove digitos antes de comparar:
```text
// Remove numeros para comparacao
const stripNumbers = (str: string) => str.replace(/\d/g, "").trim();
// Comparar: stripNumbers("321 Joao") => "Joao"
```

3. Aplicar `useMemo` para gerar `sortedPrestadores` a partir de `prestadores` + estado de sort, sem alterar o array original.

4. Nos `TableHead` de "Nome" e "Categoria", adicionar `onClick` + icone `ArrowUpDown` / `ArrowUp` / `ArrowDown` do lucide-react para indicar estado.

5. Renderizar `sortedPrestadores` no lugar de `prestadores` no `TableBody`.

**Impacto:** Apenas ordenacao visual no frontend. Nenhum dado e modificado. A busca ao banco continua igual (`.order("nome")`).
