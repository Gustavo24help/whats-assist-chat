# Diagnóstico: cliente +5511983760445 duplicado

## O que aconteceu
O número `+5511983760445` (Talita) aparece **duas vezes** na lista de conversas:

| telefone (chave) | criado em | mensagens | ficha ativa |
|---|---|---|---|
| `whatsapp:+5511983760445` | 25/11/2025 | sim (última 13:33 hoje) | FS9-251125 (Finalizado) |
| `+5511983760445` (sem prefixo) | hoje 13:37 | **nenhuma** | FS3-260519 (Ficha Criada) |

A segunda linha é uma **conversa órfã** criada por um bug na função `receber-ficha`.

## Causa raiz
O resto do sistema usa sempre `whatsapp:+E164` como chave do cliente (mensagens, webhook do Twilio, `upsert-cliente`, `criar-ficha-do-bot`). A função `receber-ficha`, porém, faz o oposto na linha 70:

```ts
const telefone_cliente = String(payload.telefone_cliente ?? ...)
  .replace(/^whatsapp:/i, "").trim();
```

Ela **remove** o prefixo `whatsapp:` e em seguida insere um novo cliente com essa chave "limpa" (linha 155), sem encontrar o cliente existente. Resultado: duas linhas em `clientes` para o mesmo número, e a nova ficha aponta para o cliente vazio (sem histórico de mensagens).

Hoje isso aconteceu com **2 fichas reais** (FS3-260519 — Talita, FS2-260519 — Valentina). Os demais registros sem prefixo são TEST/USA antigos e podem ficar como estão.

## Plano

### 1. Corrigir `supabase/functions/receber-ficha/index.ts`
Trocar a remoção do prefixo por uma normalização que **adiciona** `whatsapp:` se faltar, idêntica à de `upsert-cliente` e `criar-ficha-do-bot`. Aplicado tanto na chave salva em `fichas_de_servico.telefone_cliente` quanto no upsert do cliente.

Antes:
```ts
const telefone_cliente = (...).replace(/^whatsapp:/i, "").trim() || null;
```

Depois:
```ts
function normalizeTelefone(raw: string | null): string | null {
  if (!raw) return null;
  let t = String(raw).trim();
  if (!t) return null;
  if (!t.startsWith("whatsapp:")) {
    if (!t.startsWith("+")) t = "+" + t.replace(/\D/g, "");
    t = "whatsapp:" + t;
  }
  return t;
}
const telefone_cliente = normalizeTelefone(payload.telefone_cliente ?? payload.telefone ?? payload.from ?? payload.ContactPhone ?? null);
```

Nenhuma outra função é alterada. Nenhum dado existente é mexido por essa mudança — ela só afeta **novas chamadas** a `receber-ficha`.

### 2. Migration de consolidação dos 2 casos de hoje
Migration SQL atômica que, **apenas** para `+5511983760445` e `+554299708826`:

1. `UPDATE fichas_de_servico SET telefone_cliente = 'whatsapp:'||telefone_cliente WHERE telefone_cliente IN (...)` — religa a ficha nova ao cliente que tem o histórico de WhatsApp.
2. `UPDATE clientes SET ficha_ativa_id = <FS nova>, nome = COALESCE(NULLIF(nome,'Cliente Desconhecido'), <nome novo>) WHERE telefone = 'whatsapp:+...'` — leva ficha ativa e nome bom para o cliente correto.
3. `DELETE FROM clientes WHERE telefone IN ('+5511983760445','+554299708826')` — só depois de confirmar que nenhuma `mensagens.cliente_id` aponta para essas chaves (já confirmei via consulta: ambos têm 0 mensagens).

Nada toca em registros de teste antigos (`FS-TESTE-*`, `TEST-*`, números EUA) nem em qualquer mensagem, status, agendamento, valor financeiro ou timestamp. Datas/horas, status das fichas e qualquer outro campo permanecem **idênticos**.

### 3. Validação pós-migration
- Confirmar que `clientes` tem só **uma** linha para cada número corrigido (a com prefixo `whatsapp:`).
- Confirmar que `FS3-260519` e `FS2-260519` aparecem na conversa que tem o histórico de mensagens.
- Confirmar que mensagens antigas (FS9-251125) continuam visíveis e inalteradas.

## Fora de escopo
- Reescrever as 7 linhas de teste/EUA antigas em `clientes`.
- Mudar qualquer outra função, RLS, schema ou UI.
- Tocar em dados financeiros, status, horários ou histórico.
