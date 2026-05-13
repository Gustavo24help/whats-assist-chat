## Correção proposta

Você está certo: não vou mais assumir “operador ligou sem querer”. A regra passa a ser: **se não existir prova auditável de que alguém digitou `LIGAR`, o bot não pode religar**.

## O que vou implementar

1. **Criar auditoria obrigatória de confirmação**
   - Criar uma tabela de auditoria para registrar cada tentativa de reativação manual do bot.
   - Campos principais:
     - telefone do cliente
     - operador logado
     - ficha ativa
     - texto digitado no campo de confirmação
     - horário em que o modal abriu
     - horário em que `LIGAR` foi digitado
     - horário do clique final
     - origem da tela
     - user agent/IP quando disponível
     - resultado: permitido, bloqueado ou expirado

2. **Criar um desafio por tentativa**
   - Ao abrir o modal de “Reativar Bot”, o sistema cria um `challenge_id` único.
   - O botão “Reativar Bot” só envia esse `challenge_id`.
   - O backend só aceita religar o bot se existir um desafio fresco, do mesmo operador, mesmo telefone, ainda não usado, com texto exatamente `LIGAR` registrado.

3. **Remover qualquer bypass frágil**
   - Remover `force_reactivate_manual: true` do frontend.
   - No backend, não aceitar mais esse bypass como prova de confirmação.
   - `confirmacao='LIGAR'` sozinho também não será suficiente; precisa existir o registro auditável do desafio.

4. **Bloquear religamento quando há atendimento humano ativo**
   - Mesmo com `LIGAR`, o backend bloqueará `enable_bot` se o cliente tiver `atendente_id` preenchido e `status_conversa != 'fechada'`.
   - Isso impede que uma conversa em atendimento humano volte para o bot por qualquer automação, bug de tela ou chamada indevida.

5. **Manter automações bloqueadas por trava manual**
   - Qualquer reativação automática/cron/webhook continuará bloqueada quando `bot_desligado_manualmente=true`.
   - Vou reforçar o log nesses bloqueios para diferenciar claramente:
     - tentativa automática bloqueada
     - tentativa manual sem desafio
     - tentativa manual com desafio inválido
     - tentativa manual permitida

6. **Corrigir a trava que piora a recuperação**
   - Hoje, quando o bot religa, o sistema pode bloquear um desligamento manual logo em seguida por `recent_manual_reactivation`.
   - Isso pode impedir a equipe de corrigir rapidamente um religamento indevido.
   - Vou ajustar para que **desligar manualmente sempre seja permitido**, especialmente após um religamento suspeito.

7. **Corrigir Noely imediatamente após aprovação**
   - Conferir o estado atual de Noely.
   - Se ainda estiver com bot ativo, desligar o bot e restaurar a trava manual.
   - Registrar isso em `bot_historico` como correção operacional, não como ação automática normal.

## Arquitetura técnica

### Banco

Criar tabela nova, por exemplo `bot_reactivation_confirmations`, para auditar a confirmação manual.

Ela não altera dados antigos e não muda horários existentes.

### Frontend

Alterar os dois chats:

- `ChatWindow.tsx`
- `ChatWindowBeta.tsx`

Fluxo novo:

```text
abre modal de reativação
→ cria desafio auditável
→ operador digita LIGAR
→ sistema registra que LIGAR foi digitado naquele desafio
→ operador clica Reativar Bot
→ backend valida desafio
→ só então permite ligar
```

### Backend

Alterar `toggle-bot-status`:

- Para `enable_bot` manual, exigir `confirmation_id/challenge_id` válido.
- Rejeitar chamadas sem desafio válido.
- Rejeitar chamadas com conversa ainda atribuída a operador ativo.
- Gravar motivo claro no `system_logs` e `bot_historico`.

## Resultado esperado

- Se o operador não digitou `LIGAR`, o bot não religa.
- Se o bot tentar religar sozinho, a chamada fica bloqueada e registrada.
- Se algum bug de frontend tentar enviar `enable_bot`, o backend bloqueia.
- Se acontecer de novo, teremos prova objetiva: quem abriu o modal, quem digitou, quando digitou, qual telefone/ficha e qual chamada tentou religar.