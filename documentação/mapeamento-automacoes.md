# Mapeamento de Automações — Atendimento → Finalização

> Documento gerado em 06/05/2026. Cobre o ciclo completo: **chegada do cliente no WhatsApp → criação da ficha → orçamento → agendamento → execução → finalização → pagamento → recibo → NPS → garantia**.
> Cada etapa lista: **gatilho**, **componente que executa**, **efeitos colaterais** e **dependência externa (Make / Twilio Studio / Asaas)**.

---

## Legenda

- 🟢 **Interno** — roda 100% dentro do Supabase/Edge Functions (sem Make).
- 🟡 **Híbrido** — hoje passa pelo Make, mas já existe Edge equivalente para migrar.
- 🔴 **Externo** — ainda depende de Make ou Twilio Studio.
- ⚙️ **Trigger SQL** — automação no banco (não precisa de chamada externa).
- ⏰ **Cron** — agendado no `pg_cron`.

---

## 1. Recepção da mensagem do cliente (WhatsApp)

| # | Etapa | Tipo | Componente | Observação |
|---|---|---|---|---|
| 1.1 | Cliente envia msg WhatsApp | 🔴 | Twilio Studio Flow | Decide se aciona bot ou humano (`POST_UserMsg` → check status) |
| 1.2 | Webhook recebe a mensagem | 🟢 | `twilio-webhook` | Identifica `cliente_id` por To/From, persiste em `mensagens` |
| 1.3 | Upsert do cliente | 🟡 | `upsert-cliente` (nova) **ou** Make | Política no-overwrite (não sobrescreve `nome`, `cpf`, `endereco`) |
| 1.4 | Transcrição de áudio | 🟢 | `transcribe-audio` | Gemini, dispara automaticamente quando `MediaUrl` é áudio |
| 1.5 | Bot responde (Studio) | 🔴 | Twilio Studio | Defesas: `check-bot-status`, fail-closed se `bot_habilitado=false` |

---

## 2. Criação da Ficha

| # | Etapa | Tipo | Componente | Observação |
|---|---|---|---|---|
| 2.1 | Bot coleta dados e cria ficha | 🟡 | `criar-ficha-do-bot` (nova) **ou** Make→Supabase | Gera ID `FGM<n>@YYMMDD`. Idempotente por `id_zoho`. Header `x-bot-secret` |
| 2.2 | Vincula conversa ↔ ficha | 🟢⚙️ | Trigger `trg_auto_vincular_conversa_ficha` (AFTER INSERT) | Cria registro em `conversa_ficha_vinculo` automaticamente. **Dispensa Make** |
| 2.3 | Garante `nome_cliente` ≠ vazio | 🟢⚙️ | Trigger `trg_ensure_nome_cliente_preenchido` | Fallback "Cliente" |
| 2.4 | Status inicial `Ficha Criada` | 🟢⚙️ | Default da coluna `status` | — |
| 2.5 | Histórico de status | 🟢⚙️ | Trigger `trigger_track_ficha_status_change` | Insere em `ficha_status_historico` |

---

## 3. Orçamento

| # | Etapa | Tipo | Componente | Observação |
|---|---|---|---|---|
| 3.1 | Form público de orçamento | 🟢 | `public-orcamento-data` + `submit-orcamento` | Bypass RLS via Edge |
| 3.2 | Janela de envio (2h) | 🟢 | Lógica em `submit-orcamento` + `formulario_orcamento_*` | Fecha após 2h do 1º envio ou ao mudar para Agendado/Aprovado/Perdido |
| 3.3 | Fechamento por mudança de status | 🟢⚙️ | Trigger `trg_close_orcamento_on_status` | — |
| 3.4 | Notificação "Orçamentos sem ficha" | 🟢 | `OrcamentosSemFichaNotification.tsx` (frontend) | Realtime |
| 3.5 | Verificação periódica de forms | 🟢⏰ | `check-orcamento-forms` | Cron interno |

---

## 4. Agendamento e Janelas

