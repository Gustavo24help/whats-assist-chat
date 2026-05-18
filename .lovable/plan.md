## Diagnóstico

A conversa do telefone `whatsapp:+554197973799` tem 15 mensagens recentes do cliente salvas com:
- `tipo_remetente = NULL`
- `remetente = 'whatsapp:+554197973799'` (o próprio número do cliente, não a string `'cliente'`)

A função SQL `get_unread_state_for_user` (usada pelo Chat para calcular a bolinha) filtra apenas:
```sql
where (m.tipo_remetente = 'cliente' or m.remetente = 'cliente')
```

Como nenhuma das duas condições casa, essas mensagens são ignoradas → `ultima_data_cliente` vem nulo, `total_nao_lidas = 0`, `is_unread = false`. Resultado: **sem bolinha, mesmo com mensagem nova do cliente**.

O helper do frontend (`isClientMessage` em `src/lib/chatBetaUnread.ts`) já trata esse caso corretamente (considera inbound quando o `remetente` não está na lista de saída), mas a SQL não. Há também o problema de origem: o `twilio-webhook` / `sync-twilio-messages` está gravando inbound sem setar `tipo_remetente='cliente'`.

## Plano

### 1. Corrigir a função SQL `get_unread_state_for_user` (e a irmã `get_unread_cliente_msgs`)

Trocar o filtro de "mensagem do cliente" por uma regra equivalente ao frontend:

```sql
-- inbound = tipo_remetente='cliente' OR (remetente é o próprio cliente_id)
where (
  m.tipo_remetente = 'cliente'
  or m.remetente = m.cliente_id
  or m.remetente = 'cliente'
)
and (
  m.tipo_remetente is null
  or m.tipo_remetente not in ('atendente','bot','operador','system','sistema')
)
```

Isso resolve imediatamente os ~1500 contatos com mensagens salvas em formato legado, sem precisar fazer backfill.

### 2. Garantir no source que toda mensagem inbound nasça com `tipo_remetente='cliente'`

Auditar e ajustar onde a inserção vem sem `tipo_remetente`:
- `supabase/functions/twilio-webhook/index.ts` (entrada principal)
- `supabase/functions/sync-twilio-messages/index.ts`
- `supabase/functions/sync-twilio-messages-com-recuperacao/index.ts`
- `supabase/functions/recover-prestador-history/index.ts` (se aplicável a cliente)

Regra: se `From` é o número do cliente (não é um número Twilio nosso), gravar `tipo_remetente='cliente'`. Mantém retrocompatibilidade com mensagens já existentes.

### 3. Atualizar o trigger `aumentar_nao_lidos_nova_msg`

Hoje usa `IF NEW.remetente = 'cliente'`, que também nunca casa (legado da tabela antiga `conversa_operador_leitura`). Como o sistema vigente é `mensagem_leitura_operador` v3, o trigger virou ruído — vamos **remover** o trigger ou ajustar o filtro para `remetente = cliente_id`. Decisão: remover, já que a fonte de verdade é `mensagem_leitura_operador` calculado on-demand.

### 4. Validação

Após aplicar:
- Rodar `SELECT * FROM get_unread_state_for_user(ARRAY['whatsapp:+554197973799'])` na sessão do operador `cac6e28a-fa91-4c6d-a3c8-5f2804b18304` (atual atendente da conversa) e confirmar `is_unread=true` e `total_nao_lidas>0`.
- Abrir `/chat-beta` e conferir bolinha na lista para esse contato.
- Enviar mensagem de teste de outro número e verificar que a bolinha aparece em tempo real.

### Segurança / dados existentes

- **Sem migration de dados**: nenhuma mensagem antiga será reescrita. Só o filtro da função SQL muda. Conversas que já estavam corretas continuam corretas.
- **Não afeta leitura**: `last_read_at` continua sendo respeitado, então conversas marcadas como lidas continuam sem bolinha (a menos que tenha chegado msg depois).
- **Sem mudança de timezone, valores ou status de ficha.**

## Detalhes técnicos (resumo)

| Arquivo | Mudança |
|---|---|
| Migration SQL | Recriar `get_unread_state_for_user` e `get_unread_cliente_msgs` com filtro corrigido |
| Migration SQL | `DROP TRIGGER` de `aumentar_nao_lidos_nova_msg` (ou recriar com filtro novo) |
| `twilio-webhook/index.ts` | Forçar `tipo_remetente: 'cliente'` no insert inbound |
| `sync-twilio-messages*/index.ts` | Idem para mensagens reconstruídas vindas do Twilio |
