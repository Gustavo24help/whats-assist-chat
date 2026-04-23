

## Causa raiz do "Marcar como Não Lida" voltando sozinho

O documento do ChatGPT analisa Facebook/Instagram (Meta API). **Não se aplica** — aqui usamos WhatsApp/Twilio e a flag fica 100% no banco (`clientes.marcado_nao_lido`). Mas o diagnóstico geral ("jobs/sync sobrescrevem o estado manual") está correto e identifica exatamente o que acontece:

### Sequência do bug atual

1. Você clica **Marcar como Não Lida** numa conversa que **está aberta** (selecionada).
2. `toggleUnreadMark` faz `UPDATE clientes SET marcado_nao_lido=true`. ✅
3. O `UPDATE` dispara o canal realtime `clientes-changes` → `fetchClientes()` recarrega a lista. ✅ (volta `true`, ok)
4. **MAS**: chega qualquer mensagem nova no cliente (ou o trigger `on_new_client_message_mark_unread` roda) → realtime de `mensagens` dispara em `ChatWindow.tsx` → como a conversa está aberta, executa `UPDATE clientes SET marcado_nao_lido=false` (linhas 440-443).
5. Pior: ao **abrir** qualquer conversa (linhas 413-416) também faz `UPDATE marcado_nao_lido=false` incondicional.

Resultado: a marcação manual é apagada por qualquer auto-read posterior. É exatamente a "race condition / último que escreve vence" descrita no documento.

### Por que o sistema antigo (per-operador via `mensagem_leitura_operador`) tentou resolver isso

A tabela tinha um campo `manual_unread` separado de `last_read_at`, justamente para o auto-read **não pisar** na marcação manual. Mas como agora estamos no modelo global (1 só boolean), não dá pra distinguir "manual" de "automático".

## Solução proposta (mínima, sem reintroduzir a tabela operador-específica)

Adicionar 1 coluna na tabela `clientes`:

- `marcado_nao_lido_manual_em` (timestamp, nullable) — registra **quando** o usuário marcou manualmente como não lida.

### Regras

1. **`toggleUnreadMark` → marcar como não lida**: seta `marcado_nao_lido=true` **e** `marcado_nao_lido_manual_em=now()`.
2. **`toggleUnreadMark` → marcar como lida**: seta `marcado_nao_lido=false` **e** `marcado_nao_lido_manual_em=null`.
3. **Auto-read no `ChatWindow`** (abrir conversa / msg recebida com janela aberta): só executa o `UPDATE` se `marcado_nao_lido_manual_em IS NULL`. Ou seja, **respeita marcação manual**.
4. **Trigger `mark_client_unread_on_new_message`**: continua marcando `true` ao chegar mensagem nova do cliente, mas **não toca em `marcado_nao_lido_manual_em`**. Assim, mensagem nova quebra a "trava manual" naturalmente (você vai querer ver a nova mensagem mesmo).

### Por que isso resolve

- O auto-read deixa de sobrescrever ações manuais (causa #1 do bug).
- O usuário ainda consegue desmarcar manualmente (toggle limpa o `manual_em`).
- Mensagem nova do cliente continua marcando como não lida normalmente.
- Sem reintrodução de complexidade per-operador (que foi rejeitada).

## Arquivos a alterar

- **Migration nova**: adiciona coluna `marcado_nao_lido_manual_em` em `clientes` (nullable, sem default — preserva 100% dos dados atuais).
- `src/components/ConversationList.tsx` — `toggleUnreadMark` grava/limpa `marcado_nao_lido_manual_em`.
- `src/components/ChatWindow.tsx` — os 2 `UPDATE marcado_nao_lido=false` viram condicionais (`.is('marcado_nao_lido_manual_em', null)` no filtro do update).

## Garantias de não quebrar nada existente

- Coluna nova é **nullable**, sem default → todos os registros atuais ficam com `null`, comportamento idêntico ao de hoje para conversas que ninguém marcou manualmente.
- Trigger `on_new_client_message_mark_unread` (que acabei de recriar) **não é tocado**.
- Filtros (lista "Não Lidas", contador) continuam lendo apenas `marcado_nao_lido` — nenhum efeito visual muda.
- Sem mudança em RLS, em outros componentes, ou em edge functions.