| # | Etapa | Tipo | Componente | Observação |
|---|---|---|---|---|
| 4.1 | Janela do Cliente (comercial) vs Janela do Prestador (operacional) | 🟢 | `janelaHorarioPrestador.ts` | Sempre termina :00 ou :30 |
| 4.2 | Validação de `tipo_agendamento` | 🟢⚙️ | Trigger `validate_tipo_agendamento_trigger` | — |
| 4.3 | Atualização de status (`Agendado`, `Visita`, etc.) | 🟡 | `atualizar-status-ficha` (nova) **ou** Make | Whitelist + idempotente. Header `x-bot-secret` |
| 4.4 | Reativação do bot após agendamento | 🟢⚙️⏰ | Trigger `schedule_bot_reactivation_trigger` + cron `reactivate-bots-24h` / `process-bot-reactivation` | 10 dias (Agendado/Visita) ou 24h |

---

## 5. Execução do Serviço

| # | Etapa | Tipo | Componente | Observação |
|---|---|---|---|---|
| 5.1 | Comparecimento do prestador | 🟢⚙️ | Trigger `trg_track_comparecimento_prestador` | Marcos em `marcos_servico_prestador` |
| 5.2 | Marcos do serviço | 🟢⚙️ | Trigger `trg_track_marcos_servico_prestador` | — |
| 5.3 | Troca de prestador (split payment) | 🟢 | `TrocaPrestadorPagamentoDialog` | Cria 2 transações `prestador_trocado` + `prestador_substituto` |
| 5.4 | Promoção automática de status ao definir valor | 🟢⚙️ | Trigger `trg_auto_promote_status_on_valor_manual` | — |

---

## 6. Finalização (status → "Finalizado")

> ⚠️ Mudar para `Finalizado` exige **AlertDialog de confirmação** (proteção contra cobrança acidental).

| # | Etapa | Tipo | Componente | Observação |
|---|---|---|---|---|
| 6.1 | Trigger principal de finalização | 🟢⚙️ | `trigger_auto_finalizacao_official` (AFTER INSERT/UPDATE) | Dispara `auto-finalizacao` |
| 6.2 | Geração do link Asaas | 🟢 | `auto-finalizacao` → Asaas API | `maxInstallmentCount` se >1 → `billingType=UNDEFINED` |
| 6.3 | Envio do link via WhatsApp | 🟢 | `auto-finalizacao` → Twilio | Verifica janela 24h (consulta últimas 20 mensagens). Fora → template `aviso_pagamento_3` |
| 6.4 | Criação/atualização de `contas_receber` | 🟢 | `auto-finalizacao` (UPSERT por `ficha_id`) | — |
| 6.5 | Sincronização de transação financeira | 🟢⚙️ | Trigger `trg_sync_transacao_on_pagamento` | Cria/atualiza `transacoes_financeiras` |
| 6.6 | Data prevista de pagamento | 🟢 | `businessDays2026.ts` | 2 dias úteis após 1º registro `Finalizado` (calendário 2026) |

---

## 7. Pagamento (Asaas)

| # | Etapa | Tipo | Componente | Observação |
|---|---|---|---|---|
| 7.1 | Webhook de pagamento Asaas | 🟢 | `asaas-webhook` | Marca `pagamento_realizado=true`, status → `Garantia` |
| 7.2 | Reconciliação periódica | 🟢⏰ | `reconcile-asaas-payments` | Cron — pega pagamentos perdidos |
| 7.3 | Pagamentos órfãos | 🟢 | `PagamentosOrfaos.tsx` | UI para resolver manualmente |
| 7.4 | Tracking de status do pagamento | 🟢⚙️ | Trigger `trigger_track_pagamento_status` | Histórico em `transacoes_financeiras` |

---

## 8. Recibo, NPS e Pós-venda

