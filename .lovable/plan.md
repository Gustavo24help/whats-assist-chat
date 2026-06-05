## Problema

No número 4188622730 duas mensagens enviadas pelo operador foram duplicadas:

- "Bom dia Ninna! Tudo bem?" → enviada 2× com 0.6 s de diferença (SIDs diferentes).
- "Segue o link para pagamento do serviço FS2-260602" → enviada 2× com ~5 s de diferença (SIDs diferentes).

Como cada cópia tem **message_sid diferente**, o `send-whatsapp` foi de fato invocado duas vezes — não é problema de exibição/realtime. Isso descarta o sistema de deduplicação do chat (que só protege duplicatas vindas da Twilio/realtime).

## Causa raiz

### 1. Race condition no envio pelo Enter (causa principal — gap 0.6 s)

Em `src/components/ChatWindow.tsx`:

- O `<textarea>` (linha 2956) só fica `disabled` por `statusConversa === "fechada" || !!pendingFile`. **Não considera `isSending`.**
- O guard em `enviarMensagemReal` é `if (!novaMsg.trim() || isSending) return;` (linha 1652), mas `isSending` é estado React: dois `Enter` consecutivos no mesmo tick leem `isSending === false` antes do re-render, ambos passam, ambos chamam `send-whatsapp`.
- Mesmo problema afeta o wrapper `enviarMensagem` (linha 1750), que nem checa `isSending` antes de decidir auto-takeover / abrir dialog / chamar `enviarMensagemReal`.
- `ChatWindowBeta.tsx` tem o mesmo padrão e deve ser corrigido junto.

### 2. Cliques duplos em diálogos / latência alta (gap 5 s do link de pagamento)

Diálogos como `EnviarLinkPagamentoDialog` já têm flag `enviando/enviado`, mas dependem do mesmo padrão de estado React. Com 5 s de latência de rede um operador ansioso clica de novo. Precisamos uma **segunda barreira no backend**.

## Plano

### A. Guard de envio à prova de race (frontend)

Em `ChatWindow.tsx` e `ChatWindowBeta.tsx`:

1. Criar `const isSendingRef = useRef(false)` ao lado de `isSending`.
2. No início de `enviarMensagem` (wrapper) e `enviarMensagemReal`: `if (isSendingRef.current) return; isSendingRef.current = true;` — fazer reset no `finally` junto com `setIsSending(false)`.
3. Adicionar `isSending || uploading` ao `disabled` do `<textarea>` (atual linha 2956), além do botão.
4. No `onKeyDown` do Enter, checar `isSendingRef.current` antes de chamar `enviarMensagem()`.

Isso elimina o duplo-Enter no mesmo tick sem alterar UX.

### B. Dedup defensivo no `send-whatsapp` (backend)

Em `supabase/functions/send-whatsapp/index.ts`, antes de chamar a Twilio:

1. Consultar `mensagens` por `cliente_id = to` + `remetente = NUMERO_24HELP` + `texto = message` + `data_hora >= now() - interval '10 seconds'`.
2. Se encontrar registro, **não enviar nova mensagem para a Twilio**. Retornar `{ success: true, deduplicated: true, message_sid: <sid existente> }` e logar em `system_logs` (evento `send_whatsapp_dedup_block`).
3. Janela: 10 s para texto puro. Templates (`send-template`) e arquivos ficam fora deste guard (texto vazio ou `MediaUrl`).

Isso captura cliques duplos de qualquer ponto da UI sem afetar reenvios intencionais (≥10 s).

### C. Garantias de não-quebra

- Não alterar schema, índices ou dados existentes.
- O dedup do backend só **bloqueia o segundo POST para a Twilio** quando o primeiro já gravou em `mensagens` — nenhum risco de perder mensagem legítima (reenviar mesma frase em <10 s é caso raríssimo e o operador recebe toast "mensagem idêntica enviada há poucos segundos").
- Optimistic update existente continua igual; se o backend devolver `deduplicated`, o realtime já trouxe a mensagem original — a tempId é substituída normalmente.
- Sem mudança em `ChatWindowPrestadores`, sem mudança em templates, sem mudança em fichas/clientes.

### D. Arquivos afetados

- `src/components/ChatWindow.tsx` (guards de envio + disabled do textarea).
- `src/components/ChatWindowBeta.tsx` (mesmo conjunto de guards).
- `supabase/functions/send-whatsapp/index.ts` (dedup 10 s + log).

### E. Validação

1. Conferir que o textarea fica bloqueado durante envio (botão já mostra spinner).
2. Spam de Enter / cliques deve gerar **1 só** mensagem em `mensagens` e **1 só** envio no Twilio.
3. Registro `send_whatsapp_dedup_block` aparece em `system_logs` quando o backend descartou um POST duplicado.
4. Reenviar a mesma frase após 15 s continua funcionando normalmente.
