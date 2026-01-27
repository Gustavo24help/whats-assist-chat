

# Plano: Sistema de Tickets, Permissoes e Resumo de Conversa

## Visao Geral

Implementacao em **3 etapas progressivas** para nao quebrar funcionalidades existentes:

| Etapa | Funcionalidade | Complexidade |
|-------|---------------|--------------|
| **1** | Resumo de Conversa com IA | Media |
| **2** | Filtro "Meus Tickets" e Puxar Tickets | Media |
| **3** | Delegacao em Massa + KPIs por Usuario | Alta |

---

## Etapa 1: Resumo de Conversa com IA

### Objetivo
Adicionar botao "Gerar Resumo" nas fichas de servico que usa IA para gerar um resumo estruturado.

### Logica de Captura
- Buscar mensagens do cliente a partir de **00:00 do dia de criacao da ficha**
- Delimitar ate a criacao da proxima ficha (se existir) ou data atual

### Alteracoes

| Arquivo | Acao |
|---------|------|
| `supabase/functions/summarize-conversation/index.ts` | Criar |
| `src/components/FichaServicoTab.tsx` | Modificar (adicionar botao e dialog) |

### Edge Function

```text
1. Receber ficha_id
2. Buscar ficha -> telefone_cliente, created_at
3. Calcular inicio: DATE_TRUNC('day', created_at)
4. Buscar proxima ficha do cliente (se existir)
5. Buscar mensagens no periodo (limite: 150)
6. Enviar para Gemini 2.5 Flash com prompt estruturado
7. Retornar resumo formatado
```

---

## Etapa 2: Sistema de Tickets por Usuario

### Objetivo
Permitir que usuarios vejam apenas seus tickets e possam "puxar" tickets nao atribuidos.

### Nova Role: Supervisor

Adicionar role `supervisor` ao enum `app_role`:
- **user**: Ve apenas seus proprios tickets
- **supervisor**: Ve todos os tickets, pode puxar qualquer um
- **admin**: Tudo de supervisor + gerenciamento de usuarios

### Alteracoes na Interface

#### ConversationList.tsx
- Adicionar toggle "Meus Tickets" / "Todos"
- Usuarios comuns: veem so seus tickets por padrao
- Supervisors/Admins: veem todos por padrao, podem filtrar

#### Logica de Filtro

```text
SE usuario = 'user':
  - Mostrar tickets onde atendente_id = user.id OU atendente_id IS NULL
  - Pode puxar apenas tickets nao atribuidos (NULL)

SE usuario = 'supervisor' ou 'admin':
  - Mostrar todos os tickets
  - Pode puxar qualquer ticket (inclusive de outros usuarios)
```

### Alteracoes

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Adicionar 'supervisor' ao enum app_role |
| `src/contexts/AuthContext.tsx` | Atualizar tipo para incluir supervisor |
| `src/components/ConversationList.tsx` | Adicionar filtro "Meus Tickets" |
| `src/components/ChatWindow.tsx` | Ajustar logica de atribuicao |

---

## Etapa 3: Delegacao em Massa e KPIs

### Objetivo
Permitir transferencia de tickets quando usuario sair + metricas por atendente.

### Delegacao em Massa

Nova interface em Settings > Gerenciar Usuarios:
- Ao excluir usuario, exibir dialog para escolher destinatario
- Transferir todos os tickets (clientes.atendente_id) do usuario excluido

### KPIs por Usuario

Nova tabela para rastrear metricas:

```sql
CREATE TABLE atendente_metricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendente_id UUID REFERENCES auth.users(id),
  data DATE NOT NULL,
  tickets_atendidos INT DEFAULT 0,
  mensagens_enviadas INT DEFAULT 0,
  tempo_medio_resposta INTERVAL,
  UNIQUE(atendente_id, data)
);
```

Dashboard mostrando:
- Tickets atendidos por periodo
- Tempo medio de resposta
- Taxa de conversao (se aplicavel)

### Alteracoes

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Criar tabela atendente_metricas |
| `src/components/UserManagement.tsx` | Adicionar dialogo de delegacao ao excluir |
| Nova pagina ou aba | Dashboard de KPIs por usuario |
| Trigger SQL | Atualizar metricas automaticamente |

---

## Diagrama de Permissoes

```text
+---------------+------------------+------------------+-------------------+
| Acao          | user             | supervisor       | admin             |
+---------------+------------------+------------------+-------------------+
| Ver tickets   | Proprios + NULL  | Todos            | Todos             |
| Puxar ticket  | Apenas NULL      | Qualquer         | Qualquer          |
| Delegar       | Nao              | Nao              | Sim               |
| Ver KPIs      | Proprios         | Todos            | Todos             |
| Gerenciar     | Nao              | Nao              | Sim               |
+---------------+------------------+------------------+-------------------+
```

---

## Ordem de Implementacao Recomendada

Sugiro comecar pela **Etapa 1** (Resumo de Conversa) por ser:
- Independente das outras funcionalidades
- Valor imediato para transferencia de atendimento
- Menor risco de impacto em funcionalidades existentes

Apos validacao, seguimos para Etapa 2 e depois Etapa 3.

---

## Secao Tecnica

### Etapa 1 - Detalhes

**Edge Function summarize-conversation:**
- Usa Lovable AI Gateway (Gemini 2.5 Flash)
- Prompt estruturado para gerar secoes: Problema, Informacoes, Orcamento, Decisoes, Pendencias
- Limite de 150 mensagens para evitar sobrecarga

**Modificacao FichaServicoTab:**
- Botao com icone FileText no cabecalho
- Dialog com loading state
- Exibicao do resumo em formato de card

### Etapa 2 - Detalhes

**Migracao SQL:**
```sql
ALTER TYPE app_role ADD VALUE 'supervisor';
```

**AuthContext atualizado:**
- Adicionar `isSupervisor` ao contexto
- Logica: supervisor pode ver/puxar todos, user so os proprios

### Etapa 3 - Detalhes

**Trigger para metricas:**
- Ao inserir mensagem com `enviado_por = 'operador'`, incrementar contador
- Calcular tempo entre mensagem cliente e resposta operador

