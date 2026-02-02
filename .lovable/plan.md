

# Plano: Corrigir KPI "Conversas Iniciadas"

## Problema Identificado

O KPI "Conversas Iniciadas" está mostrando **36** quando deveria ser **319**.

**Causa raiz**: A query do Supabase tem limite padrão de 1.000 registros, mas existem 13.506 mensagens de clientes. Isso faz com que a lógica de "primeira mensagem por cliente" não funcione corretamente.

| Componente | Valor atual | Valor correto |
|------------|-------------|---------------|
| Primeiras mensagens de clientes (30 dias) | 0 | 283 |
| Fichas subsequentes (30 dias) | 36 | 36 |
| **Total** | **36** | **319** |

---

## Solucao Proposta

Em vez de buscar todas as mensagens no cliente (impossivel com 13.506 registros), vou usar uma abordagem otimizada:

### Estrategia 1: Consulta agregada no banco

Usar queries que fazem a agregacao no servidor, nao no cliente:

```sql
-- Primeiras mensagens por cliente nos ultimos 30 dias
WITH first_messages AS (
  SELECT cliente_id, MIN(data_hora) as primeira_msg
  FROM mensagens
  WHERE remetente = 'cliente'
  GROUP BY cliente_id
)
SELECT COUNT(*) FROM first_messages
WHERE primeira_msg >= NOW() - INTERVAL '30 days'
```

### Estrategia 2: Usar RPC (funcao no banco)

Criar uma funcao no banco que faz o calculo completo e retorna apenas o numero, evitando transferir dados para o cliente.

---

## Implementacao Escolhida

Vou usar a **Estrategia 1** com queries otimizadas que:

1. Buscam apenas clientes distintos com sua primeira mensagem (nao todas as mensagens)
2. Filtram por periodo no servidor
3. Retornam apenas a contagem

### Mudancas no Hook

**Arquivo**: `src/hooks/useOperationalKPIs.ts`

**Query atual (problema)**:
```typescript
supabase
  .from('mensagens')
  .select('cliente_id, data_hora')
  .eq('remetente', 'cliente')
  .order('data_hora', { ascending: true })
// Retorna max 1000 registros - INSUFICIENTE
```

**Nova abordagem**:

1. **Para primeiras mensagens**: Buscar a data da primeira mensagem de cada cliente usando uma query que agrupa no servidor
2. **Para fichas subsequentes**: Manter a logica atual (616 fichas cabem no limite)

### Codigo da Solucao

```typescript
// 1. Buscar primeira mensagem de cada cliente (agregado no servidor)
const firstMessagesByClient = await supabase
  .from('mensagens')
  .select('cliente_id')
  .eq('remetente', 'cliente')
  .order('data_hora', { ascending: true });

// Problema: ainda precisa de todos os registros para agrupar

// SOLUCAO: Criar uma view ou usar RPC
```

Como o Supabase JavaScript SDK nao suporta GROUP BY diretamente, a melhor solucao e criar uma **funcao RPC** no banco:

```sql
CREATE OR REPLACE FUNCTION count_conversas_iniciadas(
  from_date TIMESTAMPTZ,
  to_date TIMESTAMPTZ,
  p_categoria_id INTEGER DEFAULT NULL,
  p_prestador_cpf TEXT DEFAULT NULL,
  p_cliente_telefone TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  primeiras_msgs INTEGER;
  fichas_subsequentes INTEGER;
BEGIN
  -- Contar primeiras mensagens de clientes no periodo
  SELECT COUNT(*) INTO primeiras_msgs
  FROM (
    SELECT cliente_id, MIN(data_hora) as primeira_msg
    FROM mensagens
    WHERE remetente = 'cliente'
    GROUP BY cliente_id
  ) fm
  WHERE fm.primeira_msg >= from_date 
    AND fm.primeira_msg <= to_date;
  
  -- Contar fichas subsequentes no periodo
  WITH fichas_ordenadas AS (
    SELECT 
      telefone_cliente,
      created_at,
      categoria_id,
      prestador_id,
      ROW_NUMBER() OVER (PARTITION BY telefone_cliente ORDER BY created_at) as ordem
    FROM fichas_de_servico
    WHERE (p_categoria_id IS NULL OR categoria_id = p_categoria_id)
      AND (p_prestador_cpf IS NULL OR prestador_id = p_prestador_cpf)
      AND (p_cliente_telefone IS NULL OR telefone_cliente = p_cliente_telefone)
  )
  SELECT COUNT(*) INTO fichas_subsequentes
  FROM fichas_ordenadas
  WHERE ordem > 1 
    AND created_at >= from_date 
    AND created_at <= to_date;
  
  RETURN primeiras_msgs + fichas_subsequentes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Arquivos a Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| **Migracao SQL** | Criar | Funcao RPC `count_conversas_iniciadas` |
| `src/hooks/useOperationalKPIs.ts` | Atualizar | Usar RPC em vez de queries no cliente |

---

## Mudancas Detalhadas

### 1. Migracao SQL

Criar funcao que calcula conversas iniciadas no servidor:

```sql
CREATE OR REPLACE FUNCTION count_conversas_iniciadas(
  from_date TIMESTAMPTZ,
  to_date TIMESTAMPTZ
) RETURNS INTEGER
```

### 2. Hook useOperationalKPIs.ts

Substituir a logica atual por chamada RPC:

```typescript
// ANTES (problema)
const calculateConversasIniciadas = (...) => {
  // Processa 1000 mensagens no cliente - INCOMPLETO
}

// DEPOIS (solucao)
const { data: conversasData } = await supabase
  .rpc('count_conversas_iniciadas', {
    from_date: fromStr,
    to_date: toStr,
    p_categoria_id: filters.categoriaId || null,
    p_prestador_cpf: filters.prestadorCpf || null,
    p_cliente_telefone: filters.clienteTelefone || null
  });

const conversasIniciadas = conversasData || 0;
```

---

## Resultado Esperado

Apos a correcao:

| KPI | Valor Atual | Valor Correto |
|-----|-------------|---------------|
| Conversas Iniciadas (30 dias) | 36 | 319 |

A logica correta:
- **283** clientes enviaram sua primeira mensagem nos ultimos 30 dias
- **36** fichas subsequentes (2a, 3a ficha de um cliente) foram criadas nos ultimos 30 dias
- **Total: 319** conversas iniciadas

