
# Plano: KPIs Operacionais do Dashboard Executivo

## Objetivo

Implementar um conjunto de KPIs operacionais no Dashboard Executivo (`/dashboard`) que mostrem métricas reais do negócio, com filtros por período, categoria, prestador e cliente.

---

## KPIs a Implementar

| KPI | Definicao | Criterio de Contagem |
|-----|-----------|---------------------|
| **Conversas Iniciadas** | Novos contatos de clientes | Primeira mensagem de cada cliente OU criacao de nova ficha (2a, 3a, etc.) |
| **FS Criadas** | Fichas de servico criadas | Contagem de fichas criadas no periodo |
| **Visita Agendada** | Visitas tecnicas marcadas | Fichas com `data_visita_tecnica` preenchida (1 por FS) |
| **Servico Agendado** | Cliente fechou/aceitou proposta | Fichas com `horario_agendamento` preenchido (1 por FS) |
| **Finalizado e Pago** | Servicos concluidos e pagos | Status = "Finalizado" E `pagamento_realizado = true` |
| **Valor Total OS** | Faturamento realizado | Soma de `valor_total` das fichas Finalizadas E Pagas |

---

## Dimensoes de Analise (Filtros)

Os KPIs poderao ser filtrados por:

1. **Periodo**: Hoje, 7 dias, 30 dias, Este mes, Personalizado
2. **Categoria**: Eletrica, Hidraulica, Marido de Aluguel, etc.
3. **Prestador**: Lista de prestadores cadastrados
4. **Cliente**: Busca por telefone/nome
5. **Geral**: Visao consolidada (padrao)

---

## Estrutura do Codigo

```text
src/
  hooks/
    useOperationalKPIs.ts          <- NOVO: Hook para buscar KPIs
  components/
    dashboard/
      OperationalKPIsSection.tsx   <- NOVO: Secao de KPIs operacionais
      KPIFilters.tsx               <- NOVO: Filtros por categoria/prestador
  pages/
    Dashboard.tsx                  <- ATUALIZAR: Adicionar secao de KPIs
```

---

## Logica de Calculo dos KPIs

### 1. Conversas Iniciadas

```text
Evento 1: Primeira mensagem de um cliente (remetente = 'cliente')
         -> Conta como conversa iniciada na data da primeira mensagem

Evento 2: Segunda ficha+ de um mesmo cliente
         -> Conta como nova conversa na data de criacao da ficha
```

Query SQL conceitual:
```sql
-- Primeiras mensagens de cada cliente
SELECT COUNT(DISTINCT cliente_id) 
FROM mensagens 
WHERE remetente = 'cliente'
  AND data_hora = (SELECT MIN(data_hora) FROM mensagens m2 WHERE m2.cliente_id = mensagens.cliente_id)
  AND data_hora BETWEEN :from AND :to

-- + Fichas que NAO sao a primeira do cliente
UNION
SELECT COUNT(*) FROM fichas_de_servico f
WHERE created_at BETWEEN :from AND :to
  AND EXISTS (SELECT 1 FROM fichas_de_servico f2 
              WHERE f2.telefone_cliente = f.telefone_cliente 
              AND f2.created_at < f.created_at)
```

### 2. FS Criadas

```sql
SELECT COUNT(*) FROM fichas_de_servico
WHERE created_at BETWEEN :from AND :to
```

### 3. Visita Agendada

```sql
SELECT COUNT(*) FROM fichas_de_servico
WHERE data_visita_tecnica IS NOT NULL
  AND data_visita_tecnica BETWEEN :from AND :to
```

### 4. Servico Agendado (Cliente Fechou)

```sql
SELECT COUNT(*) FROM fichas_de_servico
WHERE horario_agendamento IS NOT NULL
  AND horario_agendamento BETWEEN :from AND :to
```

### 5. Finalizado e Pago

```sql
SELECT COUNT(*) FROM fichas_de_servico
WHERE status = 'Finalizado'
  AND pagamento_realizado = true
  AND updated_at BETWEEN :from AND :to
```

### 6. Valor Total OS

```sql
SELECT COALESCE(SUM(valor_total), 0) FROM fichas_de_servico
WHERE status = 'Finalizado'
  AND pagamento_realizado = true
  AND updated_at BETWEEN :from AND :to
```

---

## Layout Visual

