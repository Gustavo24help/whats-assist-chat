

## Diagnóstico: Mensagens não enviam — "Failed to send a request to the Edge Function"

### Causa Raiz

O erro é **CORS**. A edge function `send-whatsapp` tem headers CORS desatualizados:

```
// ATUAL (incompleto)
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
```

O Supabase JS client v2.76+ envia headers adicionais (`x-supabase-client-platform`, etc.) que não estão listados, fazendo o browser bloquear o preflight OPTIONS e resultando em "Failed to fetch" antes mesmo de chegar ao servidor.

### Bug secundário: texto perdido no catch

Linha 1412 define `mensagemTexto` dentro do `try`. Linha 1477 no `catch` tenta `novaMsg` que já foi limpa na linha 1418. O texto digitado é perdido silenciosamente ao falhar.

---

### Plano de Correção

#### 1. Atualizar CORS do `send-whatsapp` (~1 min)

**Arquivo:** `supabase/functions/send-whatsapp/index.ts`

Atualizar `corsHeaders` para incluir os headers do Supabase client moderno:

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

#### 2. Corrigir restauração do texto no catch (~1 min)

**Arquivo:** `src/components/ChatWindow.tsx`

Mover `mensagemTexto` para antes do `try`, e no `catch` usar essa variável capturada:

```typescript
// Linha ~1412: já está fora do try ✓ — mas o catch (1477) recria com novaMsg vazia
// Fix: no catch, remover a redefinição e usar closure da variável existente
```

Na verdade, olhando melhor, `mensagemTexto` na linha 1412 **está dentro do try** (que começa antes). O catch na 1477 cria outra variável local. Fix: referenciar a `mensagemTexto` do try diretamente — ela está acessível pois o catch é do mesmo try-catch block.

Wait — confirmando: a linha 1412 está dentro do `try`. O `catch` na 1474 é do mesmo bloco, então `mensagemTexto` da linha 1412 **não é acessível** no catch (escopo de bloco). Fix real: mover a declaração para antes do try.

---

### Resumo das mudanças

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/send-whatsapp/index.ts` | Atualizar CORS headers |
| `src/components/ChatWindow.tsx` | Mover `mensagemTexto` para antes do try; usar no catch para restaurar |

2 arquivos, ~6 linhas alteradas. A edge function será redeployada automaticamente.

