# Correção: ficha não está sendo criada (Twilio Studio → Edge Functions)

## Diagnóstico

Sim, o que o técnico descreveu **faz total sentido**. Desde sexta, as Edge Functions que o Twilio Studio chama estão exigindo o segredo **apenas via header customizado** (`x-bot-secret` ou `x-ficha-secret`). O widget `make-http-request` do Twilio Studio Flow **não suporta headers customizados** — só envia `Content-Type` e `Authorization` básicos. Resultado: as funções retornam **401 Unauthorized** e a ficha nunca é criada.

Funções afetadas (todas validam segredo só por header hoje):

- `criar-ficha-do-bot` — header `x-bot-secret` → `BOT_CRIAR_FICHA_SECRET`
- `atualizar-status-ficha` — header `x-bot-secret` → `BOT_CRIAR_FICHA_SECRET`
- `upsert-cliente` — header `x-bot-secret` → `BOT_CRIAR_FICHA_SECRET`
- `vincular-conversa-ficha` — header `x-bot-secret` → `BOT_CRIAR_FICHA_SECRET`
- `receber-ficha` — header `x-ficha-secret` / `x-api-key` (já aceita `?secret=` na query, então **só essa já tolera query** — as outras 4 não)

## Correção proposta

Em cada uma das 4 funções listadas (exceto `receber-ficha`, que já tem fallback), aceitar o segredo via **três fontes**, nessa ordem:

1. Header `x-bot-secret` / `X-Bot-Secret` (mantém compatibilidade com Make e com chamadas internas que já mandam header).
2. Query string `?apikey=...` (também aceitar `?secret=...` por consistência com `receber-ficha`).
3. Campo `secret` no body JSON (fallback final caso o Studio só consiga injetar variável no body).

Pseudo-código:

```ts
const url = new URL(req.url);
const headerSecret = req.headers.get("x-bot-secret") || req.headers.get("X-Bot-Secret");
const querySecret = url.searchParams.get("apikey") || url.searchParams.get("secret");
const bodySecret = typeof body?.secret === "string" ? body.secret : "";
const providedSecret = headerSecret || querySecret || bodySecret;
if (providedSecret !== expectedSecret) return jsonResp({ error: "Não autorizado" }, 401);
```

Importante: ler o body **antes** da validação (como `receber-ficha` já faz) para permitir o fallback 3.

## Segurança

- O segredo continua sendo `BOT_CRIAR_FICHA_SECRET` (sem mudança).
- Query string em HTTPS é cifrada em trânsito; o risco real é só logging (Twilio loga URL). Mitigação: **rotacionar** o segredo logo após confirmar funcionamento, caso o usuário queira. Sugiro fazer só se ele pedir — não é bloqueante.
- Nenhuma alteração em RLS, schema ou dados existentes. Nenhuma ficha já criada é afetada.

## Passos de implementação

1. Editar `supabase/functions/criar-ficha-do-bot/index.ts` — mover o `req.json()` para antes da checagem de secret e adicionar fallback query+body.
2. Mesmo padrão em `atualizar-status-ficha/index.ts`, `upsert-cliente/index.ts`, `vincular-conversa-ficha/index.ts`.
3. Deploy das 4 funções.
4. Testar via `curl` com `?apikey=...` (sem header) para validar 200.
5. Avisar usuário para reconfigurar o widget no Twilio Studio: passar `?apikey=<BOT_CRIAR_FICHA_SECRET>` na URL do endpoint (não precisa mais de header).

## Não está no escopo

- Não vou alterar lógica de criação/parsing de ficha — só a porta de entrada.
- Não vou tocar em `receber-ficha` (já aceita query).
- Não vou criar nova função nem mexer em triggers, RLS ou tabelas.
