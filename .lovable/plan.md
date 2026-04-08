
Diagnóstico encontrado

O problema não é visual nem da tela do chat “esconder” parte da conversa.
Para o telefone 5541999198393, o banco hoje realmente só tem 2 mensagens em `mensagens_prestadores`, ambas enviadas por nós, nestes horários:
- 2026-03-27 20:09:51
- 2026-03-27 20:10:21

Ou seja: a conversa aparece “cortada” porque o histórico salvo para esse prestador já está incompleto na base.

Causa raiz identificada

Há dois pontos no histórico do projeto que explicam isso:

1. Migrações antigas moveram mensagens do número de prestadores de `mensagens` para `mensagens_prestadores`
- existe uma migração que copiou para `mensagens_prestadores` tudo que estivesse ligado ao número `554138910814`
- outra migração depois apagou esses registros da tabela antiga

2. Esse processo dependeu do que já existia em `mensagens` naquele momento
- então, se só parte do fluxo estava lá, ou se mensagens anteriores/respostas do prestador não estavam presentes/associadas corretamente, o chat novo ficou só com esse “pedaço final”
- no caso investigado, não existe mais histórico complementar para esse telefone nem em `mensagens`, então o recorte atual virou o histórico oficial desse chat

Por que isso acontece em “várias outras”
- porque não parece ser um caso isolado de renderização
- parece um efeito de migração/sincronização histórica do canal de prestadores
- alguns chats foram criados com apenas mensagens outbound que estavam disponíveis no momento da cópia

O que eu faria para corrigir

1. Mapear os chats afetados
- identificar conversas de prestadores com histórico suspeito, por exemplo:
  - apenas mensagens outbound
  - sem nenhuma mensagem inbound
  - primeira mensagem já aparentando continuação de fluxo
  - volume muito baixo e padrão de onboarding/template

2. Fazer uma recuperação histórica controlada
- revisar a lógica de `sync-twilio-messages` para reconstruir corretamente o histórico dos prestadores a partir da origem externa
- cruzar por `message_sid`, telefone normalizado e número Twilio usado
- inserir apenas o que estiver faltando, sem duplicar o que já existe

3. Adicionar salvaguardas para não piorar dados já existentes
- não sobrescrever mensagens atuais
- não alterar timestamps existentes já corretos
- não mexer em chats saudáveis
- limitar a correção apenas aos telefones detectados como incompletos

4. Validar no preview e depois em um conjunto pequeno de telefones
- começar pelo 5541999198393
- comparar antes/depois
- só então ampliar para os demais chats afetados

Por que essa solução faz sentido
- porque o defeito está no dado salvo, não na interface
- esconder/filter/remarcar conversa não resolve
- a solução correta é reconstruir o histórico faltante com critério e deduplicação, preservando tudo que já está certo

Se você aprovar, eu sigo com um plano de correção em 2 frentes:
- ajuste da rotina de recuperação histórica dos chats de prestadores
- recuperação segura dos telefones afetados, começando por 5541999198393
