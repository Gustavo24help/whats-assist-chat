
# Edge Function `claude-read` — acesso de leitura do Claude

## Objetivo
Criar uma edge function que permita ao Claude (externo) ler qualquer tabela do banco, autenticada por um token secreto que só você e o Claude conhecem. Usa a `service_role` internamente (bypassa RLS), mas só responde se o token bater.

## Como vai funcionar

```text
Claude  ──POST──▶  /functions/v1/claude-read
                   Header: X-Claude-Token: <segredo>
                   Body:   { "table": "fichas_de_servico",
                             "select": "id,status,created_at",
                             "filters": [{"col":"status","op":"eq","val":"Agendado"}],
                             "order":  {"col":"created_at","dir":"desc"},
                             "limit":  100 }
                   ▼
            Valida token  →  service_role  →  Supabase  →  JSON
```

## Segurança
- Apenas **SELECT**. Qualquer outra operação é rejeitada.
- Header `X-Claude-Token` obrigatório, comparado em tempo constante com o secret `CLAUDE_READ_TOKEN`.
- Sem token → 401. Token errado → 401.
- `verify_jwt = false` (Claude não tem sessão Supabase), mas o token próprio substitui o JWT.
- Limite máximo de 1000 linhas por request (proteção contra dump acidental).
- Lista de tabelas **bloqueadas** por padrão (sensíveis):
  - `user_roles`, `profiles` (dados pessoais de operadores)
  - Qualquer tabela do schema `auth`, `storage`, `vault`
  - Se quiser liberar, é só me pedir depois.

## Entrada aceita (JSON)
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `table` | string | sim | Nome da tabela (schema `public`) |
| `select` | string | não | Colunas (default `*`) |
| `filters` | array | não | `[{col, op, val}]` — op: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `in`, `is` |
| `order` | object | não | `{col, dir}` — dir: `asc`/`desc` |
| `limit` | number | não | 1–1000, default 100 |
| `offset` | number | não | Para paginação |

## Saída
```json
{ "ok": true, "count": 42, "data": [ ... ] }
```

## Setup necessário
1. **Você adiciona o secret** `CLAUDE_READ_TOKEN` (gere um valor aleatório forte — ex: `openssl rand -hex 32`). Eu disparo o pedido depois que você aprovar o plano.
2. Eu crio `supabase/functions/claude-read/index.ts`.
3. Eu te entrego: URL final + exemplo de `curl` pronto para colar nas instruções do Claude.

## Fora de escopo
- Não implementa escrita (insert/update/delete).
- Não cria UI no app — é só endpoint.
- Não mexe em RLS nem em nenhuma tabela existente.

Confirma para eu seguir? Quando aprovar, primeiro peço o secret, depois crio a function.
