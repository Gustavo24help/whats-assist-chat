

# Plano: Etapa 2 - Sistema de Tickets por Usuario

## Objetivo

Implementar controle de acesso baseado em roles para que:
- **Usuarios comuns** vejam apenas seus proprios tickets e possam "puxar" tickets sem dono
- **Supervisores/Admins** vejam todos os tickets e possam reatribuir qualquer um

---

## Analise do Estado Atual

### Estrutura Existente
- Tabela `clientes` ja tem campo `atendente_id` (UUID, nullable)
- Enum `app_role` possui apenas: `admin`, `user`
- AuthContext retorna `isAdmin` (true/false)
- ConversationList busca todos os clientes sem filtro de atendente

### O que precisa mudar

| Componente | Alteracao |
|------------|-----------|
| Banco de dados | Adicionar `supervisor` ao enum `app_role` |
| AuthContext | Adicionar `isSupervisor` ao contexto |
| ConversationList | Adicionar toggle "Meus Tickets" e logica de filtro |
| ChatWindow | Ajustar botao "Assumir" para respeitar permissoes |
| UserManagement | Permitir atribuir role `supervisor` |

---

## Alteracoes Detalhadas

### 1. Migracao SQL

Adicionar nova role ao enum existente:

```sql
ALTER TYPE app_role ADD VALUE 'supervisor';
```

### 2. AuthContext.tsx

Modificacoes:
- Adicionar `isSupervisor: boolean` ao contexto
- Atualizar tipo `UserProfile.role` para incluir `'supervisor'`
- Logica: supervisor pode ver/puxar todos, mas nao gerenciar usuarios

```typescript
interface UserProfile {
  role: 'admin' | 'supervisor' | 'user';
}

// No provider:
const isSupervisor = userProfile?.role === 'supervisor' || userProfile?.role === 'admin';
```

### 3. ConversationList.tsx

Novo toggle "Meus Tickets" no cabecalho:

```text
[Meus Tickets] | [Todos]  (visivel para supervisors/admins)
```

Logica de filtro:

```text
SE role = 'user':
  - Sempre filtra: atendente_id = user.id OU atendente_id IS NULL
  - Nao mostra toggle (so ve os proprios)

SE role = 'supervisor' ou 'admin':
  - Mostra toggle
  - "Meus Tickets": atendente_id = user.id
  - "Todos": sem filtro
```

Query modificada:

```typescript
// Construir query base
let query = supabase.from('clientes').select('*');

// Aplicar filtro de atendente baseado na role
if (userRole === 'user') {
  // User so ve seus tickets ou sem dono
  query = query.or(`atendente_id.eq.${userId},atendente_id.is.null`);
} else if (showOnlyMyTickets) {
  // Supervisor/Admin filtrando por "Meus Tickets"
  query = query.eq('atendente_id', userId);
}
// Senao, supervisor/admin vendo todos (sem filtro adicional)
```

### 4. ChatWindow.tsx

Ajustar logica do botao "Assumir" / "Atribuir":

```text
SE ticket.atendente_id IS NULL:
  - Qualquer um pode "Assumir" (atribui para si mesmo)

SE ticket.atendente_id = outro_usuario:
  - user: NAO pode reatribuir (botao desabilitado ou oculto)
  - supervisor/admin: PODE reatribuir (mostra dropdown de atendentes)
```

### 5. UserManagement.tsx

Adicionar opcao "Supervisor" no dropdown de roles ao criar/editar usuarios.

---

## Interface do Usuario

### ConversationList - Novo Toggle

```text
+----------------------------------------+
| Conversas           [Meus] [Todos]  ⚙ |
+----------------------------------------+
| 🔍 Buscar...                           |
| [Filtros...]                           |
+----------------------------------------+
| João Silva          14:30    🟢        |
| Maria Santos        12:15    🟡        |
| Pedro Oliveira      ontem    🔴        |
+----------------------------------------+
```

Para usuarios comuns (role = user), o toggle NAO aparece - eles sempre veem apenas seus tickets + nao atribuidos.

### ChatWindow - Indicador de Atendente

No cabecalho da conversa, exibir quem esta atendendo:

```text
+----------------------------------------+
| ← João Silva                [Assumir]  |
|   Atendente: Carlos (você)             |
+----------------------------------------+
```

Se for de outro atendente e o usuario for comum:

```text
+----------------------------------------+
| ← João Silva           [Atribuído a:   |
|   Ana Paula                        🔒] |
+----------------------------------------+
```

---

## Matriz de Permissoes Final

```text
+------------------+----------+-------------+----------+
| Acao             | user     | supervisor  | admin    |
+------------------+----------+-------------+----------+
| Ver tickets      | Proprios | Todos       | Todos    |
|                  | + NULL   |             |          |
+------------------+----------+-------------+----------+
| Puxar ticket     | So NULL  | Qualquer    | Qualquer |
+------------------+----------+-------------+----------+
| Toggle "Todos"   | Nao      | Sim         | Sim      |
+------------------+----------+-------------+----------+
| Gerenciar users  | Nao      | Nao         | Sim      |
+------------------+----------+-------------+----------+
```

---

## Arquivos a Modificar

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| Nova migracao SQL | Criar | Adicionar 'supervisor' ao enum |
| `src/contexts/AuthContext.tsx` | Modificar | Adicionar isSupervisor |
| `src/components/ConversationList.tsx` | Modificar | Toggle + filtro de tickets |
| `src/components/ChatWindow.tsx` | Modificar | Logica de atribuicao |
| `src/components/UserManagement.tsx` | Modificar | Opcao supervisor no form |

---

## Tratamento de Casos Especiais

| Caso | Tratamento |
|------|------------|
| Usuario sem tickets atribuidos | Mostra lista vazia com mensagem explicativa |
| Ticket sendo visualizado por outro | Permitir visualizacao, bloquear edicao (opcional) |
| Usuario promovido a supervisor | Acesso expandido imediatamente |
| Usuario rebaixado de supervisor | Perde acesso aos tickets de outros |

---

## Secao Tecnica

### Migracao Segura do Enum

PostgreSQL permite adicionar valores ao enum mas nao remover. A migracao e:

```sql
-- Verificar se ja existe antes de adicionar
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'supervisor' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    ALTER TYPE app_role ADD VALUE 'supervisor';
  END IF;
END $$;
```

### AuthContext - Alteracoes

```typescript
interface AuthContextType {
  // ... existentes
  isSupervisor: boolean; // NOVO
}

// Calculo:
const isSupervisor = userProfile?.role === 'supervisor' || userProfile?.role === 'admin';
```

### ConversationList - Integracao com AuthContext

```typescript
import { useAuth } from "@/contexts/AuthContext";

const { user, isAdmin, isSupervisor } = useAuth();
const [showOnlyMyTickets, setShowOnlyMyTickets] = useState(true);

// No filtro:
const canSeeAllTickets = isAdmin || isSupervisor;
```

### Impacto em Dados Existentes

**NENHUM!** 
- Clientes sem `atendente_id` continuam visiveis para todos
- Clientes com `atendente_id` ja atribuido continuam visveis pelo atendente
- Supervisors/Admins podem ver tudo (comportamento atual mantido)

