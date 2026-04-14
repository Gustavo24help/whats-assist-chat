# Integração Asaas — Auto-confirmação de Pagamentos

**Data de ativação:** 2026-03-18  
**Versão:** 2.0 (atualizada em 2026-04-14)

## Resumo

Quando o cliente paga via link Asaas, o sistema recebe uma notificação automática (webhook) e marca o pagamento como realizado sem intervenção manual. Também atualiza contas a receber, transação financeira, e dispara envio de recibo.

## Fluxo completo

```
1. Operador gera link de pagamento na ficha (Edge Function: create-payment-link)
   → Cria link no Asaas com externalReference = ficha_id
   → Salva URL na ficha (campo pagamento_link)
   → Envia automaticamente ao cliente via WhatsApp (se janela 24h permitir)

   OU (automação via trigger):
   → Ao mudar status para "Agendado" ou "Finalizado"
   → Trigger AFTER UPDATE dispara auto-finalizacao
   → Cria link Asaas + envia mensagem + cria conta a receber

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
   - fichas_de_servico.status → Garantia (se era Finalizado/Em andamento/Agendado)
   - fichas_de_servico.notas += log com data/hora, valor e payment ID
   - contas_receber.status = "pago"
   - contas_receber.data_pagamento = hoje
   - contas_receber.asaas_id = payment.id
   - contas_receber.asaas_status = event
   - transacoes_financeiras.status_pagamento_cliente = "pago"
   - transacoes_financeiras.data_pagamento_realizada = now()

6. Pós-pagamento:
   - Dispara send-recibo (envio de recibo PDF via WhatsApp)
   - Sincroniza com Make.com (MAKE_WEBHOOK_UPDATE_PLANILHA)

7. Registros de auditoria em automation_audit para cada etapa
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
- `supabase/functions/auto-finalizacao/index.ts` — gera links de pagamento e envia cobrança
- `supabase/functions/create-payment-link/index.ts` — gera links de pagamento (manual)
- `src/components/EnviarLinkPagamentoDialog.tsx` — dialog para enviar link ao cliente via WhatsApp
- `src/components/financeiro/PagamentoClientesTab.tsx` — marcação manual de pagamento
- `src/pages/ContasReceber.tsx` — gestão de contas a receber

## Trigger de automação

A trigger `trigger_auto_finalizacao_official` (AFTER INSERT OR UPDATE) na tabela `fichas_de_servico` dispara a edge function `auto-finalizacao` quando:
1. Status muda para "Agendado" ou "Finalizado" (e ficha tem valor > 0, sem link existente, não paga)
2. `valor_total` é atualizado de 0 para > 0 em ficha Agendado/Finalizado sem link (retry automático)

## Proteções

- Pagamentos já marcados como `pagamento_realizado = true` são ignorados (idempotência)
- Payment IDs já processados são ignorados (idempotência via automation_audit)
- Eventos que não sejam PAYMENT_RECEIVED/CONFIRMED são ignorados
- Se a ficha não for identificada, retorna 404 (sem efeitos colaterais)
- Token inválido retorna 401
- contas_receber usa upsert por ficha_id (evita duplicação em retries)

## Tabela de auditoria (automation_audit)

| Campo | Descrição |
|-------|-----------|
| ficha_id | ID da ficha de serviço |
| etapa | trigger, auto_finalizacao, webhook_pagamento, recibo |
| status | started, success, error, skipped |
| detalhe | Mensagem descritiva |
| payment_id | ID do pagamento Asaas (quando aplicável) |
| created_at | Timestamp |

## Indicador visual

No módulo Financeiro (Pagamento Clientes), pagamentos confirmados automaticamente via webhook exibem um badge azul **"Auto"** no histórico.

## Fluxos manuais consolidados

Quando o operador marca pagamento manualmente (PagamentoClientesTab ou ContasReceber), o sistema agora:
1. Atualiza `fichas_de_servico.pagamento_realizado = true`
2. Atualiza `transacoes_financeiras.status_pagamento_cliente = "pago"`
3. Atualiza `contas_receber.status = "pago"`
4. Dispara `send-recibo` para envio do recibo
5. Sincroniza com Make.com
