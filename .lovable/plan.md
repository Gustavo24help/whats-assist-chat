

# Plano: Sistema Dual de Chat (Clientes + Prestadores)

## Resumo
Adicionar segundo número Twilio para chat com prestadores, em página separada `/chat-prestadores`, com tabelas dedicadas e roteamento no webhook. Zero impacto no fluxo existente de clientes.

## 1. Migração SQL (uma única migração)

```sql
-- Campo numero_twilio em clientes e mensagens
ALTER TABLE clientes ADD COLUMN numero_twilio text;
ALTER TABLE mensagens ADD COLUMN numero_twilio text;
UPDATE clientes SET numero_twilio = 'whatsapp:+554138911555' WHERE numero_twilio IS NULL;

-- Tabela prestadores_chat
CREATE TABLE prestadores_chat (
  telefone text PRIMARY KEY,
  nome text NOT NULL DEFAULT 'Prestador',
  cpf text REFERENCES prestadores(cpf),
  status_conversa status_conversa_enum DEFAULT 'aberta',
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  ultima_interacao timestamptz DEFAULT now(),
  numero_twilio text
);
-- RLS (SELECT/INSERT/UPDATE = true para authenticated) + Realtime

-- Tabela mensagens_prestadores
CREATE TABLE mensagens_prestadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_telefone text NOT NULL REFERENCES prestadores_chat(telefone) ON DELETE CASCADE,
  ficha_id text REFERENCES fichas_de_servico(id),
  remetente text NOT NULL,
  texto text,
  arquivo_url text,
  tipo tipo_mensagem_enum DEFAULT 'texto',
  status status_mensagem_enum DEFAULT 'enviado',
  data_hora timestamptz DEFAULT now(),
  numero_twilio text,
  message_sid text,
  enviado_por_id uuid,
  reply_to_message_id uuid
);
-- Índices, RLS + Realtime

-- Tabela conversa_ficha_vinculo
CREATE TABLE conversa_ficha_vinculo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id text NOT NULL REFERENCES fichas_de_servico(id),
  cliente_telefone text,
  prestador_telefone text,
  vinculado_em timestamptz DEFAULT now(),
  vinculado_por text,
  ativo boolean DEFAULT true
);
-- Índices + RLS
```

## 2. Secret
Solicitar `TWILIO_PHONE_NUMBER_2` via `add_secret`.

## 3. Edge Functions (mudanças aditivas)

### `_shared/twilioNumbers.ts`
Adicionar `TWILIO_PHONE_NUMBER_2` à lista de env vars em `getManagedWhatsappNumbers()`. Exportar helper `getNumeroPrestadores()`.

### `twilio-webhook/index.ts`
Após determinar `from`/`to`/`clienteTelefone`:
- Se `to === NUMERO_PRESTADORES` → rota para `prestadores_chat` + `mensagens_prestadores`
- Caso contrário → lógica 100% atual inalterada
- Verificação de duplicidade checa ambas as tabelas

### `send-whatsapp/index.ts`
- Aceitar campo opcional `fromNumber` e `targetTable`
- Se `fromNumber` não informado → comportamento atual
- Se `fromNumber` = número 2 → salvar em `mensagens_prestadores` com `prestador_telefone`
- Validar `fromNumber` está na lista gerenciada

## 4. Frontend — Novos Componentes

### `src/pages/ChatPrestadores.tsx`
Página independente com mesma estrutura de `Chat.tsx` mas usando componentes de prestadores. Header adaptado com título "Chat Prestadores".

### `src/components/prestador-chat/ConversationListPrestadores.tsx`
- Query em `prestadores_chat` 
- Mostra nome do prestador + CPF
- Filtros: busca, status conversa
- Realtime em `prestadores_chat`

### `src/components/prestador-chat/ChatWindowPrestadores.tsx`
- Query em `mensagens_prestadores`
- Envia via `send-whatsapp` com `fromNumber = NUMERO_PRESTADORES`
- Identificação de remetente usa o segundo número
- Seletor de ficha vinculada no header

### `src/components/prestador-chat/FichaVinculoSelector.tsx`
Dropdown para vincular conversa a ficha, salva em `conversa_ficha_vinculo`.

## 5. Modificações em Arquivos Existentes

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | Rota `/chat-prestadores` protegida |
| `src/pages/Home.tsx` | Card "Chat Prestadores" na grid |
| `_shared/twilioNumbers.ts` | Incluir `TWILIO_PHONE_NUMBER_2` |
| `twilio-webhook/index.ts` | Branching aditivo (if) para número 2 |
| `send-whatsapp/index.ts` | Aceitar `fromNumber` opcional |

**NÃO serão modificados:** `ConversationList.tsx`, `ChatWindow.tsx`, `ConversationCard.tsx` — chat de clientes inalterado.

## 6. Garantias de Não-Impacto
- Webhook: nova lógica só entra via `if (to === NUMERO_PRESTADORES)`, else mantém código idêntico
- send-whatsapp: sem `fromNumber` no payload = comportamento atual
- Tabelas `clientes`/`mensagens`: campo `numero_twilio` é nullable e ignorado pelo código existente

## Ordem de Execução
1. Migração SQL
2. Secret `TWILIO_PHONE_NUMBER_2`
3. `_shared/twilioNumbers.ts`
4. `twilio-webhook` (branching)
5. `send-whatsapp` (fromNumber)
6. Componentes frontend prestador-chat
7. Página `ChatPrestadores` + rota + Home card

