

# Correção: sync-twilio-messages salvando mensagens de prestadores no chat de clientes

## Problema

A edge function `sync-twilio-messages` busca mensagens de TODOS os números Twilio gerenciados (incluindo o número 2 de prestadores), mas salva TUDO na tabela `mensagens` + `clientes`. Não tem nenhuma lógica de roteamento para prestadores como o `twilio-webhook` tem.

Resultado: mensagens do número de prestadores aparecem duplicadas no chat de clientes, misturando os dois canais.

O `twilio-webhook` já faz o roteamento correto (linhas 120-230), verificando `isPrestadoresNumber()` e salvando em `mensagens_prestadores` + `prestadores_chat`. Mas o `sync-twilio-messages` ignora isso completamente.

## Correção

### `supabase/functions/sync-twilio-messages/index.ts`

Adicionar a mesma lógica de roteamento do webhook:

1. Importar `isPrestadoresNumber` do shared module (já exportado)
2. No loop de processamento (linha ~248), após determinar `telefoneCliente` e o número gerenciado:
   - Verificar se o número gerenciado é o de prestadores via `isPrestadoresNumber()`
   - Se for prestadores: buscar/criar em `prestadores_chat`, salvar em `mensagens_prestadores`, pular a lógica de `clientes`/`mensagens`
   - Se não for: manter o fluxo atual (clientes + mensagens)

Isso espelha exatamente o que o `twilio-webhook` já faz nas linhas 120-230.

