
# Plano: Melhorias no Sistema de Tickets e Conversas

## Resumo das Funcionalidades Solicitadas

1. **Leitura sem escrita** - Quando uma conversa nao esta atribuida a ninguem, a pessoa pode ler, mas NAO pode escrever
2. **Atribuicao em massa** - Permitir selecionar multiplas conversas e atribuir todas a outro operador de uma vez
3. **Filtro de conversas ativas/inativas** - Ocultar conversas com status "Finalizado" ou "Perdido" por padrao
4. **Conversas inativas** - Status "Finalizado" ou "Perdido" na ficha marca a conversa como inativa

---

## Analise do Estado Atual

### Campos Relevantes no Banco
- `clientes.atendente_id` (UUID) - Quem esta atendendo
- `clientes.status_conversa` - "aberta" ou "fechada"
- `fichas_de_servico.status` - Status do servico (incluindo "Finalizado" e "Perdido")

### Status que tornam conversa inativa
- "Finalizado"
- "Perdido"
- "Nao foi adiante"

### Arquivos a Modificar
| Arquivo | Alteracao |
|---------|-----------|
| `ConversationList.tsx` | Adicionar toggle ativas/inativas + checkbox para selecao em massa |
| `ChatWindow.tsx` | Bloquear area de input quando `atendente_id` nao pertence ao usuario |
| `Chat.tsx` | Adicionar painel/modal de atribuicao em massa |

---

## Alteracoes Detalhadas

### 1. Bloqueio de Escrita para Conversas sem Atribuicao

**Logica:**
- Se `atendente_id IS NULL` E usuario nao e supervisor: PODE LER, NAO PODE ESCREVER
- Se `atendente_id = outro_usuario`: PODE LER, NAO PODE ESCREVER (para usuarios comuns)
- Se `atendente_id = user.id` OU usuario e supervisor: PODE LER E ESCREVER

**Interface em ChatWindow.tsx:**

A area de input (linha 1860-1922) sera desabilitada com uma mensagem explicativa:

```text
+-----------------------------------------------------+
|  Esta conversa nao esta atribuida a voce.           |
|  [Assumir para mim] para poder responder.           |
+-----------------------------------------------------+
```

Para tickets de outros atendentes (usuarios comuns):

```text
+-----------------------------------------------------+
|  Esta conversa esta atribuida a [Nome].             |
|  Voce pode ler, mas nao pode responder.       [🔒]  |
+-----------------------------------------------------+
```

### 2. Filtro de Conversas Ativas/Inativas

**Novo toggle na ConversationList:**

```text
[Ativas] | [Inativas] | [Todas]
```

**Logica de filtragem:**
- **Ativas**: `status_ficha` NAO e "Finalizado", "Perdido", ou "Nao foi adiante"
- **Inativas**: `status_ficha` e "Finalizado", "Perdido", ou "Nao foi adiante"
- **Todas**: Sem filtro por status

**Implementacao:**

```typescript
// Novo estado
const [conversaStatusFilter, setConversaStatusFilter] = useState<"ativas" | "inativas" | "todas">("ativas");

// Status que indicam conversa inativa
const STATUS_INATIVOS = ["Finalizado", "Perdido", "Não foi adiante"];

// No filteredClientes
if (conversaStatusFilter === "ativas") {
  filtered = filtered.filter(c => !STATUS_INATIVOS.includes(c.status_ficha || ""));
} else if (conversaStatusFilter === "inativas") {
  filtered = filtered.filter(c => STATUS_INATIVOS.includes(c.status_ficha || ""));
}
```

### 3. Atribuicao em Massa

**Novo modo de selecao na ConversationList:**

Adicionar um botao "Selecionar" que ativa o modo de selecao multipla:

```text
+----------------------------------------+
| Conversas [Meus][Todos] [☐ Selecionar] |
+----------------------------------------+
| ☐ Joao Silva          14:30           |
| ☐ Maria Santos        12:15           |
| ☑ Pedro Oliveira      ontem           |
| ☑ Ana Paula           ontem           |
+----------------------------------------+
| [2 selecionados] [Atribuir para ▼]    |
+----------------------------------------+
```

**Estados necessarios:**

```typescript
const [selectionMode, setSelectionMode] = useState(false);
const [selectedClientes, setSelectedClientes] = useState<Set<string>>(new Set());
```

**Componentes:**
- Checkbox em cada item da lista (visivel apenas no modo selecao)
- Barra de acoes na parte inferior com:
  - Contador de selecionados
  - Dropdown de atendentes
  - Botao "Atribuir"
  - Botao "Cancelar"

**Funcao de atribuicao em massa:**

```typescript
const atribuirEmMassa = async (operadorId: string) => {
  const telefones = Array.from(selectedClientes);
  
  const { error } = await supabase
    .from('clientes')
    .update({ atendente_id: operadorId })
    .in('telefone', telefones);

  if (error) {
    toast.error('Erro ao atribuir conversas');
  } else {
    toast.success(`${telefones.length} conversas atribuidas`);
    setSelectedClientes(new Set());
    setSelectionMode(false);
  }
};
```

---

## Interface Final

### ConversationList - Cabecalho Atualizado

```text
+--------------------------------------------------+
| Conversas [Meus][Todos]                          |
+--------------------------------------------------+
| [Ativas ▼] [☐ Selecionar]                        |
+--------------------------------------------------+
| 🔍 Buscar...                                     |
+--------------------------------------------------+
```

