## O que aconteceu (caso Gabriel Benatti — 27/04/2026)

Reconstruí a timeline do telefone `whatsapp:+554188338794`:

```text
15:30:15  Valentina envia "Bom dia Gabriel..."     (operadora)
15:30:34  BOT responde "Bom dia, Gabriel! ☀️..."   ← bot ainda ATIVO
15:31:08  BOT responde de novo
15:31:39  Valentina DESLIGA o bot (toggle-bot-status, manual)
15:31:40  BOT responde (1s depois do desligamento)
15:31:54  BOT responde de novo
15:33:13  Valentina envia "Pedimos desculpa pelas mensagens automáticas"
15:33:20  BOT responde mais uma vez
15:33:58  Bot é LIGADO (toggle-bot-status manual, mesmo user_id)
15:34:04  Valentina DESLIGA novamente
15:34:38  BOT responde de novo
```

Histórico do `bot_historico` confirma os 3 toques manuais (desligado 15:31:39, ligado 15:33:58, desligado 15:34:04 — todos pelo `executado_por_id` da Valentina).

## Causas-raiz identificadas

**1. Twilio Studio Flow tem `allow_concurrent_calls: true`**
Cada mensagem do cliente abre uma execução paralela. Quando o operador clica em "desligar bot", a função `stop-twilio-flow` percorre apenas a PRIMEIRA execução ativa (`executions.find(...)`), não TODAS. As outras execuções já passaram pelo widget `VERIFICAR_BOT` antes do flag mudar e continuam respondendo até terminar — exatamente as 4 mensagens-fantasma após 15:31:39.

**2. Reativação manual sem confirmação**
Hoje, ligar o bot via dialog "Assumir conversa" exige só um clique (já há prevenção de double-click, mas não há confirmação por palavra-chave). Desligar pede `LIGAR` digitado; ligar não pede nada. A Valentina provavelmente clicou no botão errado às 15:33:58 (estado do dialog ainda mostrava "ligar" porque ela acabara de desligar).

**3. `stop-twilio-flow` mata 1 execução por chamada**
Mesmo após desligar, se houver 2-3 execuções concorrentes residuais, só 1 é encerrada. As demais continuam.

**4. Sem "guarda" no flow após VERIFICAR_BOT**
O flow consulta `bot_status` no início mas nunca reverifica antes de cada `reply_*`. Como cada execução leva alguns segundos (chamada à OpenAI, etc.), o estado pode mudar no meio.

## Correções propostas

### Correção 1 — `stop-twilio-flow` encerra TODAS as execuções ativas
Trocar `executions.find(...)` por `executions.filter(...)` e iterar encerrando cada uma. Continuar paginando se `meta.next_page_url` existir. Garantir que mensagem do operador silencia o bot 100%.

Arquivo: `supabase/functions/stop-twilio-flow/index.ts`.

### Correção 2 — Confirmação ao RELIGAR o bot manualmente
No diálogo de "Assumir conversa" (`src/components/ChatWindow.tsx` e `ChatWindowBeta.tsx`):
- Quando o estado capturado for "bot desligado" e a ação for **religar**, exigir digitação de `LIGAR` (mesmo padrão hoje aplicado para confirmar; já existe a string "LIGAR" no dialog mas o disabled está invertido — verificar também).
- Mostrar aviso vermelho explícito: "Religar o bot interromperá seu atendimento. Tem certeza?".

Memória `mem://features/bot-security-audit-history` já documenta a regra do "LIGAR"; vamos garantir que está aplicada corretamente também ao caminho de reativação.

### Correção 3 — Re-checagem do bot dentro do Twilio Studio Flow
Antes de cada widget que envia mensagem ao cliente nas etapas mais longas (`reply_AiResponse`, `reply_AskAgain`, `msg_AskForServiceOrder`, `msg_TransferingService`), inserir nova chamada a `check-bot-status` e abortar se `disabled`. Isso fecha a janela de corrida das execuções concorrentes.

> Esta etapa é uma alteração no Twilio Studio Flow (JSON `tmp/twlliodef.txt` é só referência local — a aplicação real é no Console Twilio). Vou entregar o JSON pronto e instruções de import; quem aplica é admin.

### Correção 4 — Auto-detecção: operador enviou mensagem → desliga bot agressivamente
Quando o operador envia mensagem e o bot ainda está habilitado, hoje o código pede para "Assumir Conversa". Vamos garantir que ao apertar "Assumir e desligar bot" o fluxo chame `stop-twilio-flow` (que será corrigido no item 1) **e** marque um cooldown de 60s impedindo qualquer re-ativação automática (cron `reactivate-bots-24h` ignora se `data_bot_desabilitado` < 60s).

Pequena alteração em `supabase/functions/reactivate-bots-24h/index.ts` para respeitar cooldown.

### Correção 5 — Auditoria: log do "antes/depois" no toggle
Adicionar no `bot_historico.observacao` o estado anterior (`bot_habilitado_anterior`) para facilitar análise futura ("foi ligado a partir de quê?"). Pequeno ajuste em `toggle-bot-status`.

## Arquivos que serão alterados

| Arquivo | O que muda |
|---|---|
| `supabase/functions/stop-twilio-flow/index.ts` | Loop em todas execuções ativas + paginação |
| `supabase/functions/reactivate-bots-24h/index.ts` | Cooldown de 60s após desligamento manual |
| `supabase/functions/toggle-bot-status/index.ts` | Registrar estado anterior no histórico |
| `src/components/ChatWindow.tsx` | Confirmação `LIGAR` para religar bot manualmente |
| `src/components/ChatWindowBeta.tsx` | Mesma confirmação |
| `tmp/twlliodef.txt` (referência) + entrega do JSON novo do flow | Re-checagem `check-bot-status` antes de `reply_*` (aplicado manualmente no Console Twilio) |

## O que NÃO será alterado (preservação de dados)

- Nenhuma migration de banco. Tabelas `clientes`, `bot_historico`, `bot_reactivation_schedule`, `mensagens` ficam intactas.
- Triggers existentes (`schedule_bot_reactivation`, etc.) preservados.
- Histórico antigo do bot do Gabriel Benatti continua acessível.
- Lógica de reativação automática após 10 dias (Agendado/Visita) e 24h (outros) mantida — apenas adicionamos o cooldown.

## Resultado esperado

- Operador desliga o bot → todas execuções concorrentes do Twilio são encerradas em 1 chamada.
- Mesmo se sobrar alguma, ela reverifica `bot_status` antes de responder e aborta.
- Reativar o bot manualmente passa a exigir digitar `LIGAR`, evitando clique acidental.
- Cron de reativação respeita cooldown de 60s, então um desligamento manual não é "engolido" por um job de 5 em 5 min.
