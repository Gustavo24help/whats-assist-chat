# Chat BETA — Sistema de Leitura / Não Lido

## Fonte de verdade
Tabela `public.mensagem_leitura_operador` (uma linha por par `user_id` + `cliente_telefone`).

Colunas relevantes:
- `last_read_at` — timestamp da última leitura efetiva.
- `manual_unread` (boolean) — flag explícita de "marcado como não lido".
- `manual_unread_at` — apenas auditoria; **não** participa da regra de cálculo.

## Regra única de "não lido"
Para um operador X numa conversa Y:

```
unread = manual_unread === true
      OR (data_hora da última mensagem do cliente Y) > last_read_at
```

Se não existir registro para o par, considera-se `last_read_at = null` e `manual_unread = false`.
Nesse caso, qualquer mensagem do cliente disponível conta como não lida.

## Eventos que escrevem na tabela
1. **Abrir conversa** → `markConversationRead` (zera flag, atualiza `last_read_at`).
2. **Chegou mensagem do cliente com a conversa aberta** → `markConversationRead` (somente para o operador que está vendo).
3. **Menu → "Marcar como Não Lida"** → `markConversationUnread` (só sobe flag, **não** mexe em `last_read_at`).
4. **Menu → "Marcar como Lida"** → `markConversationRead`.

> Carregamento de lista, polling e realtime **NUNCA** escrevem nessa tabela.

## Frontend
- `src/lib/chatBetaUnread.ts` — única porta de entrada para mudar leitura.
- `ConversationListBeta.tsx` — apenas **lê** a tabela e renderiza badge a partir do snapshot.
- `ChatWindowBeta.tsx` — chama `markConversationRead` ao abrir / receber msg.
- `NotificationSystem.tsx` — toast/som apenas; **não** controla badge.

## Filtros derivados
- "Não lidas" usa exatamente a mesma derivação acima — não há OR com estado local.
- Alerta "precisando de resposta" usa critério separado (status da ficha + VT vencida) e nunca depende de unread.

## Por que assim
Antes existiam dois sistemas competindo (estado local em React + tabela), o que fazia a bolinha de não lido reaparecer alguns segundos depois da leitura. Agora há **uma fonte só**, e a flag manual é um bit explícito que ninguém sobrescreve sem ação do operador.
