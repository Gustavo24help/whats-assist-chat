# Integração Asaas — Auto-confirmação de Pagamentos

**Data de ativação:** 2026-03-18  
**Versão:** 1.0

## Resumo

Quando o cliente paga via link Asaas, o sistema recebe uma notificação automática (webhook) e marca o pagamento como realizado sem intervenção manual.

## Fluxo completo

```
1. Operador gera link de pagamento na ficha (Edge Function: create-payment-link)
   → Cria link no Asaas com externalReference = ficha_id
   → Salva URL na ficha (campo pagamento_link)
   → Envia automaticamente ao cliente via WhatsApp (se janela 24h permitir)

2. Cliente paga pelo link (PIX, cartão ou boleto)

3. Asaas dispara webhook → /functions/v1/asaas-webhook
   Eventos processados: PAYMENT_RECEIVED, PAYMENT_CONFIRMED
   Autenticação: header "asaas-access-token" validado contra secret ASAAS_WEBHOOK_TOKEN

4. Edge function identifica a ficha (3 estratégias em ordem):
   a) externalReference do payment (contém ficha_id direto)
   b) description do payment (regex para extrair "FS1-250101")
   c) paymentLink ID → consulta API Asaas → busca URL no banco (fichas_de_servico.pagamento_link)

5. Atualizações automáticas:
   - fichas_de_servico.pagamento_realizado = true
   - fichas_de_servico.notas += log com data/hora, valor e payment ID
   - transacoes_financeiras.status_pagamento_cliente = "pago"
   - transacoes_financeiras.data_pagamento_realizada = now()

6. Sincronização: dispara webhook Make (MAKE_WEBHOOK_UPDATE_PLANILHA) com tipo "pagamento_cliente_confirmado"
```

## Configuração no Asaas

| Campo | Valor |
|-------|-------|
| URL | `https://halqtsowfqkczvlvwmdd.supabase.co/functions/v1/asaas-webhook` |
| Token | Secret `ASAAS_WEBHOOK_TOKEN` |
| Eventos | `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED` |

## Secrets necessárias

- `ASAAS_API_KEY` — chave da API Asaas (usada na create-payment-link e para consultar links no webhook)
- `ASAAS_WEBHOOK_TOKEN` — token de autenticação do webhook
- `MAKE_WEBHOOK_UPDATE_PLANILHA` — URL do cenário Make para sincronizar planilha

## Arquivos envolvidos

- `supabase/functions/asaas-webhook/index.ts` — recebe notificações do Asaas
- `supabase/functions/create-payment-link/index.ts` — gera links de pagamento
- `src/components/EnviarLinkPagamentoDialog.tsx` — dialog para enviar link ao cliente via WhatsApp

## Proteções

- Pagamentos já marcados como `pagamento_realizado = true` são ignorados (idempotência)
- Eventos que não sejam PAYMENT_RECEIVED/CONFIRMED são ignorados
- Se a ficha não for identificada, retorna 404 (sem efeitos colaterais)
- Token inválido retorna 401

## Indicador visual

No módulo Financeiro (Pagamento Clientes), pagamentos confirmados automaticamente via webhook exibem um badge azul **"Auto"** no histórico.
