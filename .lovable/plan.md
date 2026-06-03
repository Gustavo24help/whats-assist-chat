## Problema

Ao tentar religar o bot na conversa da Yaraa apareceu **"Bot não reativado — Há um operador ativo nessa conversa..."**. Investigação:

- Toast vem de `src/components/ChatWindowBeta.tsx` (L2142-2150) e do gêmeo em `ChatWindow.tsx` (L1964, L1989).
- Backend reforça em `supabase/functions/toggle-bot-status/index.ts` (L314-351) com HTTP 409 e `reason: "human_operator_active"`.
- Regra atual: `clientes.atendente_id IS NOT NULL AND status_conversa <> 'fechada'` ⇒ bloqueia religar.
- Na conversa em questão, **você mesmo** é o `atendente_id` (botão "Assumido"), por isso o bloqueio dispara — não é bug, é a salvaguarda anti‑inversão acidental.

Decisão do produto: **qualquer usuário pode ligar/desligar o bot**, sem precisar fechar manualmente.

## O que muda

### 1. Backend — `supabase/functions/toggle-bot-status/index.ts`

Substituir o bloco "Bloqueio: conversa atribuída a operador humano e ainda aberta" (L314-351) por **liberação automática**:

- Quando `enable_bot` for chamado e existir `atendente_id` ou `status_conversa <> 'fechada'`:
  - **Não bloquear**. Em vez disso, no mesmo update do cliente, setar:
    - `bot_habilitado = true`
    - `atendente_id = NULL`
    - `status_conversa = 'fechada'`
    - `data_bot_desabilitado = NULL`
    - `bot_desligado_manualmente = false`
  - Registrar em `system_logs` com `event: "enable_bot_auto_release"` contendo: `previous_atendente_id`, `previous_status_conversa`, `executed_by_user_id`, `request_id`.
  - Registrar em `bot_historico` com `observacao: "Bot religado com auto-liberação da conversa (atendente <X>, status anterior <Y>)"` para auditoria.
  - Continuar consumindo o `bot_reactivation_confirmations` challenge (uso único) como hoje.
- Manter intactos: validação do desafio "LIGAR" (`invalid_challenge`), as regras de `recent_manual_reactivation`, o lock de `desabilitar` e toda a parte de `stop-twilio-flow`.

### 2. Frontend — `src/components/ChatWindowBeta.tsx` e `src/components/ChatWindow.tsx`

- Remover o guarda pré-bloqueio (L2142-2150 do Beta e L1964-… do clássico):
  - Não mostrar mais o toast vermelho "Bot não reativado / operador ativo".
  - Não tratar `data?.blocked` como erro fatal (mantém o `if` defensivo, mas como agora o backend libera, o caminho some na prática).
- Trocar o texto do sucesso para deixar claro que houve auto‑liberação quando aplicável:
  - Se a resposta da edge function vier com `auto_released: true` (novo campo), mostrar `toast.success("Bot reativado e conversa fechada automaticamente")`.
  - Senão, manter `toast.success("Bot reativado por <userName>")`.
- Após sucesso, atualizar estado local: `setBotDesabilitado(false)`, e — quando `auto_released` — também limpar a UI de "Assumido" (`clienteAtual.atendente_id = null`, `status_conversa = 'fechada'`) via refresh do `clienteAtual` (já existe `onClienteUpdate`/realtime; basta confiar no realtime).

### 3. Salvaguardas mantidas (não mexer)

- Desafio "LIGAR" continua obrigatório.
- `recent_manual_reactivation` continua bloqueando desligar imediatamente depois de religar.
- `bot_historico` e `system_logs` continuam registrando autor (`executed_by_user_id`), IP/UA/request_id.
- Realtime de chat continua redistribuindo/sinalizando o fechamento.

## Impacto em dados existentes

- Nenhum dado retroativo é alterado pela mudança.
- A operação `enable_bot` agora pode escrever em `clientes` (`atendente_id`, `status_conversa`) — **antes** ela já escrevia outros campos do mesmo registro, então é o mesmo escopo. Para preservar histórico:
  - Antes do update, ler `atendente_id` e `status_conversa` atuais e gravar em `bot_historico.observacao` e em `system_logs.detalhes` (campos `previous_atendente_id`, `previous_status_conversa`).
- Não há mudança em horários, fichas, finanças ou Twilio Studio Flow.

## Arquivos editados

- `supabase/functions/toggle-bot-status/index.ts` (substitui bloco de bloqueio por auto-liberação; adiciona `auto_released` na resposta).
- `src/components/ChatWindowBeta.tsx` (remove guarda pré-bloqueio e trata `auto_released`).
- `src/components/ChatWindow.tsx` (mesma mudança).
- `mem://logic/chat-ownership-and-takeover-confirmation` (atualizar: religar bot agora **não** requer fechar manualmente; força fechamento automático).

## Validação

1. Conversa com `atendente_id` setado e `status_conversa = 'aberta'` → clicar "Religar bot", digitar LIGAR → bot fica habilitado, atendente limpo, conversa fechada, toast indica auto-liberação.
2. Conversa sem atendente e fechada → fluxo igual ao atual, sem mensagem extra.
3. Desligar bot logo após religar → continua sendo bloqueado por `recent_manual_reactivation`.
4. Verificar `bot_historico` e `system_logs` registram a auto-liberação com autor.