| # | Etapa | Tipo | Componente | Observação |
|---|---|---|---|---|
| 8.1 | Geração do recibo PDF | 🟢 | `send-recibo` + `ReciboGenerator.tsx` | Anexa PDF se dentro da janela 24h |
| 8.2 | Envio do NPS | 🟢 | `send-nps` | Template WhatsApp; resposta livre persistida em `mensagens` |
| 8.3 | Status `Garantia` | 🟢 | Definido pelo `asaas-webhook` ao confirmar pagamento | — |
| 8.4 | Avaliação do prestador | 🟢 | `AvaliacaoPrestadorFlowPanel.tsx` | Tabela `avaliacao_prestador` |

---

## 9. Monitoramento contínuo (Crons)

| Cron | Periodicidade | Função |
|---|---|---|
| `check-unanswered-clients` | 30 min | Alerta admin (Gemini flash-lite) se bot desligado e cliente sem resposta >30min |
| `check-orcamento-forms` | — | Reabre/fecha janelas de orçamento |
| `reactivate-bots-24h` | Horária | Reativa bots após 24h |
| `process-bot-reactivation` | Frequente | Processa fila `bot_reactivation_schedule` |
| `monitor-mensagens` | — | Detecta gaps e dispara `sync-twilio-messages` |
| `sync-google-ads` | Diária | KPIs em `google_ads_metrics` (também via Make POST) |
| `reconcile-asaas-payments` | Diária | Reconcilia pagamentos |
| `reprocess-backup-queue` | — | Reprocessa `mensagens_backup_queue` |

---

## 10. Mapeamento Make → Edge (status da migração)

| Cenário Make | Edge equivalente | Status | Ação recomendada |
|---|---|---|---|
| Make cria ficha (`fichas_de_servico` INSERT) | `criar-ficha-do-bot` | 🟡 Pronto, não migrado | Apontar Twilio Studio (HTTP widget) direto p/ Edge |
| Make atualiza status da ficha | `atualizar-status-ficha` | 🟡 Pronto, não migrado | Migrar e desligar módulo |
| Make faz upsert de cliente | `upsert-cliente` | 🟡 Pronto, não migrado | Migrar **ou** internalizar no `twilio-webhook` |
| Make cria vínculo conversa↔ficha | Trigger `trg_auto_vincular_conversa_ficha` | 🟢 **Migrado** | **Pode desligar módulo Make** |
| Make envia link Asaas após finalização | `auto-finalizacao` (via trigger) | 🟢 **Migrado** | Já desligado |
| Make sync Google Ads | `sync-google-ads` | 🟡 Coexiste (Make POST + cron) | Manter por enquanto |

---

## 11. Defesas e Salvaguardas

- **Bot fail-closed**: se `bot_habilitado=false` e Twilio responder, `stop-twilio-flow` é acionado. Reativação manual exige digitar literalmente **"LIGAR"**.
- **Janela 24h Twilio**: validada consultando `mensagens` (últimas 20), não apenas `ultima_interacao`.
- **Deduplicação de mensagens**: 3 camadas (ID, `message_sid`, Texto+sender em 30s).
- **RLS aberto** em tabelas operacionais p/ webhooks (Make, Twilio); tabelas internas restritas.
- **Idempotência**: criação de ficha por `id_zoho`; `contas_receber` por `ficha_id`.
- **AlertDialog de confirmação** ao mudar para `Finalizado` (evita cobrança indevida).
- **Skip realtime de 2s** em saves locais de Ficha p/ não sobrescrever inputs do operador.
- **Logout por inatividade**: 2h com aviso 15min antes; redistribui chats via `atribuicao_cadeia`.

---

## 12. Próximos passos sugeridos

1. **Migrar Twilio Studio** para chamar diretamente `criar-ficha-do-bot`, `atualizar-status-ficha`, `upsert-cliente` (HTTP widget com header `x-bot-secret`).
2. **Internalizar `upsert-cliente` no `twilio-webhook`** — eliminaria 1 cenário Make completo.
3. **Após 1+2**: revogar políticas `anon` de INSERT/UPDATE em `fichas_de_servico`, `clientes`, `conversa_ficha_vinculo` (ver `.lovable/anon-policies-map.md`).
4. **Documentar webhooks ativos no Make** com prints/URLs para auditoria final antes de desligar.
