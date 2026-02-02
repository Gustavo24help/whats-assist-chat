
# Plano: Corrigir Critério de Data dos KPIs

## Problema Identificado

Os KPIs "Finalizado e Pago" e "Valor Total OS" estão usando `updated_at` para filtrar por período, mas o critério correto é usar `created_at` (data de criação da ficha).

**Exemplo**: Uma ficha criada em janeiro mas finalizada/paga em fevereiro deve aparecer nos KPIs de **janeiro**.

---

## Mudança Necessária

| KPI | Data Atual | Data Correta |
|-----|------------|--------------|
| FS Criadas | `created_at` | `created_at` (OK) |
| Visita Agendada | `data_visita_tecnica` | `created_at` |
| Serviço Agendado | `horario_agendamento` | `created_at` |
| Finalizado e Pago | `updated_at` | `created_at` |
| Valor Total OS | `updated_at` | `created_at` |

---

## Arquivo a Modificar

**`src/hooks/useOperationalKPIs.ts`**

### Mudanças:

1. **Visita Agendada**: Trocar filtro de `data_visita_tecnica` para `created_at`
2. **Serviço Agendado**: Trocar filtro de `horario_agendamento` para `created_at`
3. **Finalizado e Pago**: Trocar filtro de `updated_at` para `created_at`
4. **Valor Total OS**: Trocar filtro de `updated_at` para `created_at`

### Código atual (linhas 95-120):

```typescript
// Visita Agendada - ATUAL
.gte('data_visita_tecnica', fromDateOnly)
.lte('data_visita_tecnica', toDateOnly)

// Serviço Agendado - ATUAL
.gte('horario_agendamento', fromStr)
.lte('horario_agendamento', toStr)

// Finalizado e Pago - ATUAL
.gte('updated_at', fromStr)
.lte('updated_at', toStr)

// Valor Total OS - ATUAL
.gte('updated_at', fromStr)
.lte('updated_at', toStr)
```

### Código corrigido:

```typescript
// Visita Agendada - CORRIGIDO
.gte('created_at', fromStr)
.lte('created_at', toStr)

// Serviço Agendado - CORRIGIDO
.gte('created_at', fromStr)
.lte('created_at', toStr)

// Finalizado e Pago - CORRIGIDO
.gte('created_at', fromStr)
.lte('created_at', toStr)

// Valor Total OS - CORRIGIDO
.gte('created_at', fromStr)
.lte('created_at', toStr)
```

---

## Impacto nos Dados Existentes

**Nenhum dado será alterado** - apenas a forma de filtrar/exibir os KPIs mudará.

Os números podem mudar significativamente porque:
- Fichas criadas há mais tempo mas finalizadas recentemente sairão dos KPIs recentes
- Fichas criadas recentemente mas ainda não finalizadas entrarão nos KPIs (se já estiverem pagas)

---

## Resumo

Padronizar todos os KPIs para usar `created_at` como critério de data, garantindo que uma ficha sempre apareça no período em que foi criada, independente de quando foi finalizada ou paga.
