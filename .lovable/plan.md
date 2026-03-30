

# Envio inteligente com janela 24h: mensagem livre ou template automático

## Situação atual

O sistema **já verifica** a janela de 24h em três fluxos:
- **Recibo** (`send-recibo`): dentro → mensagem livre + PDF; fora → template `recibo_confirmado` (sem PDF)
- **NPS** (`send-nps`): dentro → mensagem livre; fora → template `nps_avaliacao`
- **Link de pagamento**: dentro → `send-whatsapp` (mensagem livre); fora → **falha e abre dialog manual**

O recibo e NPS já funcionam corretamente com o fallback automático para template.

**O único gap real é o link de pagamento**: quando fora da janela 24h, ele falha e pede envio manual, em vez de enviar automaticamente via template.

## O que implementar

### 1. Criar template para link de pagamento (necessário na Twilio)

Você precisa criar um Content Template na Twilio com o texto do link de pagamento, por exemplo:

```
{{1}}, segue o link para pagamento do serviço {{2}} no valor de {{3}}:

{{4}}

Qualquer dúvida estamos à disposição! 😊
```

Variáveis: `1=nome_cliente`, `2=nome_ficha`, `3=valor_total`, `4=payment_url`

Após criar, me informe o **Content SID** para registrar no banco.

### 2. Alterar `enviarLinkAutomatico` no `FichaServicoTab.tsx`

Quando `send-whatsapp` retornar `FORA_JANELA_24H`:
- Em vez de abrir o dialog manual, chamar `send-template` automaticamente com o template de pagamento
- Só abrir dialog manual se o template também falhar

```
enviarLinkAutomatico()
  ├─ Tenta send-whatsapp (mensagem livre)
  │   ├─ ✅ Sucesso → done
  │   └─ ❌ FORA_JANELA_24H → tenta send-template
  │       ├─ ✅ Sucesso → done
  │       └─ ❌ Falha → abre dialog manual (fallback final)
  └─ ❌ Outro erro → abre dialog manual
```

### 3. Fallbacks robustos em todos os fluxos

Adicionar `try/catch` com logging em `send-recibo` e `send-nps` para cenários de exceção:
- Twilio fora do ar → log do erro + marcar para retry manual
- Template não encontrado no banco → log + notificação ao operador
- Upload de PDF falhou → enviar mensagem de texto sem PDF como fallback

### 4. Registrar template no banco

Migration SQL para inserir o template `link_pagamento` na tabela `whatsapp_templates` (após você criar na Twilio).

## Arquivos alterados

- `src/components/FichaServicoTab.tsx` — lógica de fallback automático para template no envio de link
- `supabase/functions/send-recibo/index.ts` — fallbacks adicionais (PDF falhou → texto puro)
- `supabase/functions/send-nps/index.ts` — fallbacks adicionais
- Nova migration SQL — registro do template `link_pagamento`

## Próximo passo necessário

**Você precisa criar o Content Template na Twilio primeiro** para o link de pagamento, e me informar o Content SID. Sem isso, não há como enviar via template fora da janela.

