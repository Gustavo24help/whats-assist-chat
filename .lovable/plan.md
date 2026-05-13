
## Objetivo
No bloco "Funil de conversão" hoje só aparece o número do período atual e a variação em % (ex: `-53.2%`). Você quer ver também o **valor absoluto do período comparado** (ex: mês anterior) ao lado de cada etapa, para conferir se o `%` bate com a conta.

## O que vai mudar (somente UI + 1 hook)

### 1) `src/hooks/useOperationalKPIs.ts`
- Hoje o hook só devolve `kpis` (atual) + `variations` (%).
- Vou adicionar um objeto `previous` no retorno, com os mesmos campos numéricos do período de comparação efetivamente usado (mês anterior, média 3 meses ou range custom — o mesmo que já é usado para calcular a variação).
- Também vou expor `comparisonLabel` (ex: `"Fev/26"`, `"Média últ. 3 meses"`, `"01–28/02"`) só para rotular a UI.
- **Sem mexer nas queries**: os números `previous` já são calculados internamente para gerar a variação, só não estavam sendo expostos. Nenhuma métrica ou data muda.

### 2) `src/components/dashboard/ExecutiveFunnel.tsx`
- Adicionar campo opcional `previousValue?: number | null` e `comparisonLabel?: string` em `ExecutiveFunnelStep`.
- Logo abaixo do número grande de cada etapa (e antes do "X% vs etapa anterior"), mostrar uma linha discreta:
  ```
  Fev/26: 205
  ```
  Renderizado em `text-xs text-muted-foreground`, com o número em `font-semibold`.
- Se `previousValue` for `null`/indefinido, mostra `Fev/26: —`.

### 3) `src/components/dashboard/ExecutiveDashboardSection.tsx`
- Passar `previousValue` para cada uma das 5 etapas, lendo de `kpis.previous` (`fsCriadas`, `fsComOrcamento`, `servicoAgendado`, `servicoFinalizado`, `finalizadoPago`).
- Passar `comparisonLabel` igual em todas as etapas.

## Exemplo visual depois da mudança

```text
┌─────────────────────────┐
│ FS CRIADAS      -53.2%  │
│                         │
│ 96                      │
│ Fev/26: 205             │  ← novo
│ base 100%               │
└─────────────────────────┘
```

Conferência: `(96 − 205) / 205 = −53.2%` ✅

## Garantias (project-knowledge)
- Não altera nenhuma query, fuso horário, regra de negócio ou cálculo existente.
- Não altera dados armazenados.
- Não muda layout dos demais blocos do Dashboard, só adiciona uma linha em cada card do funil.
- Mudança contida em 3 arquivos (1 hook + 2 componentes do dashboard).
