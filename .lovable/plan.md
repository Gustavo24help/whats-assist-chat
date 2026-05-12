## Objetivo

Evitar agendamentos sobrepostos para o mesmo prestador e dar visibilidade de proximidade. Aplicado em todos os pontos onde se define horário de prestador (Ficha, reagendamento) e marcado visualmente no Calendário.

## Regras

- **Janela usada**: Janela do Prestador (`hora_inicio_prestador_agendamento`/`hora_fim_prestador_agendamento`, e equivalentes de `_retorno`). Quando faltar, usa a janela do cliente como fallback.
- **Escopo**: todos os compromissos do prestador — Serviço (`Agendado`), Visita Técnica e Retorno — exceto fichas com status `Finalizado`, `Perdido`, `Cancelado`, `Garantia`.
- **Severidades**:
  - **BLOQUEIO**: novo início é exatamente igual ao início de outro compromisso do mesmo prestador no mesmo dia. Não permite salvar; mostra alerta com link para a ficha em conflito.
  - **AVISO (confirmação)**: novo início está dentro de 60 min (antes ou depois) do início de outro compromisso, ou as janelas se sobrepõem parcialmente. Abre AlertDialog mostrando os agendamentos próximos; operador confirma ou cancela.
  - **MARCAÇÃO VISUAL** (calendário): ao final, qualquer slot que tenha outro compromisso do mesmo prestador a ≤ 60 min ganha um badge "⚠ Próximo" com tooltip listando os vizinhos.

## Arquivos

**Novo** `src/lib/conflitoAgendamentoPrestador.ts`
- `detectarConflitos({ prestadorId, fichaIdAtual, inicio, fim, fichas }) → { bloqueio: Conflito|null, avisos: Conflito[] }`.
- `Conflito`: `{ fichaId, nome, tipoSlot, inicio, fim, distanciaMin }`.
- Resolve janela de cada ficha via `getAllAgendamentoSlots` (já existente em `calcularEstadoAgendamento.ts`).
- Helper `buscarFichasPrestadorParaConflito(prestadorId, dataRef)` que faz `select` em `fichas_de_servico` filtrando dia ±1 e exclui status finalizados/perdidos/cancelados/garantia e a própria ficha.

**`src/components/FichaServicoTab.tsx`** (e demais formulários de agendamento — `FichaPanel*`, qualquer reagendamento)
- Antes de salvar `horario_agendamento`/`data_retorno`/`data_visita_tecnica` (ou suas janelas de prestador), chamar `detectarConflitos`.
- Se `bloqueio`: `toast.error` com nome/horário do conflito e impede save.
- Se há `avisos`: AlertDialog "O prestador X já tem um atendimento próximo em <hora> (<ficha Y>). Deseja agendar mesmo assim?" → confirmar prossegue, cancelar aborta.
- Reaplicar nas funções existentes `salvarAgendamento`/`salvarRetorno`/`salvarVisitaTecnica` (encontrar por busca por `hora_inicio_prestador`).

**`src/components/calendario/AgendamentoDetalhesModal.tsx`**
- Mesma validação ao alterar horário pelo modal.

**Calendário (visual)** — `src/lib/calcularEstadoAgendamento.ts` ou um wrapper em `Calendario.tsx`
- Após carregar `fichas`, pré-computar mapa `Map<fichaId+slot, vizinhos[]>` agrupando por `prestador_id` e ordenando por início; marcar `proximo: true` quando vizinho ≤ 60 min.
- Passar a flag `proximo` + lista para `AgendamentoCard`.

**`src/components/calendario/AgendamentoCard.tsx`**
- Quando `proximo`, exibir um pequeno ícone `AlertTriangle` (lucide) com tooltip listando vizinhos (`hora — nome_ficha`).
- Borda/anel sutil `ring-1 ring-amber-500/60` para destacar sem mudar a cor de status.

## Pontos de atenção (preservação de dados)

- **Não alterar dados existentes**: a verificação ocorre apenas em novos saves; fichas já salvas com conflito permanecem como estão e apenas recebem o badge visual.
- **Timezone**: comparar via `Date.getTime()` em horários já normalizados em UTC pelo `getAllAgendamentoSlots` (não recriar parse manual; reutilizar o existente para evitar shift de horário como o incidente anterior).
- **Janela do prestador opcional**: quando ausente, fallback para janela do cliente — sem regravar dados.
- **Performance**: query de conflito limitada à data alvo ±1 dia e ao `prestador_id`.

## Testes manuais sugeridos

1. Marcar Serviço 14:00 quando já existe Serviço 14:00 do mesmo prestador → bloqueia.
2. Marcar Serviço 14:30 quando existe 14:00 → AlertDialog de aviso.
3. Marcar Serviço 16:00 quando existe Visita Técnica 15:30 → aviso.
4. Calendário: dois agendamentos do mesmo prestador a 30 min de distância → ambos com badge ⚠.
5. Trocar prestador para um livre → sem aviso.
