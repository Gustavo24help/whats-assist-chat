

## Criar Edge Function sync-twilio-messages

### O que sera feito

1. **Criar o arquivo** `supabase/functions/sync-twilio-messages/index.ts` com o codigo completo que voce enviou
2. **Adicionar configuracao** no `supabase/config.toml` com `verify_jwt = false` (ja que sera chamada externamente via POST simples)
3. **Deploy automatico** da funcao

### Pre-requisitos ja atendidos

- A tabela `twilio_sync_control` ja existe no banco de dados
- O secret `TWILIO_AUTH_TOKEN` ja esta configurado
- O secret `TWILIO_ACCOUNT_SID` ja esta configurado

### Observacao importante

O conteudo do arquivo enviado foi truncado na linha 72 (de 260 linhas totais). Vou precisar que voce envie o restante do codigo (linhas 73-260) ou o arquivo completo novamente para que eu possa criar a funcao com o codigo completo.

### Apos criacao

- A funcao sera deployada automaticamente
- Podera ser testada com o comando PowerShell que voce indicou:
```text
Invoke-WebRequest -Uri "https://halqtsowfqkczvlvwmdd.supabase.co/functions/v1/sync-twilio-messages" -Method POST
```

