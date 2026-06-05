Diagnóstico rápido:

- O número `15997781885` está atualmente com `bot_habilitado = false` no banco.
- Não encontrei histórico de ação `ligado` para esse número; só existem dois registros `desligado`.
- O problema real apareceu nos logs: `check-bot-status` está quebrando porque consulta a coluna `clientes.id`, mas a tabela `clientes` não tem coluna `id`.
- Como a função foi escrita para “fail-open” em erro de banco, quando essa checagem quebra ela retorna `enabled`. Isso explica o bot parecer ativar “do nada”.

Plano seguro:

1. Corrigir `check-bot-status`
   - Remover `id` do `.select(...)` da tabela `clientes`.
   - Manter a busca por variações do telefone.
   - Manter a regra conservadora: se qualquer registro correspondente estiver `bot_habilitado=false`, retornar `disabled`.

2. Tornar o erro menos perigoso
   - Para erro específico de schema/consulta, não retornar `enabled` silenciosamente.
   - Retornar um erro claro ou `disabled` em modo seguro para não deixar a IA responder quando a checagem falha.
   - Preservar primeiro contato sem cliente cadastrado como `enabled`, para não quebrar novos leads.

3. Validar com o número problemático
   - Testar `check-bot-status` com `whatsapp:+5515997781885`.
   - Confirmar que retorna `disabled`.
   - Conferir logs da função depois do teste.

4. Deploy da função corrigida
   - Deploy somente de `check-bot-status`.
   - Não mexer em transições do Studio, reativação automática, nem no widget que desliga o bot no fim da pré-qualificação.

O ponto principal: não foi “tudo para nada”; achamos a causa concreta. A nova função estava com uma coluna inexistente e por isso caía no comportamento antigo de liberar o bot.