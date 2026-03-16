

## Deploy da Edge Function `twilio-status-callback`

A função já existe em `supabase/functions/twilio-status-callback/index.ts`. Vou fazer o deploy dela no backend.

Também preciso garantir que ela está configurada no `supabase/config.toml` com `verify_jwt = false` (já que é um webhook externo do Twilio).

### Ações:
1. Adicionar configuração `[functions.twilio-status-callback]` no `config.toml` (já existe)
2. Fazer deploy da função usando a ferramenta de deploy

