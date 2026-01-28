

# Correção: Busca por ID de Ficha Ignora Filtro de Atendente

## Problema Identificado

A ficha **FS2-260112** está sendo encontrada corretamente pela busca e retorna o telefone `whatsapp:+554198739924`. No entanto:

1. A conversa está atribuída a outro atendente (`cac6e28a-fa91-4c6d-a3c8-5f2804b18304`)
2. O filtro de permissões por atendente é aplicado **antes** dos resultados da busca serem exibidos
3. Se você não é supervisor/admin ou não é o dono da conversa, ela é removida
4. Resultado: a conversa é encontrada pela busca, mas **removida** pelo filtro de permissões

## Solução

Quando o usuário estiver buscando por **ID de ficha** (`searchMode === 'id_ficha'`), ignorar também o filtro de atendente para garantir que o resultado apareça.

## Arquivo a Modificar

`src/components/ConversationList.tsx`

## Mudanças Específicas

### Mudança 1: Ignorar filtro de atendente quando buscando por ID

Na linha ~166-179, adicionar condição para ignorar o filtro de atendente quando busca por ID de ficha:

```typescript
// Variável que indica se deve ignorar os filtros para busca por ID
const ignorarFiltrosBuscaId = searchMode === 'id_ficha' && debouncedSearchTerm;

// Filtro por atendente baseado na role do usuário
// IGNORAR quando buscando por ID de ficha para garantir que resultado apareça
if (user && !ignorarFiltrosBuscaId) {
  if (!isSupervisor) {
    filtered = filtered.filter(c => 
      c.atendente_id === user.id || c.atendente_id === null
    );
  } else if (ticketView === "meus") {
    filtered = filtered.filter(c => c.atendente_id === user.id);
  }
}
```

### Mudança 2: Consolidar a variável de ignorar filtros (já existe para status)

Reutilizar a mesma variável `ignorarFiltroStatus` tanto para o filtro de status quanto para o de atendente, renomeando para `ignorarFiltrosBuscaId` para maior clareza:

```typescript
const ignorarFiltrosBuscaId = searchMode === 'id_ficha' && debouncedSearchTerm;
```

## Técnico: Sequência de Filtros no Código

1. Filtro de atendente (linhas 166-179) - **será ignorado** na busca por ID
2. Filtro de status ativa/inativa (linhas 181-192) - **já está sendo ignorado**
3. Outros filtros (bot, tags, pagamento, etc) - mantidos normalmente

## Resultado Esperado

Ao buscar "FS2-260112" no modo de busca por ID (#), a conversa aparecerá independentemente:
- De quem é o atendente atual
- Do status da ficha (Ativa/Inativa/Finalizada)

## Comportamento na Abertura

Quando o usuário clicar na conversa encontrada:
- A conversa abrirá normalmente
- As regras de permissão de escrita continuarão funcionando (se não for seu ticket, verá como somente leitura com opção "Assumir")

