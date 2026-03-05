

## Diagnóstico: Metas Acumuladas no Dashboard TV

### Análise dos dados

Dados em `daily_goals` para março/2026:
- 02/03: qty=2, val=R$760
- 03/03: qty=2, val=R$760
- 04/03: qty=2, val=R$760
- 05/03: qty=2, val=R$760

O acumulado até hoje (05/03) deveria ser: qty=8, val=R$3.040.

### Código atual (linha 276 de DashboardTV.tsx)

A query acumulada usa `.gte('date', mesFromDate).lte('date', hojeDate)` onde `hojeDate = format(new Date(), 'yyyy-MM-dd')`. Isso deveria incluir hoje.

### Causa provável

Se o dispositivo de TV (navegador) estiver com timezone diferente (ex: UTC em vez de UTC-3), `format(new Date(), 'yyyy-MM-dd')` pode retornar a data de "ontem" no horário local brasileiro, fazendo a query excluir o dia de hoje.

### Plano de correção

**Arquivo: `src/pages/DashboardTV.tsx`**

1. Forçar o cálculo de `hojeDate` usando timezone explícita de São Paulo para evitar divergências entre o timezone do dispositivo e o esperado.

2. Alternativa mais robusta e simples: em vez de confiar no `format()` local, usar `new Date().toLocaleDateString('sv-SE')` que retorna `YYYY-MM-DD` no timezone local do browser, ou manter `format` mas adicionar um `console.log` temporário para debug.

3. Como medida definitiva: usar a timezone do Brasil explicitamente com `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })` para gerar `hojeDate`, `mesFromDate` e `mesEndDate`, garantindo que independente do timezone do dispositivo, as datas estejam corretas.

**Alteração concreta:**

Substituir:
```typescript
const hojeDate = format(now, 'yyyy-MM-dd');
const mesFromDate = format(startOfMonth(now), 'yyyy-MM-dd');
const mesEndDate = format(endOfMonth(now), 'yyyy-MM-dd');
```

Por uma helper function que calcula as datas no timezone `America/Sao_Paulo`:
```typescript
function getDateInBrazil(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}
const hojeDate = getDateInBrazil(now);
const mesFromDate = getDateInBrazil(startOfMonth(now));
const mesEndDate = getDateInBrazil(endOfMonth(now));
```

Isso garante que mesmo em um monitor/TV com timezone UTC ou outro fuso, as metas acumuladas usem a data correta do Brasil.

4. Aplicar a mesma correção de timezone para `diaFrom` e `diaTo` (usados para buscar agendamentos do dia), pois sofrem do mesmo risco.

