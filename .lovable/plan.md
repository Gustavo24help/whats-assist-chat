# Investigação completa do Bot — diagnóstico + plano

Cruzei o JSON do Studio Flow com o banco e o código. Existem **quatro causas independentes** somando-se aos sintomas. A causa nº 1 explica diretamente "desliguei e ele continua respondendo".

---

## Causa 1 (a mais grave): o Flow NÃO reconsulta o status do bot dentro do loop de conversa

Fluxo real para mensagem inbound:

```
Trigger ─► POST_UserMsgTo24help_Initial ─► VERIFICAR_BOT ─► bot_ativo
                                                              │
                                              enabled ────────┴────► set_InitialVariables ─► … ─► reply_AiResponse
                                                                                                    │
                                                              (next inbound msg)                    ▼
                                                              POST_AgentMsgTo24help2 ─► POST_UserMsgTo24help
                                                                                                    │
                                                                                                    ▼
                                                                                  set_VarsFromUserReply ─► … ─► run_subflow_PersistentAgent ─► reply_AiResponse
```

`reply_AiResponse` é um widget `send-and-wait-for-reply` com `timeout: 28800` (8 horas). Toda mensagem subsequente do cliente reentra por **`POST_AgentMsgTo24help2`**, e a partir daí o flow vai direto pra IA e pro próximo `reply_AiResponse`. **Nunca passa de novo pelo `VERIFICAR_BOT`.**

Resultado: assim que o cliente engata uma conversa, o bot responde por até 8 h **independentemente** de o operador desligar pelo painel. O toggle só faz efeito na próxima execução nova (quando o cliente abrir uma janela depois desse timeout, ou for atingido por template).

Esse é o "bot OFF mas continua respondendo" que vocês veem.

## Causa 2: `check-bot-status` é fail-open + sensível a formato de telefone

`VERIFICAR_BOT` envia `telefone = {{trigger.message.From}}` (= `whatsapp:+5541999999999`). O edge function faz:

```ts
.eq('telefone', telefone).maybeSingle()
// se erro/não achou → bot_status: 'enabled'
```

E achei pares duplicados de cliente em formatos diferentes:

```
+554195960013      ↔ whatsapp:+554195960013
+554198775177      ↔ whatsapp:+554198775177   (estados de bot opostos)
41998751600        ↔ whatsapp:+5541998751600
+559293665512      ↔ whatsapp:+559293665512
```

Quando o operador desliga o bot no registro curto e o Flow consulta o registro `whatsapp:+55…`, retorna `enabled` e o bot responde. Quando o registro não existe em nenhum formato, idem.

## Causa 3: 100 clientes "esquecidos" — bot desligado e nenhum agendamento de religação

Rodei no banco:

```
Clientes com bot_habilitado = false:                                       473
 ├─ com trava manual (bot_desligado_manualmente=true):                    255
 ├─ com atendente humano atribuído:                                       (parte)
 └─ SEM trava manual + SEM atendente + SEM linha pendente em
    bot_reactivation_schedule (= órfãos que nunca religam):                100
Clientes com data_bot_desabilitado NULL apesar de off:                      55
```

A função `reactivate-bots-24h` só processa linhas existentes em `bot_reactivation_schedule`. Se algum caminho desligou o bot setando `bot_habilitado=false` direto na tabela (templates, pre-qualificação, criar-ficha-do-bot, ou qualquer chamada antiga sem o `requested_origin` certo), o agendamento não nasceu — e o cliente fica para sempre com bot OFF. Bate exatamente com "bot não religou em casos antigos" e com o caso real do `whatsapp:+5541999777780` (off desde 17/04, sem schedule).

## Causa 4: "bot liga sozinho"

Dois caminhos plausíveis (preciso confirmar com um caso real e horário):

a. `reactivate-bots-24h` religa via cron mesmo quando `atendente_id` mudou, ou quando o operador desligou DEPOIS do schedule já estar criado mas a função não revalida `bot_desligado_manualmente` antes. Hoje a pré-checagem existe (linhas 56-78 da função) e respeita `bot_desligado_manualmente` e `atendente_id`. Mas se o operador desligou via UI sem setar `bot_desligado_manualmente=true` (origem != manual_button), o cron religa.

b. `toggle-bot-status` permite agora "auto-release" no enable: qualquer usuário consegue religar mesmo havendo atendente. Combinado com botões antigos que disparam `enable_bot` sem `trigger_source` correto, isso explica "ligou sozinho do nada".

---

## O que vou implementar (depois da sua aprovação)

### Fase A — Tapar a torneira no Twilio Flow (resolve o sintoma nº 1)

Edição no Studio Flow (sem mexer em outro fluxo):

1. Após `POST_AgentMsgTo24help2` (cada mensagem do cliente recebida dentro do loop), inserir um novo widget **`VERIFICAR_BOT_LOOP`** chamando `check-bot-status` exatamente como `VERIFICAR_BOT`.
2. Conectar a um split `bot_ativo_loop`: se `disabled`, vai para `POST_UserMsg_BotDisabled` (mesmo destino do split inicial) e o flow termina. Se `enabled`, segue para `POST_UserMsgTo24help` como hoje.
3. Mesma proteção depois de `POST_AgentMsg_HelloMessage` / `POST_AgentMsg_AskForServiceOrder` antes de qualquer novo `reply_…` que reentra na IA.

