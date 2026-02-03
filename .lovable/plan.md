
# Plano: Correção da Lógica de KPIs de Agendamento

## Problema Identificado

A query atual para "Serviço Agendado" usa `horario_agendamento IS NOT NULL`, o que inclui todas as fichas que já tiveram agendamento - inclusive as que já foram finalizadas e pagas. Isso causa **contagem dupla** no cálculo do total.

**Dados atuais do banco:**
- Fichas com status "Agendado" (atualmente agendadas): 7
- Fichas Finalizadas e Pagas: 48
- Query atual retorna: ~66 (todos com horario_agendamento preenchido)

## Solução Proposta

### 1. Corrigir a Query de "Serviço Agendado"

Alterar de:
```
horario_agendamento IS NOT NULL
```

Para:
```
status = 'Agendado'
```

Isso garante que contamos apenas as fichas que estão **atualmente** no status "Agendado", excluindo as que já avançaram para "Finalizado".

### 2. Recálculo do Total para Funil

O `servicoAgendadoTotal` continuará sendo:
```
servicoAgendadoTotal = servicoAgendado + finalizadoPago
```

Mas agora com valores corretos:
- servicoAgendado = 7 (status Agendado)
- finalizadoPago = 48 (Finalizado + pago)
- Total = 55 (sem duplicação)

### 3. Arquivos a Modificar

**src/hooks/useOperationalKPIs.ts**
- Linha 150-155: Alterar query de "Serviço Agendado"
  - De: `.not('horario_agendamento', 'is', null)`
  - Para: `.eq('status', 'Agendado')`
- Linha 196-201: Mesma alteração para o período anterior

### 4. Atualização do Subtexto no Card

**src/components/dashboard/OperationalKPIsSection.tsx**
- Linha 115: Ajustar texto para refletir a lógica correta
  - De: `"${kpis.servicoAgendado} agendados + ${kpis.finalizadoPago} finalizados"`
  - Para: `"${kpis.servicoAgendado} em andamento + ${kpis.finalizadoPago} concluídos"`

---

## Detalhes Técnicos

### Query Corrigida (useOperationalKPIs.ts)

```typescript
// 3. Serviço Agendado - apenas status 'Agendado' (não todos com horario_agendamento)
buildFichaQuery(supabase.from('fichas_de_servico'))
  .select('*', { count: 'exact', head: true })
  .eq('status', 'Agendado')  // MUDANÇA: era .not('horario_agendamento', 'is', null)
  .gte('created_at', fromStr)
  .lte('created_at', toStr),
```

### Fluxo do Funil Corrigido

```text
FS Criadas (ex: 100)
    ↓
Serviço Agendado (status='Agendado'): 7
    +
Finalizado e Pago: 48
    =
Total Conversões: 55
    
Taxa Agendamento = 55/100 = 55%
Taxa Finalização = 48/100 = 48%
```

### Impacto nos Dados Existentes

- **Nenhum dado será alterado** - apenas a forma de consultar
- Os valores exibidos serão menores e mais precisos
- As taxas de conversão refletirão a realidade do funil
