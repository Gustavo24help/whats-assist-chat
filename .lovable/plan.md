

## Diagnóstico: Bot respondendo após ser desligado

### O que aconteceu com o número 554198751600

Analisei os dados e encontrei a seguinte cronologia:

| Horário | Evento |
|---------|--------|
| 19:28:18 | Bot responde (última mensagem antes de desligar) |
| **19:29:04** | **Bot DESLIGADO automaticamente pelo Twilio (POST_TurnBotOffOnError)** |
| 19:29:46 | Atendente Paula assume e envia mensagem |
| **19:30:56** | **Bot envia "Oi, sou a Olívia..." mesmo estando DESLIGADO!** |
| 19:31:13 | Cliente responde confuso: "Como assim?" |

### Causa Raiz

O cliente enviou uma nova mensagem após a atendente assumir. Essa mensagem disparou um **novo fluxo no Twilio Studio**, que:

1. Verificou o status do bot via `check-bot-status`
2. Deveria ter recebido "disabled", mas tratou como "enabled"
3. Enviou uma nova resposta da IA mesmo com o bot desligado

Isso pode acontecer por:
- **Race condition**: O novo fluxo foi iniciado antes da atualização do banco ser propagada
- **Caminho incorreto no fluxo**: O widget VERIFICAR_BOT pode não estar no início do fluxo para todas as mensagens
- **Falta de proteção no webhook**: O `twilio-webhook` não verifica o status do bot antes de salvar mensagens de bot

---

## Solução Proposta

Implementar uma **verificação de segurança no twilio-webhook** que impede mensagens de bot quando o bot está desativado.

### Mudança 1: Verificar status antes de salvar mensagem de bot

No arquivo `supabase/functions/twilio-webhook/index.ts`, antes de salvar qualquer mensagem do tipo `bot`:

```typescript
// Se a mensagem é do bot, verificar se o bot está habilitado
if (remetente === 'bot') {
  const { data: clienteStatus } = await supabase
    .from('clientes')
    .select('bot_habilitado')
    .eq('telefone', from)
    .maybeSingle();
    
  if (clienteStatus?.bot_habilitado === false) {
    console.log(`⛔ [twilio-webhook] Ignorando mensagem do bot - bot está DESABILITADO para ${from}`);
    return new Response(
      JSON.stringify({ 
        success: false, 
        reason: 'Bot desabilitado para este cliente'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
```

### Mudança 2: Adicionar verificação antes do envio via send-whatsapp (opcional)

No `send-whatsapp`, verificar se o remetente é "bot" e o bot está desabilitado:

```typescript
// Se é mensagem do bot, verificar se está habilitado
if (remetente === 'bot') {
  const { data: cliente } = await supabase
    .from('clientes')
    .select('bot_habilitado')
    .eq('telefone', to)
    .maybeSingle();
    
  if (cliente?.bot_habilitado === false) {
    console.log(`⛔ [send-whatsapp] Bloqueando envio - bot desabilitado para ${to}`);
    return new Response(
      JSON.stringify({ error: 'Bot desabilitado', blocked: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
```

---

## Benefícios

- Mensagens de bot nunca serão salvas/enviadas se o bot estiver desligado
- Proteção contra race conditions entre Twilio e banco de dados
- Log claro de tentativas bloqueadas para auditoria
- Não requer mudanças no Twilio Studio

---

## Detalhes Técnicos

### Arquivos a modificar:
1. `supabase/functions/twilio-webhook/index.ts` - Verificação antes de salvar mensagem de bot
2. `supabase/functions/send-whatsapp/index.ts` (opcional) - Verificação antes de enviar

### Impacto em dados existentes:
- **Nenhum** - Apenas mensagens futuras serão afetadas
- Dados já salvos permanecem inalterados

### Considerações:
- A verificação adiciona ~1 query extra ao banco por mensagem de bot
- O overhead é mínimo (< 50ms) e vale a segurança