Nova secao "Metricas Operacionais" no Dashboard:

```text
+------------------------------------------------------------------+
|  Metricas Operacionais                                           |
|  Filtros: [Categoria v] [Prestador v] [Cliente: _____]          |
+------------------------------------------------------------------+
|                                                                  |
|  +------------+  +------------+  +---------------+               |
|  | Conversas  |  | FS Criadas |  | Visita        |               |
|  | Iniciadas  |  |            |  | Agendada      |               |
|  |    142     |  |    127     |  |     45        |               |
|  |  +12.5%    |  |  +8.3%     |  |   +15.2%      |               |
|  +------------+  +------------+  +---------------+               |
|                                                                  |
|  +------------+  +------------+  +---------------+               |
|  | Servico    |  | Finalizado |  | Valor Total   |               |
|  | Agendado   |  | e Pago     |  | OS            |               |
|  |    89      |  |    73      |  |  R$ 52.225    |               |
|  |  +18.7%    |  |  +22.1%    |  |   +25.4%      |               |
|  +------------+  +------------+  +---------------+               |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/hooks/useOperationalKPIs.ts` | Criar | Hook com queries para todos os KPIs |
| `src/components/dashboard/OperationalKPIsSection.tsx` | Criar | Componente da secao com filtros e cards |
| `src/components/dashboard/KPIFilters.tsx` | Criar | Componente de filtros (categoria, prestador, cliente) |
| `src/components/dashboard/index.ts` | Atualizar | Exportar novos componentes |
| `src/pages/Dashboard.tsx` | Atualizar | Adicionar secao de KPIs operacionais |

---

## Secao Tecnica

### Hook useOperationalKPIs

```typescript
interface OperationalKPIs {
  conversasIniciadas: number;
  fsCriadas: number;
  visitaAgendada: number;
  servicoAgendado: number;
  finalizadoPago: number;
  valorTotalOS: number;
  variations: {
    conversasIniciadas: number;
    fsCriadas: number;
    visitaAgendada: number;
    servicoAgendado: number;
    finalizadoPago: number;
    valorTotalOS: number;
  };
}

interface KPIFilters {
  period: 'today' | '7days' | '30days' | 'month' | 'custom';
  customRange?: { from: Date; to: Date };
  categoriaId?: number;
  prestadorCpf?: string;
  clienteTelefone?: string;
}
```

### Queries Paralelas

O hook fara multiplas queries em paralelo usando `Promise.all` para performance:

```typescript
const [
  fsCriadas,
  visitasAgendadas,
  servicosAgendados,
  finalizadosPagos,
  conversasPrimeiras,
  conversasNovasFichas
] = await Promise.all([
  // Query 1: Fichas criadas
  supabase.from('fichas_de_servico').select('*', { count: 'exact' })...
  // Query 2: Visitas agendadas
  // Query 3: Servicos agendados
  // Query 4: Finalizados e pagos
  // Query 5: Primeiras mensagens de clientes
  // Query 6: Fichas subsequentes (2a, 3a...)
]);
```

### Calculo de Variacao

Mesma logica do `useGoogleAdsMetrics`:
- Buscar periodo atual
- Buscar periodo anterior (mesmo tamanho)
- Calcular variacao percentual

### Filtros Dinamicos

Os filtros serao aplicados nas queries quando presentes:

```typescript
let query = supabase.from('fichas_de_servico').select('*', { count: 'exact' });

if (filters.categoriaId) {
  query = query.eq('categoria_id', filters.categoriaId);
}
if (filters.prestadorCpf) {
  query = query.eq('prestador_id', filters.prestadorCpf);
}
if (filters.clienteTelefone) {
  query = query.eq('telefone_cliente', filters.clienteTelefone);
}
```

---

## Consideracoes de Performance

1. **Cache**: Usar `staleTime` de 5 minutos no React Query
2. **Queries otimizadas**: Usar `count: 'exact'` em vez de trazer todos os dados
3. **Filtros no servidor**: Aplicar filtros na query SQL, nao no cliente
4. **Carregamento**: Mostrar skeletons enquanto carrega

---

## Proximos Passos (Apos Implementacao)

1. Testar com dados reais do periodo atual
2. Validar se as metricas batem com os dados da aba Geral
3. Adicionar graficos de evolucao temporal (opcional)
4. Exportar dados para CSV/Excel (futuro)
