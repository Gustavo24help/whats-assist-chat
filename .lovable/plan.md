

# Atualizar token do webhook Asaas

## O que está acontecendo
O webhook do Asaas está enviando o token `whsec_aGtKk0SR3NwVGiKEG-OdxNnqS8XmkYpszkBqkOLVnic` no header, mas o secret armazenado no backend tem um valor diferente. Por isso retorna 401.

## Ação
Atualizar o secret `ASAAS_WEBHOOK_TOKEN` com o novo valor fornecido. Nenhuma alteração de código é necessária — a Edge Function já lê esse secret corretamente.

