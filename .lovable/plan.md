## Contexto

Hoje no mobile (`/chat` e `/chat-beta` em <768px):
- A **lista de conversas** já tem bolinha de não lido (`MobileConversationList.tsx`).
- A **tela do chat aberto** tem um botão `i` no header que abre `MobileFichaSheet` — mas o sheet só mostra dados estáticos da ficha. Não há ações nem outras visualizações.
- O usuário quer:
  1. Manter as regras de lido/não lido também no mobile (já estão — só vou reforçar e tornar acionável).
  2. Expandir o botão `i` para virar um **painel de ações + visualizações**, equivalente reduzido ao painel lateral do desktop.

A regra de leitura/não leitura continua usando exclusivamente `mensagem_leitura_operador` via `chatBetaUnread.ts` (fonte única, conforme `documentação/chat-beta-leitura.md`). **Nada da lógica de leitura muda** — apenas adiciono pontos de entrada visuais e a ação manual.

---

## Mudanças

### 1. Bolinha de não lido visível também dentro do chat aberto

Hoje a bolinha aparece só na lista. Quando o operador entra no chat, ele perde a indicação visual e não consegue marcar como não lido sem voltar.

- No header de `MobileChatScreen.tsx`, ao lado do nome do cliente, mostrar bolinha coral pequena se `manual_unread === true` (lido pela mesma `mensagem_leitura_operador`, filtrado pelo `user.id` atual).
- Adicionar item "Marcar como não lida" / "Marcar como lida" dentro do novo painel de ações (item 2 abaixo) — usa `markConversationUnread` / `markConversationRead` já existentes.
- Após "Marcar como não lida", **voltar automaticamente para a lista** (mesma UX do WhatsApp / Gmail mobile).

### 2. Substituir `MobileFichaSheet` por `MobileActionsSheet` (painel "i" expandido)

Renomear o sheet aberto pelo botão `i` para algo mais amplo. Continua sendo um `Drawer` bottom-sheet, mas agora com **abas no topo** + **lista de ações no rodapé**.

**Estrutura do sheet:**

```text
[Drawer fullscreen 92dvh]
  Header: nome do cliente + telefone + status_conversa (Ativa/Fechada)
  Tabs (horizontal scroll):
    - Ficha       (conteúdo atual do MobileFichaSheet)
    - Histórico   (outras fichas do mesmo telefone)
    - Resumo IA   (botão "Gerar resumo" → invoke summarize-conversation)
    - Bot         (status atual + botão ligar/desligar)
  Rodapé fixo: lista de ações (ícones + texto)
    - Marcar como não lida / lida
    - Ligar/Desligar bot
    - Solicitar takeover (se ticket é de outro operador)
    - Abrir ficha completa em nova aba
    - Copiar telefone
    - Ver histórico do bot
```

**Detalhamento das abas:**

- **Ficha**: igual ao atual (`Field` rows). Adicionar link "Abrir ficha completa" → `window.open(/fichas/:id)`.
- **Histórico**: query `fichas_de_servico` por `telefone_cliente`, lista todas com status + data + valor. Tap → abre ficha.
- **Resumo IA**: botão único que chama `summarize-conversation` edge function (já existe) e mostra resultado em texto. Cache no estado do sheet enquanto aberto.
- **Bot**: mostra `bot_habilitado` atual; botão alterna via `toggle-bot-status` edge function. Se for ligar manualmente, exigir confirmação digitando `LIGAR` (regra do projeto — memória `bot-security-audit-history`).

**Ações do rodapé:**

| Ação | Implementação |
|---|---|
| Marcar como não lida/lida | `markConversationUnread` / `markConversationRead` + `setSelected(null)` para voltar à lista |
| Ligar/Desligar bot | `supabase.functions.invoke("toggle-bot-status")` (mesma chamada usada no desktop) |
| Solicitar takeover | só visível se `atendente_id` ≠ `user.id` e `status_conversa === "aberta"`; insere em `takeover_requests` + envia broadcast (lógica copiada de `ChatWindowBeta` → `iniciarTakeover`) |
| Abrir ficha em nova aba | `window.open('/fichas/' + ficha.id, '_blank')` |
| Copiar telefone | `navigator.clipboard.writeText` |
| Ver histórico do bot | abre `BotHistoricoDialog` reutilizado (já existe) |

### 3. Indicador de status no header do chat

Adicionar pequeno badge no header do chat (logo abaixo do telefone) mostrando:
- Status da ficha (cor conforme `statusFichaCores`)
- Indicador "Bot OFF" se `bot_habilitado === false`
- Indicador "👤 Outro operador" se `atendente_id` ≠ user atual

Tap no badge abre o sheet direto na aba correspondente.

---

## Arquivos

**Novos:**
- `src/components/mobile/MobileActionsSheet.tsx` — substitui o atual MobileFichaSheet

**Editados:**
- `src/components/mobile/MobileChatScreen.tsx`
  - Substituir import de `MobileFichaSheet` por `MobileActionsSheet`
  - Adicionar estado de `manual_unread` carregado de `mensagem_leitura_operador`
  - Adicionar bolinha no header
  - Receber prop `onBack` para voltar quando marcar como não lida
  - Adicionar badges (status ficha / bot off / outro operador)
- `src/components/mobile/MobileFichaSheet.tsx` — **manter o componente** mas usar internamente como aba "Ficha" do novo sheet (extrair só o conteúdo). Ou deletar e mover conteúdo para dentro de `MobileActionsSheet`. Vou manter o arquivo original intacto e o `MobileActionsSheet` consome `<FichaContent />` extraído.

**Não alterado (reuso):**
- `src/lib/chatBetaUnread.ts` (regras de leitura — intocadas)
- `src/components/BotHistoricoDialog.tsx` (reuso)
- Edge functions `toggle-bot-status`, `summarize-conversation`, `stop-twilio-flow`

---

## Garantias / safeguards

- **Não toco em `mensagem_leitura_operador`** fora dos handlers já validados (`markConversationAutoRead`, `markConversationRead`, `markConversationUnread`).
- **Não altero a forma como `manual_unread` é calculado** — apenas leio e exponho na UI mobile.
- **Não modifico tabelas, RLS, edge functions ou lógica de bot/takeover** — apenas chamo o que já existe.
- Desktop (`ChatWindowBeta`) **continua exatamente igual**.
- Roteamento mobile (`useIsMobile()`) já está em `App.tsx` — sem mudanças.
- Sem mudança em fuso horário, datas ou valores armazenados.

---

## Fora de escopo (pode entrar depois se quiser)

- Editar campos da ficha pelo mobile (hoje só leitura).
- Anexos / áudio gravado pelo mobile.
- Templates aprovados (já existe via `MobileTemplatesSheet`, mantido).