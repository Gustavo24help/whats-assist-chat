

## Deploy da função sync-twilio-messages

Tarefa simples: fazer o deploy da Edge Function `sync-twilio-messages` que ja existe no projeto.

### Acao

Executar o deploy da funcao `sync-twilio-messages` para o ambiente de producao. A funcao ja esta configurada no `supabase/config.toml` com `verify_jwt = false`.

### Arquivo envolvido

| Arquivo | Acao |
|---------|------|
| `supabase/functions/sync-twilio-messages/index.ts` | Deploy (sem alteracoes no codigo) |

