
# Corrigir Mensagens em Branco no Chat

## Problema
O campo `remetente` na tabela `mensagens` foi migrado de valores textuais ("cliente"/"atendente"/"bot") para telefones reais (ex: `whatsapp:+554138911555`). Porem, o codigo frontend e algumas edge functions ainda comparam com os valores antigos, causando mensagens sem estilizacao correta.

O numero da 24help e: `whatsapp:+554138911555`

**Dados atuais no banco:**
- 18.191 mensagens com `whatsapp:+554138911555` (24help/atendente/bot)
- Milhares de mensagens com numeros de clientes
- Apenas 20 registros antigos com "cliente"/"atendente"/"bot"

## Arquivos a Corrigir

### 1. `src/components/ChatWindow.tsx`

**Interface Mensagem (linha 49):** Mudar o tipo de `remetente` de `"cliente" | "atendente" | "bot"` para `string`.

**Constante global:** Adicionar `const NUMERO_24HELP = 'whatsapp:+554138911555';`

**Funcao helper:** Criar funcao `isAtendente(remetente: string)` que retorna `true` se `remetente === NUMERO_24HELP` ou `remetente === 'atendente'` ou `remetente === 'bot'` (para compatibilidade com os 20 registros antigos).

**Locais de comparacao a atualizar:**
- `getSenderName` (linha 75-81): usar `isAtendente()` em vez de switch
- `MessageStatusIndicator` (linha 125): `isAtendente()` em vez de `!== 'atendente'`
- Optimistic update (linha 1292): mudar `remetente: "atendente"` para `remetente: NUMERO_24HELP`
- Renderizacao (linhas 2139, 2145-2149, 2177, 2183): substituir todas as comparacoes

### 2. `src/components/NotificationSystem.tsx`

**Linha 24:** O filtro Realtime `remetente=eq.cliente` nao funciona mais. Mudar para escutar todas as mensagens e filtrar no callback: se `remetente !== NUMERO_24HELP`, e mensagem de cliente.

### 3. `src/components/ConversationList.tsx`

**Linha 687:** `.eq('remetente', 'cliente')` precisa mudar para `.neq('remetente', NUMERO_24HELP)` (buscar mensagens que NAO sao da 24help = mensagens de clientes).

### 4. `src/hooks/useConversationTimer.ts`

**Linha 25:** `.eq('remetente', 'cliente')` -> `.neq('remetente', NUMERO_24HELP)`
**Linha 76:** `payload.new?.remetente === 'cliente'` -> `payload.new?.remetente !== NUMERO_24HELP`

### 5. `src/hooks/useDashboardTV.ts`

**Linha 521:** `ultima.remetente === 'cliente'` -> `ultima.remetente !== NUMERO_24HELP`

### 6. `src/components/AvaliacaoPrestadorFlowPanel.tsx`

**Linha 107:** `msg.remetente !== "cliente"` -> `msg.remetente === NUMERO_24HELP` (inverter logica - ignorar mensagens da 24help)

### 7. `supabase/functions/send-whatsapp/index.ts`

**Linha 73:** `remetente === 'bot'` precisa manter compatibilidade (o parametro vem do frontend). Sem mudanca necessaria aqui.
**Linha 172:** `remetente: 'atendente'` -> `remetente: NUMERO_24HELP` (gravar telefone real).

## Estrategia de Seguranca

- Manter compatibilidade com os 20 registros antigos usando `||` nas comparacoes
- A funcao `isAtendente()` aceita tanto o telefone quanto os valores legados
- Nenhum dado existente sera alterado no banco
- Deploy da edge function `send-whatsapp` apos a correcao

## Detalhes Tecnicos

```text
Fluxo de identificacao:
  remetente === NUMERO_24HELP  -->  Mensagem do atendente/bot (verde)
  remetente === 'atendente'    -->  Legado (manter compatibilidade)
  remetente === 'bot'          -->  Legado (manter compatibilidade)
  qualquer outro valor         -->  Mensagem do cliente (branco)
```
