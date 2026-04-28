## Problema

Para alguns operadores, conversas com mensagem nova **não exibem a bolinha de não lido**, mas a notificação (toast + som) aparece normalmente. Isso só acontece com quem tem histórico antigo de leitura registrado em `mensagem_leitura_operador`.

## Causa raiz

Em `src/components/ConversationListBeta.tsx`, o cálculo de "não lido" (linhas 1011–1126) depende de duas queries que buscam **todas** as mensagens dos clientes (`tipo_remetente='cliente'` e `remetente='cliente'`):

```
mensagensClienteLegado = chunkedIn('mensagens', ..., telefones, q => q.eq('remetente','cliente'))
mensagensClienteTipo   = chunkedIn('mensagens', ..., telefones, q => q.eq('tipo_remetente','cliente'))
```

O helper `chunkedIn` faz blocos de 500 telefones, mas **não usa paginação por range** — então cada chunk respeita o limite padrão de **1000 linhas do Supabase**. Hoje a base tem ~25.000 mensagens de cliente, então a maioria das mensagens recentes simplesmente não volta no resultado.

Consequência:
- `ultimaMsgClienteMap` fica desatualizado (pega mensagem antiga, não a nova).
- Para operadores **sem** registro em `mensagem_leitura_operador`, ainda aparece como não lido (cai no ramo `if (lastClientMsg)` com `lastReadAt = null`).
- Para operadores **com** `last_read_at` antigo (qualquer um que já abriu a conversa uma vez no passado), a "última mensagem do cliente" retornada pela query truncada é **mais antiga** que o `last_read_at` → `perOperatorUnread = false` → bolinha some.
- A notificação funciona porque o `NotificationSystem` reage ao evento `INSERT` em tempo real, sem depender dessa query.

Por isso o sintoma é "um operador não vê", e não um bug global.

## Correção

Substituir as duas queries truncadas por uma busca **por telefone** que retorne só o que importa para o cálculo: a **última mensagem de cliente posterior ao `last_read_at`** de cada conversa. Não precisamos trazer 25k linhas para o frontend.

### Estratégia

1. **Preservar o comportamento atual** quando há poucos clientes/mensagens (sem regressão de UX nem de dados).
2. Em vez de buscar todas as mensagens dos clientes em massa, fazer **uma única query agregada por última data**:

   - Buscar para os telefones da lista o `MAX(data_hora)` das mensagens com `tipo_remetente='cliente' OR remetente='cliente'`. Isso pode ser feito via:
     - opção A (preferida): RPC SQL nova `get_ultima_msg_cliente_por_telefone(telefones text[])` retornando `(cliente_id, ultima_data, total_apos timestamp)` — uma chamada, sem limite de 1000.
     - opção B (fallback sem migration): fazer chunk de 500 telefones, mas com `order('data_hora', { ascending: false })` + `range(0, 999)` repetido por telefone agrupado — inviável em escala.

   Vamos com a **opção A** (criar RPC SQL).

3. A RPC só **lê** dados que o frontend já consome hoje, sem alterar nenhuma linha de mensagem. Não há risco de mexer em horários ou em status.

4. Manter `unread_count_real` (contagem para o badge numérico) usando o mesmo retorno da RPC: `count(*) FILTER (WHERE data_hora > last_read_at)` por telefone.

### Mudanças concretas

**A. Migration (nova função SQL — somente leitura)**

```sql
create or replace function public.get_unread_cliente_msgs(
  _telefones text[],
  _read_map jsonb  -- { "telefone": "iso-timestamp-or-null", ... }
)
returns table (
  cliente_id text,
  ultima_data timestamptz,
  total_nao_lidas int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.cliente_id,
    max(m.data_hora) as ultima_data,
    count(*) filter (
      where (_read_map ->> m.cliente_id) is null
         or m.data_hora > (_read_map ->> m.cliente_id)::timestamptz
    )::int as total_nao_lidas
  from public.mensagens m
  where m.cliente_id = any(_telefones)
    and (m.tipo_remetente = 'cliente' or m.remetente = 'cliente')
  group by m.cliente_id;
$$;

grant execute on function public.get_unread_cliente_msgs(text[], jsonb) to anon, authenticated;
```

Sem alteração em tabelas, sem trigger, sem mudança de tipos. Função é `stable` e `security definer` (só `select`).

**B. Frontend — `src/components/ConversationListBeta.tsx`**

- Remover as duas queries `mensagensClienteLegado` / `mensagensClienteTipo` (linhas ~1028–1055).
- Antes da iteração `clientesData.map(...)`, montar `readMap` a partir do `operatorReadMap` já existente (`{ telefone: last_read_at | null }`).
- Chamar `supabase.rpc('get_unread_cliente_msgs', { _telefones: telefones, _read_map: readMap })`.
- Construir `ultimaMsgClienteMap` (telefone → ultima_data) e `unreadCountByTelefone` (telefone → total_nao_lidas) a partir do retorno.
- Reescrever o bloco de cálculo (linhas 1102–1126) usando esses dois mapas:

```ts
const readRecord = operatorReadMap.get(cliente.telefone);
const lastClientMsg = ultimaMsgClienteMap.get(cliente.telefone);
const unreadFromMsgs = unreadCountByTelefone.get(cliente.telefone) ?? 0;

let perOperatorUnread = false;
let unreadCountReal = 0;

if (readRecord?.manual_unread === true) {
  perOperatorUnread = true;
  unreadCountReal = unreadFromMsgs; // pode ser 0 → ConversationCard mostra "•"
} else if (lastClientMsg) {
  const lastReadAt = readRecord?.last_read_at ?? null;
  if (!lastReadAt || new Date(lastClientMsg) > new Date(lastReadAt)) {
    perOperatorUnread = true;
    unreadCountReal = unreadFromMsgs;
  }
}
```

Comportamento exibido permanece exatamente o mesmo das regras descritas em `documentação/chat-beta-leitura.md` — só a fonte deixa de ser truncada.

**C. Sem mudanças** em:
- `src/lib/chatBetaUnread.ts` (escrita continua igual).
- `ChatWindowBeta.tsx`, `NotificationSystem.tsx` (notificação já funciona).
- RLS / dados existentes.

## Salvaguardas (project-knowledge)

- Função SQL é `stable` e só faz `select` — **não altera nenhuma linha** de `mensagens`, `clientes`, `mensagem_leitura_operador`, nem qualquer outra tabela.
- Nenhuma mudança em fuso horário, formatação de data ou em colunas de horário.
- Resultado da nova RPC reproduz **a mesma lógica** que já está em `documentação/chat-beta-leitura.md`; o teste de regressão é: para conversas que **hoje** mostram bolinha, devem continuar mostrando; para as que escondem indevidamente, a bolinha volta.
- Em caso de falha da RPC, cai num fallback que mantém o comportamento atual (sem bolinha) — nunca cria estado pior do que o presente.

## Validação após implementar

1. Logar como o operador afetado, abrir o Chat BETA, confirmar que conversas com mensagens novas (após o último `last_read_at`) voltam a exibir a bolinha.
2. Marcar como lida → bolinha some.
3. Marcar como não lida → bolinha aparece e persiste após reload.
4. Verificar com um operador "novo" (sem registros em `mensagem_leitura_operador`) que tudo segue não lido por padrão.
