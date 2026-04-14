
Diagnóstico rápido: sim, do jeito que está hoje, existe uma boa chance de ele “pegar só daqui para frente” ou só depois do próximo ciclo de checagem.

Motivo principal:
- A sugestão automática depende de `isVendaAtiva` (`botDesabilitado` + `fichaStatus` válido).
- Na abertura de uma conversa antiga, `mensagens` carregam em paralelo com `fetchClienteData()`.
- Se o efeito dispara quando as mensagens chegam, mas `botDesabilitado`/`fichaStatus` ainda não foram preenchidos, `generateSuggestion()` sai cedo e não tenta de novo na mesma abertura.
- No cenário “operador aguardando”, hoje ele só reavalia no `setInterval` de 60s, então pode parecer que não funcionou “na hora”.
- Além disso, o `totalOrcamentos` está sendo calculado na tabela errada (`fichas_de_servico`), então o contexto enviado para a IA está incompleto.

Plano de ajuste final:
1. Corrigir o gatilho de abertura da conversa em `src/components/ChatWindowBeta.tsx`
- Adicionar um efeito de “hidratação pronta” que rode quando `mensagens`, `botDesabilitado` e `fichaStatus` já estiverem carregados.
- Nesse momento:
  - se a última mensagem for do cliente, gerar sugestão imediatamente;
  - se a última mensagem for do operador e já passaram 3+ minutos sem resposta do cliente, gerar a sugestão imediatamente também, sem esperar o próximo minuto.

2. Evitar perda por corrida assíncrona
- Criar uma flag de contexto pronto (ex.: `contextReady`) ou derivar readiness a partir dos dados carregados.
- Só permitir a primeira avaliação automática depois que o contexto da conversa estiver completo.

3. Evitar sugestões duplicadas
- Reaproveitar `suggestionGeneratedRef` para guardar uma assinatura da última avaliação (ex.: telefone + último message id + trigger).
- Isso impede gerar a mesma sugestão várias vezes em re-renders, polling e realtime.

4. Corrigir contexto enviado para a IA
- Buscar `totalOrcamentos` na tabela `orcamentos`, filtrando pela ficha atual.
- Continuar enviando `fichaStatus`, `totalOrcamentos`, `minutosDesdeUltimaMsg` e `trigger`.

5. Manter e validar o destaque na lista
- O piscar da conversa já está conectado no pai (`ChatBeta.tsx`).
- Vou apenas garantir que ele seja acionado também nessa geração imediata ao abrir uma conversa antiga elegível.

Arquivos a ajustar:
- `src/components/ChatWindowBeta.tsx`
  - corrigir ordem/trigger da geração automática
  - adicionar avaliação imediata na abertura
  - corrigir query de `totalOrcamentos`
  - adicionar deduplicação
- `src/pages/ChatBeta.tsx`
  - sem mudança estrutural; só conferir que o callback atual continua cobrindo o highlight
- `src/components/ConversationListBeta.tsx`
- `src/components/ConversationCard.tsx`
  - provavelmente sem mudança adicional, só validar fluxo já existente

Comportamento esperado depois do ajuste:
- Conversa antiga aberta + cliente foi o último a falar: sugestão aparece na hora.
- Conversa antiga aberta + operador foi o último a falar há mais de 3 min: sugestão aparece na hora.
- Conversa aberta + ainda não bateu 3 min: nada aparece até atingir o threshold.
- Conversa nova chegando em realtime: continua funcionando normalmente.
- Nova sugestão gerada: conversa pisca na lista.
- Abrir a conversa ou usar a sugestão: destaque é limpo.

Safeguards:
- Nenhuma alteração de banco, timezone ou dados persistidos.
- A mudança é só de frontend e só afeta quando a sugestão é exibida, não altera mensagens existentes nem fichas salvas.
