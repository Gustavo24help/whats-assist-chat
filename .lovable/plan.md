
# Correção: Busca por ID de Ficha Ignora Filtro de Status

## Problema Identificado

A ficha **FS2-260112** existe e pertence ao cliente `whatsapp:+554198739924`. Porém:

1. A ficha tem status **"Finalizado"**
2. O filtro padrão **"Ativas"** está ativo
3. O filtro de status é aplicado **antes** de considerar os resultados da busca
4. Resultado: a conversa é encontrada pela busca, mas **removida** pelo filtro

## Solução

Quando o usuário estiver buscando por **ID de ficha** (`searchMode === 'id_ficha'`), ignorar automaticamente o filtro de Ativas/Inativas para garantir que o resultado apareça.

## Arquivo a Modificar

`src/components/ConversationList.tsx`

## Mudança Específica

Na linha ~182-188, adicionar condição para ignorar o filtro quando busca por ID:

```typescript
// Filtro de conversas ativas/inativas por status da ficha
// IGNORAR quando buscando por ID de ficha para garantir que resultado apareça
if (conversaStatusFilter === "ativas" && !(searchMode === 'id_ficha' && debouncedSearchTerm)) {
  filtered = filtered.filter(c => c.status_ficha && !STATUS_INATIVOS.includes(c.status_ficha));
} else if (conversaStatusFilter === "inativas" && !(searchMode === 'id_ficha' && debouncedSearchTerm)) {
  filtered = filtered.filter(c => STATUS_INATIVOS.includes(c.status_ficha || "") || !c.status_ficha);
}
```

## Resultado Esperado

Ao buscar "FS2-260112" no modo de busca por ID (#), a conversa aparecerá **independentemente** de estar configurado para mostrar "Ativas", "Inativas" ou "Todas".

## Alternativa Visual

Opcionalmente, posso adicionar um badge/indicador mostrando que o filtro de status foi temporariamente ignorado durante a busca por ID.
