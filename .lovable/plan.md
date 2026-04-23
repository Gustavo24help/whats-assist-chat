
Objetivo: desmontar o sistema atual de lido/não lido do /chat-beta e reconstruí-lo com uma única fonte de verdade, garantindo que “Marcar como não lido” funcione de forma previsível e não volte a quebrar por polling, realtime ou estado local.

1. Causa raiz identificada
- Hoje o /chat-beta usa 2 sistemas ao mesmo tempo para “não lido”:
  - estado local em `ChatBeta.tsx` / `NotificationSystem.tsx` (`unreadMessages`)
  - estado persistido em `mensagem_leitura_operador`
- A lista mistura os dois com `OR`, então um sistema limpa e o outro recria a bolinha alguns segundos depois.
- `ChatWindowBeta.tsx` limpa leitura automaticamente ao abrir a conversa e também ao chegar nova mensagem, enquanto `ConversationListBeta.tsx` tenta preservar/forçar estado manual. Essas regras competem entre si.
- O “marcar como não lido” no beta foi implementado com acoplamento frágil entre `manual_unread_at` e `last_read_at`, inclusive reescrevendo `last_read_at` para trás. Isso torna o comportamento dependente de timing.
- `fetchClientes()` hoje também escreve no banco durante carregamento da lista (seed de leitura), o que não deveria acontecer numa rotina de leitura.
- Resultado: o badge reaparece, some errado, e o estado manual não é confiável.

2. O que será reconstruído do zero
Vou refazer todo o fluxo de leitura do Chat Beta com esta arquitetura:
- Uma única fonte de verdade para unread/read: backend.
- O frontend não vai mais “inventar” contagem local para badge.
- “Marcar como não lido” vira estado explícito e separado da leitura automática.
- Abertura da conversa, chegada de nova mensagem, troca de conversa e ação manual passam a usar regras únicas e centralizadas.

3. Nova arquitetura proposta
Backend
- Evoluir `mensagem_leitura_operador` para um modelo explícito:
  - `last_read_at`
  - `manual_unread` boolean
  - `manual_unread_at` apenas como auditoria/ordenação, não como regra principal
- Criar uma função/view de snapshot do Chat Beta para retornar por conversa:
  - último timestamp de mensagem do cliente
  - quantidade de mensagens do cliente após `last_read_at`
  - flag manual de não lido
  - badge final derivado
  - dados da ficha atual usados pela lista/filtros
- Regra final:
  - se `manual_unread = true`, a conversa fica não lida até ação explícita de marcar como lida
  - se `manual_unread = false`, não lido = mensagens do cliente posteriores a `last_read_at`
  - abrir a conversa marca como lida
  - nova mensagem do cliente enquanto a conversa está aberta marca como lida automaticamente só para aquele operador

Frontend
- Remover o uso de `unreadMessages` como fonte de badge no `/chat-beta`
- `NotificationSystem` fica só com toast/som; não controla mais bolinha
- `ConversationListBeta` passa a renderizar badge/filtro apenas a partir do snapshot
- `ChatWindowBeta` passa a chamar ações únicas:
  - `markConversationRead`
  - `markConversationUnread`
- “Marcar como não lido” não vai mais mexer em `last_read_at`; só ativa a flag manual

4. Arquivos e áreas que serão revisados/registrados
Vou documentar e alinhar tudo que hoje participa da visualização/leitura:
- `src/pages/ChatBeta.tsx`
- `src/components/ConversationListBeta.tsx`
- `src/components/ChatWindowBeta.tsx`
- `src/components/ConversationCard.tsx`
- `src/components/NotificationSystem.tsx`
- `src/components/chat-beta/ChatBetaFilterSidebar.tsx`
- migrações ligadas a `mensagem_leitura_operador`
- qualquer trecho compartilhado do chat clássico que hoje contamine a mesma lógica
Também vou criar uma documentação técnica curta em `documentação/` registrando:
- fonte de verdade
- ciclo de leitura
- eventos que marcam como lido
- diferença entre “não lido real” e “não lido manual”

5. Safeguards para não quebrar dados existentes
- Não vou alterar `mensagens.data_hora`, `clientes.ultima_interacao`, horários de agendamento nem qualquer campo sensível a datas.
- A migração vai preservar os registros atuais e fazer backfill seguro:
  - `manual_unread = true` quando o estado atual realmente representar marcação manual ativa
- O sistema antigo não será removido de forma destrutiva no primeiro passo; primeiro entra a nova lógica, depois limpo o legado somente se tudo validar.
- Nada de “seed” automático de leitura durante carregamento da lista.

6. Ajustes paralelos que entram junto
Como o unread hoje afeta filtros e contadores, vou alinhar junto:
- filtros de “não lidas” passam a usar só o snapshot novo
- contadores laterais usam a mesma regra da lista
- o alerta “precisando de resposta” passa a usar a mesma base de conversa atual para não misturar terminal/perdido indevidamente

7. Critérios de aceite
Vou considerar concluído quando estes cenários funcionarem:
- marcar uma conversa como não lida mantém a bolinha estável
- abrir essa conversa não recria nem apaga errado, conforme a regra final da ação manual
- ler uma mensagem e trocar de conversa remove a bolinha e ela não volta sozinha
- nova mensagem do cliente em conversa fechada gera badge corretamente
- nova mensagem do cliente em conversa aberta não cria badge para o operador atual
- operadores diferentes têm estados independentes
- filtro “não lidas” mostra exatamente o mesmo conjunto da bolinha
- filtros do chat beta não deixam “Perdido” vazar em listas que dependem do estado atual acionável

8. Implementação em ordem
1. Auditar e registrar o fluxo atual em documentação técnica
2. Criar migração segura para explicitar o estado manual
3. Criar função/view de snapshot do Chat Beta no backend
4. Refatorar `/chat-beta` para consumir só esse snapshot
5. Remover a dependência de `unreadMessages` no beta
6. Reescrever as ações de marcar lido/não lido
7. Ajustar realtime/polling para só invalidar snapshot, sem recalcular badge em dois lugares
8. Validar cenários reais de troca de conversa, leitura, marcação manual e filtros
