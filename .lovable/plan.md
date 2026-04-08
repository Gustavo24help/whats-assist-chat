

# Plano: Corrigir conversas fantasma no Chat Prestadores

## Problema
Várias conversas no Chat Prestadores aparecem começando com mensagens do sistema (onboarding, fichas de serviço, etc.) sem nenhuma resposta do prestador. Isso acontece porque:

1. A função `send-whatsapp` atualiza `ultima_interacao` em toda mensagem enviada (outbound), fazendo conversas unilaterais parecerem recentes
2. O `sync-twilio-messages` cria entradas `prestadores_chat` ao sincronizar mensagens históricas outbound, gerando conversas que o prestador nunca iniciou
3. Não há distinção visual entre conversas com interação real e conversas apenas com mensagens do sistema

## Solução

### 1. Parar de atualizar `ultima_interacao` em mensagens outbound

No `send-whatsapp`, remover a atualização de `ultima_interacao` ao enviar mensagem para prestador (linhas 306-309). Essa atualização já é feita corretamente no `twilio-webhook` apenas para mensagens inbound.

### 2. Adicionar indicador visual na lista de conversas

Na `ConversationListPrestadores`, usar a contagem de mensagens do prestador (já disponível via last message) para indicar conversas sem resposta. Conversas onde o prestador nunca respondeu ficam com opacidade reduzida e badge "Sem resposta".

### 3. Filtro para ocultar conversas sem interação

Adicionar um toggle na lista para mostrar/ocultar conversas onde o prestador nunca enviou mensagem. Padrão: ocultar.

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/send-whatsapp/index.ts` | Remover update de `ultima_interacao` para prestadores no envio outbound |
| `src/components/prestador-chat/ConversationListPrestadores.tsx` | Adicionar filtro "sem resposta" + indicador visual |

## Ordem
1. Deploy da edge function corrigida
2. Atualizar frontend com filtro

## Observações
- Dados existentes não são alterados
- Conversas "fantasma" existentes continuam acessíveis via filtro
- A `ultima_interacao` dos registros antigos não será recalculada (seria necessária uma migração manual de dados, se desejado)

