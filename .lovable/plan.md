## Problema

Quando você escolhe o período "Este mês", o intervalo atual vai de **01/05 até 31/05** (fim do mês), mesmo estando dia 13/05. Aí a comparação "mês anterior" pega **01/04 até 30/04 inteiro = 49 agendamentos**, comparando contra o mês atual ainda em curso. Isso distorce a variação.

Você quer: período atual `01–13/05` deve comparar contra `01–13/04`.

## Causa

Em `src/hooks/useOperationalKPIs.ts`, na função `getDateRange`:

```ts
case 'month':
  return { from: startOfMonth(now), to: endOfMonth(now) };
```

O `to` vai até o último dia do mês, mesmo no mês corrente. Como `getComparisonRanges('previous-month')` apenas subtrai 1 mês de `from` e `to`, o período comparado também vira o mês inteiro anterior.

## Solução (1 ponto, 1 arquivo)

Em `getDateRange`, no case `'month'`, **limitar `to` ao mínimo entre fim do mês e hoje**:

```ts
case 'month': {
  const monthEnd = endOfMonth(now);
  const today = endOfDay(now);
  return {
    from: startOfMonth(now),
    to: monthEnd < today ? monthEnd : today,
  };
}
```

Efeito automático:
- Período atual: `01/05 00:00` → `13/05 23:59`
- Comparação "mês anterior" (já calculada via shift de -1 mês de `from` e `to`): `01/04 00:00` → `13/04 23:59` ✅
- Variação passa a ser justa (mesma quantidade de dias).

## Garantias

- **Não altera nenhum dado armazenado.** Só muda o limite superior da janela do filtro "Este mês" no dashboard.
- **Não afeta meses passados**: se você escolher um mês já finalizado (ex: abril estando em maio), `monthEnd < today` → mantém o mês inteiro como hoje já faz.
- **Não mexe** em fuso horário, em outros períodos (`today`, `7days`, `30days`, `custom`), nem em queries SQL.
- **Não mexe** na lógica de comparação `avg-3-months` nem `custom` — eles continuam idênticos.
- O label de comparação (`Abr/26`) e o número absoluto exibido sob cada etapa do funil (já implementados na rodada anterior) passam a refletir corretamente `01–13/04`.

## Arquivos alterados

- `src/hooks/useOperationalKPIs.ts` — apenas o case `'month'` da função `getDateRange` (≈4 linhas).