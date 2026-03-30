

# Correções do Calendário: painel lateral de dia + fichas não exibidas

## Problema 1: Fichas não aparecem no calendário

**Causa raiz**: `getAgendamentoDates()` em `calcularEstadoAgendamento.ts` usa `tipo_agendamento` para decidir qual campo de data ler. Porém, 93 fichas (incluindo FS5-260327) têm `tipo_agendamento = null` com `data_visita_tecnica`/`horario_visita_tecnica` preenchidos. A função cai no branch `else` (serviço), que exige `horario_agendamento` — retorna `null` e a ficha some.

**Correção em `src/lib/calcularEstadoAgendamento.ts`**: Antes do branch de serviço (else), adicionar detecção automática do tipo real baseado nos campos preenchidos:
```
// Se tipo_agendamento é null, inferir pelo que está preenchido:
// - data_retorno preenchido → tratar como retorno
// - data_visita_tecnica/horario_visita_tecnica preenchido → tratar como visita_tecnica
// - horario_agendamento preenchido → tratar como servico
```

Isso corrige a exibição sem alterar nenhum dado existente no banco.

## Problema 2: "+X mais" não é clicável / sem painel lateral

**Solução**: Na visualização mensal, adicionar:

1. **"+X mais" clicável** — ao clicar, expande inline mostrando todas as fichas do dia (ou abre o painel lateral)
2. **Clique no número do dia** — abre painel lateral à direita com lista completa das fichas daquele dia
3. **Painel lateral (drawer/panel)** — lista todas as fichas do dia selecionado, cada uma clicável para abrir o modal de detalhes existente. Botão X para fechar.

### Alterações

**`src/lib/calcularEstadoAgendamento.ts`**
- No início de `getAgendamentoDates`, inferir `tipo_agendamento` quando `null`:
  - Se `data_retorno` preenchido → usar lógica de retorno
  - Se `data_visita_tecnica` ou `horario_visita_tecnica` preenchido → usar lógica de visita técnica
  - Senão → manter lógica de serviço

**`src/components/calendario/CalendarioMensal.tsx`**
- Adicionar state `selectedDay: string | null`
- Tornar o "+X mais" clicável → `setSelectedDay(key)`
- Tornar o número do dia clicável → `setSelectedDay(key)`
- Renderizar painel lateral condicional quando `selectedDay` está definido:
  - Posição fixa à direita do calendário
  - Header com data formatada + botão X
  - Lista scrollável de `AgendamentoCard` (não compact) para cada ficha do dia
  - Clique em cada card → `onSelectFicha(f)` (abre modal de detalhes)

**`src/pages/Calendario.tsx`**
- Ajustar layout para acomodar o painel lateral (flex row com calendário + painel)

## Arquivos alterados
- `src/lib/calcularEstadoAgendamento.ts` — inferir tipo quando null
- `src/components/calendario/CalendarioMensal.tsx` — painel lateral + "+X mais" clicável
- `src/pages/Calendario.tsx` — layout flex para acomodar painel

