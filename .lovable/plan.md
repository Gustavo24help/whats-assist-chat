

## Diagnóstico: Por que a correção anterior não resolveu

### O problema real

A função `getDateInBrazil` converte corretamente uma `Date` para o fuso de São Paulo. Porém, `startOfMonth(now)` e `endOfMonth(now)` do date-fns criam objetos `Date` baseados no timezone **local do browser**. Quando o browser está em UTC:

- `startOfMonth(new Date('2026-03-05T01:00Z'))` → `2026-03-01T00:00:00Z`
- `getDateInBrazil(acima)` → `2026-02-28` (porque 00:00 UTC = 21:00 do dia anterior no Brasil)

Resultado: a query de metas acumuladas busca `date >= '2026-02-28'` em vez de `'2026-03-01'`, quebrando o cálculo.

### Correção

Em vez de usar `startOfMonth`/`endOfMonth` do date-fns e depois converter, derivar as datas do mês diretamente da string `hojeDate` que já está correta:

**Arquivo: `src/pages/DashboardTV.tsx`**, dentro do queryFn de `tv-metas-independentes`:

Substituir:
```typescript
const hojeDate = getDateInBrazil(now);
const mesFromDate = getDateInBrazil(startOfMonth(now));
const mesEndDate = getDateInBrazil(endOfMonth(now));
```

Por:
```typescript
const hojeDate = getDateInBrazil(now);
// Derivar mês a partir da string já correta, sem depender de Date objects
const mesFromDate = hojeDate.substring(0, 7) + '-01';  // '2026-03-01'
// Calcular último dia do mês
const [y, m] = hojeDate.substring(0, 7).split('-').map(Number);
const lastDay = new Date(y, m, 0).getDate(); // getDate do dia 0 do mês seguinte = último dia
const mesEndDate = hojeDate.substring(0, 7) + '-' + String(lastDay).padStart(2, '0');
```

E os timestamps `diaFrom`, `diaTo`, `mesFrom`, `mesTo` continuam usando o offset `-03:00` como está.

Isso é uma alteração cirúrgica de ~6 linhas no mesmo bloco que foi editado antes, sem impacto em dados existentes.

