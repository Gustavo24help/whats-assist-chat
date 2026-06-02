## Problema

Em `FichaServicoTab.tsx`, ao mudar o status para **Agendado** e logo em seguida preencher (ou já ter aberto) os campos de data/hora, o sistema às vezes **reverte o status** para o valor anterior (ex.: Orçamento Enviado). Foi exatamente o que aconteceu ontem em **FS4-260525** (Paula: Agendado → Orçamento Enviado → Agendado em 20s) e em outras fichas. Hoje em **FS7-260525** o status até gravou como Agendado, mas sem `horario_agendamento` — mesma família de bug.

## Causa raiz (stale closure + debounce)

Todos os handlers de data/hora (`updateDataAgendamento`, `updateHoraAgendamento`, `updateHoraFimAgendamento`, `updateDataRetorno`, `updateHora*Retorno`, `updateHoraVisitaTecnica`) chamam:

```ts
autoSave(fichaId, ficha, ...)
```

passando a variável `ficha` do **closure do render atual**. O `autoSave` é debounced em 500ms — só a última chamada vai ao banco.

Cenário do bug:
1. Operadora clica no dropdown e seleciona **Agendado** → `handleFichaUpdate` faz `setFicha({...,status:'Agendado'})` e chama `autoSave(..., updatedFicha, ...)`. Correto.
2. Em menos de 500ms ela preenche a data/hora → o handler roda com `ficha` capturado **antes do React aplicar o novo status**. Chama `autoSave(..., ficha, ...)` com `status:'Orçamento Enviado'`.
3. O debounce descarta a 1ª chamada (status correto) e grava a 2ª (status antigo). Resultado: status volta para "Orçamento Enviado".

Isso viola a regra documentada na memória `data-integrity-fichas`: salvamento deve usar **parâmetros explícitos**, não closures stale.

## Correção (cirúrgica, sem mudar UX)

Adicionar um `fichaRef` que sempre aponta para o estado mais recente de `ficha`, e fazer todos os handlers de data/hora lerem dele em vez do `ficha` do closure.

```ts
// novo ref
const fichaRef = useRef<Ficha | null>(null);
useEffect(() => { fichaRef.current = ficha; }, [ficha]);
```

Trocar nos handlers (linhas ~1085-1148):

```ts
// antes
autoSave(fichaId, ficha, data, horaAgendamento, ...);
// depois
autoSave(fichaId, fichaRef.current ?? ficha, data, horaAgendamento, ...);
```

Aplicar em: `updateDataAgendamento`, `updateHoraAgendamento`, `updateHoraFimAgendamento`, `updateDataVisitaTecnica` (já cria updatedFicha, manter), `updateHoraVisitaTecnica`, `updateDataRetorno`, `updateHoraRetorno`, `updateHoraFimRetorno`.

Garantia adicional: dentro de `salvarFichaEEnviarWebhook`, no momento do `update`, comparar `fichaData.status` com `fichaRef.current?.status` — se o ref tem um status **mais novo** (mudou depois do debounce começar), usar o do ref. Isto serve como segunda barreira contra qualquer outro caminho que ainda passe closure stale.

## Salvaguardas (custom-instructions)

- Não altera schema, não toca em dados existentes, não muda fusos. Apenas corrige qual valor de status/datas vai para o `UPDATE`.
- Mantém o `skipRealtimeRef` de 2s já existente.
- Não mexe em fichas já gravadas. Apenas a próxima edição respeitará o novo fluxo.

## Verificação após implementação

1. Abrir uma ficha em "Orçamento Enviado", mudar status para "Agendado" e **imediatamente** preencher data/hora. Verificar no banco que `status='Agendado'` e `horario_agendamento` foram persistidos juntos.
2. Repetir invertendo a ordem (data primeiro, depois status).
3. Conferir o `ficha_status_historico` — não deve haver mais sequência `Agendado → Orçamento Enviado → Agendado` feita pelo mesmo usuário em segundos.

## Fichas afetadas ontem/hoje (para conhecimento, não mexer)

Identificadas no histórico com padrão de revert do mesmo operador em curto intervalo: `FS4-260525` (Paula, 02/06), e candidatas `FGM5@260429`, `FS7-260529` (revert por outro operador — pode ser intencional). FS7-260525 ficou Agendado mas sem horário — operadora deve repreencher após o fix.
