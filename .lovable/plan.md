## Diagnóstico

O erro 401 ainda faz sentido porque a função `receber-ficha` hoje lê o segredo da URL apenas como `?secret=...`, mas a chamada real do Twilio está vindo como:

```text
/functions/v1/receber-ficha?apikey=24help-webhook-2026
```

Ou seja: as outras 4 funções já foram ajustadas para aceitar `apikey`, mas `receber-ficha` ainda não.

## Plano de correção

1. Atualizar `supabase/functions/receber-ficha/index.ts` para aceitar também:
   - `?apikey=...`
   - mantendo `?secret=...`
   - mantendo headers `x-ficha-secret` e `x-api-key`
   - mantendo `body.secret`

2. Preservar compatibilidade total com chamadas antigas:
   - nada muda para quem já usa `?secret=` ou header.
   - nenhuma tabela, RLS, trigger ou dado existente será alterado.

3. Ajustar a ordem de fallback para ficar consistente com as demais funções:

```ts
const querySecret =
  url.searchParams.get("apikey") ??
  url.searchParams.get("secret") ??
  "";

const provided = headerSecret || bodySecret || querySecret;
```

4. Fazer deploy apenas da função `receber-ficha`.

5. Validar com uma chamada sem header usando `?apikey=...`; se retornar algo diferente de 401, a autenticação já passou e qualquer erro restante será de payload/campos obrigatórios, não de chave.

## O que não será alterado

- Não vou mudar lógica de criação da ficha.
- Não vou alterar IDs, datas, horários, status ou dados existentes.
- Não vou mexer em dashboard, frontend, RLS ou banco de dados.