Vou te entregar o JSON revisado do Flow para você importar no Studio (você publica). Não consigo publicar pelo Lovable.

### Fase B — Endurecer `check-bot-status` (resolve o sintoma nº 2 sem depender da Fase C)

- Normalizar o telefone recebido em três formatos (curto sem 55, `+5541…`, `whatsapp:+5541…`) e consultar todos com `.in(...)`.
- Se **qualquer** registro estiver `bot_habilitado=false`, retornar `disabled`. Fail-closed parcial: registro existente com OFF sempre vence.
- Manter fail-open só quando NENHUM dos formatos existe (cliente novo de verdade) — logando em `system_logs` para detectarmos casos suspeitos.
- Sem alterações de schema. Sem mexer em UI.

### Fase C — Reconciliar duplicidade de cliente

- SQL de inspeção: listar os 4 pares duplicados com contagem de mensagens, fichas e bot_historico em cada lado. Eu te mostro a tabela antes.
- Migração assistida: para cada par, manter o registro `whatsapp:+55…` (que é o que o webhook e o Twilio sempre criam) e re-apontar FKs (`mensagens`, `mensagens_prestadores` não aplica, `bot_historico`, `conversa_operador_leitura`, `ficha_coaching`, `fichas_de_servico.telefone_cliente`, `conta_corrente_prestador`, etc.) para o canônico. Deleta o registro curto só **depois** das FKs movidas.
- Adicionar índice único funcional em `regexp_replace(replace(replace(telefone,'whatsapp:',''),'+',''),'^55','')` para impedir nova duplicidade.
- Garantia: nenhum efeito em dados de mensagem (textos, datas, status). Só consolidação de chave.

### Fase D — Backfill + safety net para os 100 órfãos (resolve o sintoma nº 3)

- Migração idempotente: para todo cliente em condição "órfã" (`bot_habilitado=false`, sem trava manual, sem atendente, sem schedule pendente):
  - Insere `bot_reactivation_schedule` com `scheduled_at = COALESCE(data_bot_desabilitado, ultima_interacao, now()) + 24h` (no passado, então roda na próxima execução do cron).
  - Backfill: `data_bot_desabilitado = ultima_interacao` quando `NULL`.
  - **Não altera `bot_habilitado`, `bot_desligado_manualmente`, status, atendente, fichas ou qualquer outro campo.**
- Novo cron diário **`bot-safety-net-schedule`** (job pg_cron) que repete o mesmo critério, evitando que a torneira volte a vazar:
  - Roda 1×/dia às 06:00 BRT.
  - Para cada cliente órfão encontrado, cria schedule (idempotente via `NOT EXISTS`).
  - Loga contagem em `system_logs`.

### Fase E — Fechar a torneira no código (evitar futuros órfãos)

Varredura e centralização (eu mostro a lista de pontos antes de mudar):

- Substituir todo `update clientes set bot_habilitado=false` direto por chamada a `toggle-bot-status` com `requested_origin` correta. Pontos suspeitos: `criar-ficha-do-bot`, `send-template`, `auto-finalizacao`, `monitor-mensagens`, `processar-pagamento`.
- Dentro de `toggle-bot-status`, ao executar **qualquer** `disable_bot` não-manual, criar/atualizar `bot_reactivation_schedule` (24h padrão, 10d para `Agendado`/`Visita` — conforme `mem://logic/bot-reactivation-rules-and-exclusions`). Idempotência via `NOT EXISTS` por `telefone+executed=false`.
- Em `reactivate-bots-24h`, revalidar `bot_desligado_manualmente` e `atendente_id` **imediatamente antes** do enable (já faz, mas vou adicionar segundo check após o toggle retornar, para o caso de mudança de estado durante a chamada).

### Fase F — Página de saúde do bot

Tela `/admin/bot-saude` (só admin_ti), três blocos:

1. Clientes com bot OFF sem schedule pendente (tempo real).
2. Últimas 50 reativações automáticas + manuais nas últimas 48h.
3. Últimos 50 eventos `toggle_bot_inbound` por cliente (`system_logs`).

Sem efeito em qualquer outra parte do app.

---

## Garantias de segurança de dados (conforme `<project-knowledge>`)

- **Nada nas Fases A–F altera mensagens, horários, status de fichas, atribuições ou valores financeiros.**
- Os únicos UPDATE/INSERT em produção são:
  - Inserção em `bot_reactivation_schedule` (linhas novas, idempotente).
  - Backfill de `data_bot_desabilitado` **apenas quando NULL**.
  - Re-apontamento de FK para os 4 pares duplicados, com SELECT prévio mostrado a você.
- Mudanças no Studio Flow são entregues como JSON para você revisar e publicar; não automatizo via API.
- Toda mudança em edge functions é deployada com logs em `system_logs` para auditoria.

## Ordem de execução sugerida

1. **Fase B** primeiro (mais barata, derruba imediatamente o "OFF mas responde" em mensagens novas de sessão).
2. **Fase D** (backfill) — religa os 100 órfãos atrasados.
3. **Fase A** (Flow) — derruba o sintoma dentro da sessão ativa. Você publica.
4. **Fase E** — fecha o vazamento no código.
5. **Fase C** (duplicidade) — depois das outras, com revisão SQL prévia.
6. **Fase F** — observabilidade.

Aprovar para eu começar pela B+D (mais seguras), depois te entrego o JSON do Studio Flow para Fase A.
