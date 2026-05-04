Diagnóstico confirmado:

1. O problema não é só cache visual. Existem operadores sem nenhum registro em `mensagem_leitura_operador`.
   - Leonardo Karam: 0 registros de leitura; por isso aparecem cerca de 1501 conversas não lidas.
   - Melvin: 0 registros de leitura; mesmo efeito.
   - Outros operadores têm quase todos os registros, mas ainda há 1 conversa sem registro e algumas mensagens novas.

2. A regra atual interpreta ausência de registro como “nunca leu”. Então, se um operador não tem linha em `mensagem_leitura_operador`, todas as mensagens históricas do cliente contam como não lidas.

3. Ao clicar numa conversa, o frontend zera a bolinha localmente, mas o chat principal (`/chat`) chama leitura automática que atualiza só `last_read_at` e não limpa `manual_unread`. Além disso, se a gravação falhar ou o operador estiver sem seed completo, o próximo refresh/realtime recalcula do banco e a bolinha volta.

4. O reset anterior foi incompleto porque não criou/atualizou linhas para todos os operadores ativos em todas as conversas ativas. Ele deixou usuários inteiros sem histórico de leitura.

Plano definitivo, sem mudar regras de negócio:

1. Fazer um reset transacional completo no banco
   - Para cada operador existente em `profiles` e cada conversa ativa/não arquivada em `clientes`, criar ou atualizar uma linha em `mensagem_leitura_operador`.
   - Definir:
     - `last_read_at = now()`
     - `manual_unread = false`
     - `manual_unread_at = null`
   - Limpar também o campo legado global em `clientes`:
     - `marcado_nao_lido = false`
     - `marcado_nao_lido_manual_em = null`
   - Não alterar mensagens, clientes, fichas, status, operadores, regras de bot, tags, atendente, nem parâmetros de negócio.

2. Corrigir o comportamento de clique no chat principal e mobile para não voltar bolinha
   - Em `/chat`, quando abrir uma conversa, usar leitura explícita (`markConversationRead`) em vez de leitura automática (`markConversationAutoRead`).
   - Em mobile, aplicar o mesmo: abrir conversa = marcar como lida explicitamente.
   - Isso mantém a regra atual de “marcar manualmente como não lida” quando usado pelo menu, mas garante que clicar/abrir realmente considera lido, que é o comportamento esperado pelo usuário.

3. Tornar o cálculo robusto quando faltar linha de leitura
   - Ajustar a RPC `get_unread_cliente_msgs` para receber um `baseline` opcional ou usar uma função nova de reset/seed, evitando que usuários novos/sem seed vejam todo o histórico como não lido por acidente.
   - A regra continua a mesma para novas mensagens: mensagens do cliente depois de `last_read_at` geram não lido.
   - O objetivo é impedir que ausência histórica de registro seja confundida com milhares de não lidas depois de um reset.

4. Remover fontes legadas que ainda podem confundir visualmente
   - Garantir que os cards e contadores usem somente `mensagem_leitura_operador` como fonte de verdade.
   - Manter `clientes.marcado_nao_lido` apenas limpo/legado, sem usar para badge.

5. Validação pós-correção
   - Rodar consulta de conferência por operador:
     - número de conversas não lidas deve ficar 0 logo após reset, salvo se entrar mensagem nova durante a execução.
     - número de linhas ausentes em `mensagem_leitura_operador` deve ficar 0 para conversas ativas.
   - Conferir exemplos da tela enviada: Andressa Melo Coimbra, Alessandra Serafini, Amanda Nicco e Kendra devem ficar sem bolinha se não houver mensagem nova após o reset.

Impacto esperado:
- Zera de verdade os não lidos atuais para todos os operadores.
- A partir desse ponto, só novas mensagens do cliente voltam a gerar bolinha.
- Clicar/abrir conversa passa a limpar definitivamente a bolinha para o operador atual.
- Não muda parâmetros, regras de bot, status, mensagens, fichas, cálculos financeiros, Twilio ou automações.