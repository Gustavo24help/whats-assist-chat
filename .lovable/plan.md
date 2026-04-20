

## Objetivo

Garantir que fichas que tiveram **Visita Técnica** apareçam no calendário mesmo após a visita ter passado e o status ter mudado (ex: virou "Em andamento", "Agendado", "Finalizado", "Garantia" etc).

## Diagnóstico atual

No `AgendamentoCard.tsx` + `calcularEstadoAgendamento.ts`, a data exibida no calendário (`getAgendamentoDates`) é escolhida pelo **status atual** ou pelo `tipo_agendamento`. Quando o status muda de "Visita Técnica" para outro (ex: "Agendado", "Em andamento"), a função passa a ler `horario_agendamento` ou `data_retorno` e **ignora** `data_visita_tecnica`. Resultado: a visita técnica "desaparece" do dia em que aconteceu.

Além disso, a query do `Calendario.tsx` filtra fichas pela data do agendamento principal — fichas cuja única data preenchida é `data_visita_tecnica` podem ficar fora do range buscado.

## Mudanças

### 1. `src/pages/Calendario.tsx`
- Expandir a query para também trazer fichas com `data_visita_tecnica` ou `horario_visita_tecnica` dentro do range visível (além das já buscadas por `horario_agendamento` / `data_retorno`).
- Sem alterar status nem nenhum dado — apenas amplia o conjunto exibido.

### 2. `src/components/calendario/AgendamentoCard.tsx` (lógica de slot)
- Para cada ficha com **visita técnica preenchida**, gerar um "slot" adicional no dia da visita, independente do status atual.
- Quando o status atual for diferente de "Visita Técnica", o slot da visita aparece com:
  - Cor cinza/roxa suave (visual de "histórico")
  - Prefixo `[VT]` no card
  - Tooltip: "Visita técnica realizada"
- O agendamento principal (Agendado/Retorno/Em andamento/Finalizado/Garantia) continua aparecendo normalmente no seu próprio dia/horário com a cor já definida.

### 3. `CalendarioDiario.tsx`, `CalendarioSemanal.tsx`, `CalendarioMensal.tsx`
- Ajustar a função que distribui fichas por dia/hora para emitir **múltiplas entradas** por ficha quando ela tiver mais de uma data relevante (visita + agendamento, por exemplo). Hoje cada ficha vira só 1 entrada.
- Cada entrada carrega uma flag `tipoSlot: 'visita' | 'agendamento' | 'retorno'` usada pelo `AgendamentoCard` para escolher rótulo e cor.

### 4. `src/components/calendario/AgendamentoCard.tsx` (visual)
- Aceitar prop opcional `tipoSlot`.
- Se `tipoSlot === 'visita'` E o status atual ≠ "Visita Técnica" → renderiza em modo "histórico" (cor amarela mais clara/opaca + prefixo `[VT]`).
- Caso contrário, comportamento atual permanece intacto.

### 5. Filtros de status no topo do calendário
- Adicionar o item **"Visita Técnica (histórico)"** no grupo de filtros, controlando a exibição dos slots de visita já passada. Por padrão fica **ligado**.
- Os filtros de status existentes continuam funcionando como hoje sobre o agendamento principal.

## Salvaguardas (sem alterar dados)

- Nenhuma migração, nenhum UPDATE, nenhuma alteração em `fichas_de_servico`.
- `getAgendamentoDates` original não é modificada — apenas adicionamos uma função paralela que extrai **todos** os slots relevantes para visualização.
- Fichas antigas continuam aparecendo igual; a visita técnica passa a aparecer **adicionalmente** quando existir.
- Timezone: continuamos usando os mesmos campos (`data_visita_tecnica` / `horario_visita_tecnica`) sem reparse — sem risco de shift de horário.
- Status, valores, pagamentos: nada é tocado.

## Fora de escopo

- Não altera comportamento da ficha em si (FichaServicoTab) — a visita técnica já fica registrada lá; só passa a ser visível no calendário sempre.
- Não cria histórico novo de status; usa apenas os campos já existentes na ficha.

