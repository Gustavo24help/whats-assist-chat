
# Plano: Corrigir KPI "Conversas Iniciadas"

## Problema Identificado

O KPI "Conversas Iniciadas" está mostrando **22** quando deveria mostrar **~320** (nos últimos 30 dias).

**Causa raiz**: O código atual busca todas as mensagens da tabela (13.530) para calcular a primeira mensagem de cada cliente, mas o Supabase tem um **limite padrão de 1000 linhas** por query. Isso corrompe completamente o cálculo.

---

## Lógica de Negócio (conforme memória do projeto)

"Conversas Iniciadas" = Soma de:
1. **Primeira mensagem de cada cliente** no período (cliente novo)
2. **Fichas subsequentes** (não a primeira) criadas no período

---

## Solução: Usar RPC/Database Function

Em vez de buscar todos os dados e processar no frontend, vamos criar uma **função no banco de dados** que faz o cálculo corretamente.

### Passo 1: Criar função SQL no banco

```sql
CREATE OR REPLACE FUNCTION calculate_conversas_iniciadas(
  p_from_date TIMESTAMPTZ,
  p_to_date TIMESTAMPTZ,
  p_categoria_id INTEGER DEFAULT NULL,
  p_prestador_cpf TEXT DEFAULT NULL,
  p_cliente_telefone TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_novos_clientes INTEGER;
  v_fichas_subsequentes INTEGER;
BEGIN
  -- 1. Contar clientes cuja primeira mensagem foi no período
  SELECT COUNT(*) INTO v_novos_clientes
  FROM (
    SELECT cliente_id, MIN(data_hora) as primeira_msg
    FROM mensagens
    WHERE remetente = 'cliente'
    GROUP BY cliente_id
  ) sub
  WHERE primeira_msg >= p_from_date
    AND primeira_msg <= p_to_date;

  -- 2. Contar fichas subsequentes no período (aplicando filtros)
  WITH ranked_fichas AS (
    SELECT 
      id,
      telefone_cliente,
      created_at,
      categoria_id,
      prestador_id,
      ROW_NUMBER() OVER (
        PARTITION BY telefone_cliente 
        ORDER BY created_at
      ) as ficha_num
    FROM fichas_de_servico
  )
  SELECT COUNT(*) INTO v_fichas_subsequentes
  FROM ranked_fichas
  WHERE ficha_num > 1
    AND created_at >= p_from_date
    AND created_at <= p_to_date
    AND (p_categoria_id IS NULL OR categoria_id = p_categoria_id)
    AND (p_prestador_cpf IS NULL OR prestador_id = p_prestador_cpf)
    AND (p_cliente_telefone IS NULL OR telefone_cliente = p_cliente_telefone);

  RETURN v_novos_clientes + v_fichas_subsequentes;
END;
$$;
```

### Passo 2: Atualizar useOperationalKPIs.ts

Substituir o cálculo manual por uma chamada RPC:

```typescript
// Em vez de buscar todas as mensagens e fichas:
const conversasResult = await supabase.rpc('calculate_conversas_iniciadas', {
  p_from_date: fromStr,
  p_to_date: toStr,
  p_categoria_id: filters.categoriaId || null,
  p_prestador_cpf: filters.prestadorCpf || null,
  p_cliente_telefone: filters.clienteTelefone || null
});

const conversasIniciadas = conversasResult.data || 0;
```

### Passo 3: Remover queries desnecessárias

- Remover query 6 (allFichasResult)
- Remover query 7 (firstMessagesResult)
- Remover queries duplicadas do período anterior
- Remover a função `calculateConversasIniciadas`

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| **Migração SQL** | Criar função `calculate_conversas_iniciadas` |
| `src/hooks/useOperationalKPIs.ts` | Usar RPC em vez de cálculo manual |

---

## Benefícios

1. **Correção do bug**: Sem limite de 1000 linhas
2. **Performance**: Cálculo feito no banco (mais rápido)
3. **Precisão**: Lógica SQL correta e testável
4. **Manutenibilidade**: Lógica centralizada no banco

---

## Impacto nos Dados

Nenhum dado será alterado. Apenas o cálculo será corrigido:
- **Antes**: ~22 (incorreto por limite de query)
- **Depois**: ~320 (valor real)
