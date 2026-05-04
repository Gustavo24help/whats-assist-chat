Entendi. O reset anterior marcou tudo como lido naquele horário, mas depois disso entraram novas mensagens de cliente. Pela regra atual, essas voltaram a aparecer como não lidas — e isso explica o que você ainda está vendo.

Também encontrei um ponto que pode causar confusão: existem campos antigos de “não lido” em `clientes`, mas o Chat principal/BETA hoje usa a tabela por operador `mensagem_leitura_operador`. Não vou mudar regra nenhuma; vou apenas zerar o estado visual atual de leitura de forma compatível com as regras existentes.

Plano:

1. Marcar como lidas novamente todas as conversas ativas para todos os operadores
   - Atualizar `mensagem_leitura_operador` com `last_read_at = agora`, `manual_unread = false`, `manual_unread_at = null`.
   - Fazer isso para todos os clientes ativos e todos os operadores que já existem nessa tabela.
   - Isso preserva a regra atual: futuras mensagens de cliente voltam a gerar não lido normalmente.

2. Limpar somente os indicadores legados que ainda podem aparecer em alguma tela
   - Atualizar `clientes.marcado_nao_lido = false` e `clientes.marcado_nao_lido_manual_em = null` para clientes ativos.
   - Não muda status, bot, ficha, mensagem, atendimento, arquivamento, nem nenhuma regra.
   - É apenas para remover resíduo visual antigo caso alguma tela ainda leia esse campo.

3. Validar no banco depois da operação
   - Conferir se `manual_unread` ficou zerado.
   - Conferir se não existe mensagem de cliente posterior ao novo `last_read_at` no momento do reset.
   - Conferir se os indicadores legados em clientes ativos ficaram zerados.

4. Se ainda aparecer sinal depois disso, aí o problema não é dado: é cache/realtime/frontend
   - Nesse caso, a próxima correção seria forçar a lista a recarregar o estado de leitura depois do reset, mas eu só faria isso se o sinal continuar aparecendo após esta limpeza, porque você pediu para não mudar regras nem parâmetros agora.