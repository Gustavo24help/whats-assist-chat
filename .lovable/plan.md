

# Correcao do Envio de Imagens + Sistema de Mensagens Internas

## 1. Bug do Envio de Imagens (Causa Raiz)

O erro "Edge Function returned a non-2xx status code" ocorre porque a edge function `send-whatsapp` rejeita mensagens com corpo vazio.

**Linha 48 de `send-whatsapp/index.ts`:**
```text
if (!message || typeof message !== 'string' || message.length > 5000)
```

Quando o operador envia **apenas uma imagem** (sem texto), o `ChatWindow.tsx` envia `message: ""` (linha 1114). Como `""` e falsy em JavaScript, `!message` retorna `true`, e a funcao retorna status 400 ("Invalid message").

**Correcao:** Permitir mensagem vazia quando ha `mediaUrl`:

```text
// send-whatsapp/index.ts - Ajustar validacao
if ((!message && !mediaUrl) || (message && typeof message !== 'string') || (message && message.length > 5000))
```

Tambem no body do Twilio, nao enviar `Body` vazio para evitar problemas:

```text
if (message) {
  body.append('Body', message);
}
```

**Arquivos alterados:**
- `supabase/functions/send-whatsapp/index.ts` - Ajustar validacao de message

---

## 2. Sistema de Mensagens Internas

### Conceito
Chat interno simples entre usuarios do app (operadores/admins), estilo WhatsApp. Suporta texto, imagens e documentos.

### Banco de Dados (2 tabelas novas)

**`internal_conversations`**
- `id` (uuid, PK)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `is_group` (boolean, default false)
- `group_name` (text, nullable) -- para grupos futuros

**`internal_conversation_members`**
- `id` (uuid, PK)
- `conversation_id` (uuid, FK -> internal_conversations)
- `user_id` (uuid)
- `joined_at` (timestamptz)
- `last_read_at` (timestamptz, nullable) -- para controle de nao-lidos

**`internal_messages`**
- `id` (uuid, PK)
- `conversation_id` (uuid, FK -> internal_conversations)
- `sender_id` (uuid)
- `content` (text, nullable)
- `file_url` (text, nullable)
- `file_name` (text, nullable)
- `file_type` (text, nullable) -- 'imagem', 'documento', 'texto'
- `created_at` (timestamptz)

RLS: Usuarios so podem ver/inserir em conversas das quais sao membros.
Realtime habilitado para `internal_messages`.

Storage: Usar o bucket `chat-files` existente com subpasta `internal/`.

### Interface

**Nova pagina: `src/pages/MensagensInternas.tsx`**
- Layout dividido: lista de conversas a esquerda, janela de mensagem a direita
- Botao "Nova conversa" abre dialogo para selecionar usuario(s) do sistema
- Campo de input com suporte a texto + anexo (imagem/doc)
- Indicador de mensagens nao lidas

**Componentes novos:**
- `src/components/internal-chat/InternalChatList.tsx` - Lista de conversas
- `src/components/internal-chat/InternalChatWindow.tsx` - Janela de mensagens
- `src/components/internal-chat/NewInternalChatDialog.tsx` - Dialogo para iniciar conversa

**Navegacao:**
- Rota `/mensagens` no `App.tsx` (protegida)
- Link acessivel a partir da pagina Home ou header

### Funcionalidades
- Envio de texto
- Envio de imagens (upload para storage + preview)
- Envio de documentos (upload para storage + link para download)
- Indicador de mensagens nao lidas
- Realtime via Supabase channels
- Lista de usuarios disponivel consultando a tabela `profiles`

### Arquivos criados/alterados

| Arquivo | Acao |
|---|---|
| `supabase/functions/send-whatsapp/index.ts` | Corrigir validacao de message vazia |
| Migration SQL | Criar 3 tabelas + RLS + realtime |
| `src/pages/MensagensInternas.tsx` | Nova pagina |
| `src/components/internal-chat/InternalChatList.tsx` | Lista de conversas |
| `src/components/internal-chat/InternalChatWindow.tsx` | Janela de chat |
| `src/components/internal-chat/NewInternalChatDialog.tsx` | Iniciar conversa |
| `src/App.tsx` | Adicionar rota `/mensagens` |

### Seguranca de dados
- Nenhum dado existente e modificado
- Novas tabelas com RLS baseado em membership
- Uploads internos em subpasta separada no bucket existente