### ConversationList - Modo Selecao Ativo

```text
+--------------------------------------------------+
| Conversas                    [Cancelar Selecao]  |
+--------------------------------------------------+
| [Ativas ▼]                                       |
+--------------------------------------------------+
| ☐ Joao Silva          14:30    🟢               |
| ☑ Maria Santos        12:15    🟡               |
| ☑ Pedro Oliveira      ontem    🔴               |
+--------------------------------------------------+
| 2 conversas selecionadas                         |
| [Atribuir para: Carlos ▼]        [Confirmar]    |
+--------------------------------------------------+
```

### ChatWindow - Area de Input Bloqueada

Quando o usuario nao pode escrever:

```text
+--------------------------------------------------+
| ⚠ Esta conversa nao esta atribuida a voce       |
|                                                  |
|   Clique em "Assumir para mim" no menu acima    |
|   para poder responder a esta conversa.         |
|                                                  |
|              [Assumir para mim]                  |
+--------------------------------------------------+
```

---

## Matriz de Permissoes Atualizada

```text
+-----------------------+----------+-------------+----------+
| Acao                  | user     | supervisor  | admin    |
+-----------------------+----------+-------------+----------+
| LER conversa sem dono | Sim      | Sim         | Sim      |
+-----------------------+----------+-------------+----------+
| ESCREVER sem dono     | NAO*     | Sim         | Sim      |
+-----------------------+----------+-------------+----------+
| ESCREVER meu ticket   | Sim      | Sim         | Sim      |
+-----------------------+----------+-------------+----------+
| ESCREVER ticket outro | NAO      | Sim         | Sim      |
+-----------------------+----------+-------------+----------+
| Atribuicao em massa   | Proprios | Qualquer    | Qualquer |
+-----------------------+----------+-------------+----------+
| Ver todas conversas   | NAO      | Sim         | Sim      |
+-----------------------+----------+-------------+----------+

* Usuario comum precisa "Assumir" primeiro
```

---

## Secao Tecnica

### Alteracoes em ChatWindow.tsx

1. Adicionar verificacao de permissao de escrita:

```typescript
// Verificar se pode escrever
const canWrite = 
  // Meu ticket
  atendenteAtual?.id === user?.id || 
  // Supervisor pode escrever em qualquer
  isSupervisor;

// Verificar se precisa assumir primeiro
const needsToAssume = !atendenteAtual && !isSupervisor;
```

2. Modificar a area de input (linhas 1817-1924):

```typescript
{canWrite ? (
  // Area de input normal
  <div className="flex gap-2">...</div>
) : (
  // Mensagem de bloqueio
  <div className="p-4 bg-muted/50 rounded-lg text-center">
    {needsToAssume ? (
      <>
        <Lock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">
          Esta conversa nao esta atribuida a voce
        </p>
        <Button onClick={assumirParaMim}>
          <UserCheck className="h-4 w-4 mr-2" />
          Assumir para mim
        </Button>
      </>
    ) : (
      <>
        <Lock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Atribuido a {atendenteAtual?.nome}
        </p>
        <p className="text-xs text-muted-foreground">
          Voce pode ler, mas nao pode responder
        </p>
      </>
    )}
  </div>
)}
```

### Alteracoes em ConversationList.tsx

1. Novos estados:

```typescript
const [conversaStatusFilter, setConversaStatusFilter] = useState<"ativas" | "inativas" | "todas">("ativas");
const [selectionMode, setSelectionMode] = useState(false);
const [selectedClientes, setSelectedClientes] = useState<Set<string>>(new Set());
```

2. Status inativos:

```typescript
const STATUS_INATIVOS = ["Finalizado", "Perdido", "Não foi adiante"];
```

3. Modificar filteredClientes:

```typescript
// Filtro de conversas ativas/inativas
if (conversaStatusFilter === "ativas") {
  filtered = filtered.filter(c => !STATUS_INATIVOS.includes(c.status_ficha || ""));
} else if (conversaStatusFilter === "inativas") {
  filtered = filtered.filter(c => STATUS_INATIVOS.includes(c.status_ficha || ""));
}
```

4. Componente de selecao em massa no final da lista:

```typescript
{selectionMode && selectedClientes.size > 0 && (
  <div className="p-3 border-t bg-background sticky bottom-0 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">
        {selectedClientes.size} conversa(s) selecionada(s)
      </span>
      <Button 
        variant="ghost" 
        size="sm"
        onClick={() => {
          setSelectedClientes(new Set());
          setSelectionMode(false);
        }}
      >
        Cancelar
      </Button>
    </div>
    <div className="flex gap-2">
      <Select onValueChange={atribuirEmMassa}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Atribuir para..." />
        </SelectTrigger>
        <SelectContent>
          {atendentes.map(a => (
            <SelectItem key={a.id} value={a.id}>
              {a.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
)}
```

---

## Impacto em Dados Existentes

**NENHUM IMPACTO!**

- Nenhuma alteracao no banco de dados e necessaria
- Todas as funcionalidades sao implementadas via logica de frontend
- Conversas existentes continuam funcionando normalmente
- O filtro padrao "Ativas" apenas oculta visualmente as conversas inativas

---

## Arquivos a Modificar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/ChatWindow.tsx` | Bloquear area de input para usuarios sem permissao |
| `src/components/ConversationList.tsx` | Toggle ativas/inativas + modo selecao em massa |
| `src/components/ConversationCard.tsx` | Adicionar checkbox para modo selecao |

