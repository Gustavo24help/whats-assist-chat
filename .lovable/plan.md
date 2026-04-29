
## Diagnóstico

Os operadores estão recebendo dezenas de notificações **"{usuário} atribuiu {ficha} para você"** ao logar (e em outros momentos) sem que ninguém tenha atribuído nada manualmente.

### Causa raiz confirmada nos dados

Ao consultar a tabela `notificacoes`, encontramos rajadas de 14+ notificações `chat_atribuido` criadas no mesmo segundo, todas para o mesmo destinatário, todas dizendo "Valentina Menarim atribuiu". Isso só pode vir de uma operação em **lote**.

A operação em lote é a função `redistributeChats` em `src/hooks/useLogoutRedistribution.ts`:

1. Quando um operador faz logout (ou expira por inatividade), o sistema pega **todos os clientes** atribuídos a ele.
2. Faz `UPDATE clientes SET atendente_id = <próximo da cadeia>` em chunks de 50.
3. Cada UPDATE dispara o trigger `notify_chat_takeover` (migration `20260416165030`), que insere uma notificação `chat_atribuido` para o novo atendente, com a frase "X atribuiu você à conversa de Y".

O `_assigner_id` (`auth.uid()`) acaba sendo o usuário que está deslogando (ou outro usuário cuja sessão está rodando o update), e o `usuario_destino` é o "próximo da cadeia" — que recebe a enxurrada de notificações falsas, achando que aquele colega lhe atribuiu manualmente cada chat.

Existe uma flag `redistribuicao-em-andamento` no `localStorage`, mas ela só silencia popups no frontend — o **trigger no banco não tem como saber** que é uma redistribuição automática, então persiste as notificações no banco e elas reaparecem a qualquer momento (no próximo `loadUnreadNotifications` ao logar).

Fontes relacionadas que também disparam esse trigger (corretamente, mas vale revisar):
- `send-whatsapp` e `send-template` setam `atendente_id` ao enviar mensagem → takeover legítimo.
- Edição manual de operador no `ChatWindow` / `ConversationList` → atribuição manual legítima.

## Solução

Marcar a sessão Postgres como "em redistribuição" antes de fazer o UPDATE em massa, e fazer o trigger pular a criação de notificações nesse contexto.

### Mudanças

**1. Migração SQL — atualizar `notify_chat_takeover`**

Ler uma flag de sessão (`current_setting('app.skip_takeover_notif', true)`). Se estiver `'true'`, o trigger faz `RETURN NEW` sem inserir notificações. Toda a lógica existente de criação de fichas e demais comportamentos do trigger é preservada — só pulamos os 2 INSERTs em `notificacoes`.

**2. Migração SQL — RPC `set_skip_takeover_notif(_skip boolean)`**

Função `SECURITY DEFINER` que faz `PERFORM set_config('app.skip_takeover_notif', _skip::text, true)` (escopo de transação/local) para que o frontend possa ativar/desativar via `supabase.rpc(...)`. Sem isso, o cliente JS não consegue setar GUCs diretamente.

**3. `src/hooks/useLogoutRedistribution.ts`**

Antes de cada chunk de UPDATE, chamar `supabase.rpc('set_skip_takeover_notif', { _skip: true })`. Como o Supabase JS abre uma conexão pool por requisição, o `set_config(..., true)` (local=true) só vale dentro daquela transação — então faremos a chamada **encadeada na mesma request**: usar uma RPC única `redistribute_chats_silent(telefones text[], target_user_id uuid)` que seta o GUC e faz o UPDATE atomicamente. Isso garante que o trigger veja a flag.

**Alternativa mais simples (preferida):** criar a RPC `redistribute_chats_silent` que recebe `telefones[]` + `target_user_id`, seta o GUC local, e faz o UPDATE. O hook chama essa RPC em vez de fazer `.update()` direto, em chunks de 50 como hoje.

**4. Limpeza opcional (sem mexer em dados já gravados)**

Não vamos apagar notificações antigas automaticamente. Se você quiser, podemos adicionar um botão para o usuário "Limpar notificações de atribuição antigas" — me avise.

### Salvaguardas (conforme regra do projeto)

- O trigger continua funcionando exatamente igual para **atribuições manuais** (mudança de operador no chat, envio de template/whatsapp por outro operador). Apenas a redistribuição automática fica silenciosa.
- Nenhum dado existente é alterado. A migração só altera o corpo da function `notify_chat_takeover` e adiciona uma nova RPC.
- A flag `app.skip_takeover_notif` é local à transação (`set_config(..., true)`), então **não vaza** entre conexões do pool.
- Se a RPC falhar por qualquer motivo, o hook faz fallback para o `.update()` antigo (gera as notificações como hoje — comportamento atual, sem regressão).

## Detalhes técnicos

```text
Logout
  └─ redistributeChats(userId)
       ├─ busca clientes do operador
       ├─ resolve targetUserId pela cadeia
       └─ para cada chunk de 50 telefones:
            └─ supabase.rpc('redistribute_chats_silent', {
                 telefones, target_user_id
               })
                  └─ SET LOCAL app.skip_takeover_notif = 'true'
                  └─ UPDATE clientes SET atendente_id = target
                       └─ trigger notify_chat_takeover dispara
                            └─ lê GUC, vê 'true', RETURN NEW (silencioso)
```

Resultado: zero notificações falsas em redistribuição. Atribuições manuais e takeovers reais continuam notificando normalmente.
