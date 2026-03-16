

## Corrigir CORS em todas as Edge Functions

### Problema
O botão de desativar bot chama `stop-twilio-flow` e `toggle-bot-status`. Ambas têm CORS desatualizado (faltam headers `x-supabase-client-platform`, etc.), causando "Failed to fetch" no preflight — o request nem chega ao backend.

É o mesmo bug que afetava `send-whatsapp`, que já foi corrigido. Mas as outras funções ficaram para trás.

### Plano

Atualizar o `corsHeaders` em **todas** as edge functions que ainda usam o formato antigo. São ~20 funções:

- `stop-twilio-flow`
- `toggle-bot-status`
- `send-template`
- `manage-users`
- `force-recover-message-sids`
- `update-pagamento`
- `update-message-status`
- `twilio-status-callback`
- `summarize-conversation`
- `check-bot-status`
- `check-orcamento-forms`
- `update-prestador-idcrm`
- `sync-messages`
- `clean-description`
- `create-payment-link`
- `process-bot-reactivation`
- `recover-message-sids`
- `twilio-webhook`
- `submit-orcamento`
- `webhook-financeiro`
- `webhook-update-planilha`
- `search-messages`
- `get-twilio-templates`
- `sync-google-ads`
- `reactivate-bots-24h`
- `sync-twilio-messages-com-recuperacao`

**De:**
```
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
```

**Para:**
```
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

As 5 funções que já foram atualizadas (`send-whatsapp`, `reprocess-backup-queue`, `monitor-mensagens`, `search-ficha-id`, `sync-twilio-messages`) não precisam de alteração.

### Resultado
- Botão de desativar bot volta a funcionar
- Todas as outras chamadas do frontend para edge functions ficam protegidas contra o mesmo erro
- Deploy automático ao salvar

