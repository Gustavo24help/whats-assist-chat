
Diagnóstico objetivo:

- O problema de “não lido” no Chat BETA não está no banco disparando errado; está na leitura do frontend.
- As mensagens novas do cliente estão sendo salvas com `remetente = telefone do cliente` e `tipo_remetente = 'cliente'`.
- O Chat BETA hoje procura “última mensagem do cliente” com `remetente = 'cliente'`, então ele simplesmente ignora várias mensagens reais recebidas via webhook/Twilio.
- O problema de “inativo → ativo” também não está no trigger principal: no banco a conversa do teste já ficou `status_conversa = 'aberta'`.
- O que está errado é o critério visual do Chat BETA: o filtro “Ativas/Inativas” usa `status_ficha` da última ficha, não `status_conversa`. Então se a última ficha estiver `Perdido`/`Finalizado`, a conversa continua aparecendo como inativa mesmo após nova mensagem.
- Também encontrei um risco adicional: existem dois telefones muito parecidos no banco (`+554198751600` com atividade recente e `+5541998751600` antigo). Não vou propor mesclar nada automaticamente para não quebrar histórico, mas isso precisa entrar como salvaguarda de normalização.

Plano de correção:

1. Corrigir a detecção de mensagem de cliente no Chat BETA
- Atualizar `ConversationListBeta.tsx` para considerar mensagem do cliente quando:
  - `tipo_remetente = 'cliente'`, ou
  - `remetente = telefone do cliente`, ou
  - legado `remetente = 'cliente'`
- Isso será compatível com dados antigos e novos, sem reescrever mensagens já salvas.

2. Corrigir o critério de “Ativas/Inativas”
- Trocar a lógica do bloco “Ativas / Inativas / Todas” no Chat BETA para usar `clientes.status_conversa` como fonte principal.
- Manter `status_ficha` apenas para filtros e contagens de status da ficha.
- Resultado esperado: entrou mensagem nova, `status_conversa` voltou para `aberta`, então a conversa volta para “Ativas”.

3. Alinhar contagens e filtros à mesma regra
- Ajustar lista, badge, contadores laterais e filtros para usarem a mesma definição de:
  - conversa ativa/inativa
  - conversa não lida/lida
- Isso evita o cenário em que o card fica azul mas some da lista, ou o banco está “aberto” e a UI mostra “inativa”.

4. Preservar dados existentes
- Não fazer migração destrutiva nem alterar timestamps/históricos já gravados.
- A correção será de leitura/compatibilidade, justamente para evitar repetir problemas de alteração indevida em dados antigos.
- Se eu precisar tratar a divergência dos dois telefones parecidos, será só como validação/normalização futura, nunca mesclando registros automaticamente agora.

5. Aplicar a mesma compatibilidade no chat clássico
- Como o chat antigo tem a mesma dependência de `remetente = 'cliente'`, vou replicar a correção ali também para não continuar existindo dois comportamentos diferentes no sistema.

6. Fechar com validação real, não só “resposta positiva”
- Antes de considerar concluído, vou validar estes critérios:
  - nova mensagem recebida marca o card como não lido
  - isso acontece por usuário, de forma independente
  - ao abrir a conversa, o “não lido” sai só para quem abriu
  - conversa com última ficha `Perdido/Finalizado` volta para “Ativas” ao receber nova mensagem
  - nada do histórico existente é regravado ou deslocado

Como evitar você precisar repetir 8 vezes:
- A partir daqui, a correção precisa ser tratada com “critério de aceite verificável”, não só “implementei”.
- Ou seja: corrigir, conferir no banco qual registro mudou, conferir no preview se a conversa reapareceu em “Ativas”, e só então dar como finalizado.
- Nesta análise eu já identifiquei a causa real, então o próximo passo é implementar exatamente nesses pontos, em vez de tentar ajustes genéricos.

Arquivos que entram na correção:
- `src/components/ConversationListBeta.tsx`
- `src/components/ConversationList.tsx`
- possivelmente um pequeno helper compartilhado de identificação de mensagem do cliente, se fizer sentido para evitar regressão

Observação importante:
- Para o caso do seu teste, o banco mostra que a conversa recente está em `status_conversa = 'aberta'`; então o bug principal do “não voltou para ativo” é visual/regra de filtro no Chat BETA, não falta de trigger.
