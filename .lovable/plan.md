

# Filtro de conversas por ficha no Chat BETA

## Problema

1. **Mensagens do bot e do cliente antes da criação da ficha** não têm `ficha_id` (NULL), pois o webhook do Twilio não define esse campo
2. **Mensagens recebidas do cliente** (via twilio-webhook) nunca recebem `ficha_id`, mesmo quando já existe uma ficha ativa
3. Quando o filtro "Mensagens da Ficha" é ativado, essas mensagens somem — o filtro parece "não funcionar"

## Solução

### 1. Backfill ao criar ficha — `CriarFichaDialog.tsx`

Após criar a ficha com sucesso, executar um UPDATE em todas as mensagens do cliente que ainda não têm `ficha_id`:

```sql
UPDATE mensagens 
SET ficha_id = '<nova_ficha_id>' 
WHERE cliente_id = '<telefone_cliente>' 
AND ficha_id IS NULL
```

Isso vincula retroativamente todas as mensagens do bot e do cliente à nova ficha.

### 2. Vincular mensagens recebidas à ficha ativa — `twilio-webhook/index.ts`

Quando uma mensagem chega do cliente, buscar a `ficha_ativa_id` do cliente na tabela `clientes` e salvar na mensagem:

```typescript
// Após identificar o cliente_id
const { data: clienteData } = await supabase
  .from('clientes')
  .select('ficha_ativa_id')
  .eq('telefone', cliente_id)
  .maybeSingle();

// Usar ficha_ativa_id ao inserir a mensagem
ficha_id: clienteData?.ficha_ativa_id || null
```

### 3. Vincular mensagens do bot à ficha ativa — `twilio-status-callback/index.ts`

Já existe uma busca de ficha nesse arquivo (linha ~197), mas precisa priorizar `ficha_ativa_id` do cliente em vez de busca genérica.

### 4. Melhorar UX do filtro — `ChatWindowBeta.tsx`

Quando `fichaFilterId` está ativo e o filtro resulta em 0 mensagens, mostrar uma mensagem explicativa em vez de tela vazia (ex: "Nenhuma mensagem vinculada a esta ficha").

## Arquivos alterados

- `src/components/CriarFichaDialog.tsx` — backfill de mensagens sem ficha_id
- `supabase/functions/twilio-webhook/index.ts` — vincular mensagens recebidas à ficha ativa
- `src/components/ChatWindowBeta.tsx` — mensagem de estado vazio no filtro

## Não será alterado

- Dados existentes com `ficha_id` já preenchido não serão modificados
- Mensagens já associadas a outras fichas não serão sobrescritas (o UPDATE usa `AND ficha_id IS NULL`)

