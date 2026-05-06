# Checklist de Migração — Desligamento dos módulos Make.com

> Baseado em `documentação/mapeamento-automacoes.md` e `.lovable/anon-policies-map.md`.
> Ordem: do menor para o maior risco. **Cada bloco tem critério de validação e plano de rollback.**

---

## Pré-requisitos (uma vez antes de começar)

- [ ] Exportar lista de **cenários ativos no Make.com** (nome, webhook URL, última execução, frequência).
- [ ] Garantir acesso ao painel do Twilio Studio (para reapontar HTTP widgets).
- [ ] Confirmar que o secret `BOT_CRIAR_FICHA_SECRET` está configurado nas Edge Functions (`criar-ficha-do-bot`, `atualizar-status-ficha`, `upsert-cliente`).
- [ ] Snapshot do banco (backup point-in-time disponível pelo Lovable Cloud).
- [ ] Janela de mudança combinada (idealmente fora do horário comercial).
- [ ] Definir 1 ficha-piloto para validar cada migração antes de desligar Make em produção.

---

## Fase 0 — ✅ Já migrado (somente confirmar e desligar)

### 0.1 Vínculo conversa ↔ ficha
- **Substituído por:** trigger SQL `trg_auto_vincular_conversa_ficha`
- **Validação:**
  - [ ] Criar 1 ficha de teste e confirmar que `conversa_ficha_vinculo` recebeu registro com `vinculado_por = 'trigger_auto'`.
  - [ ] Rodar query: `SELECT count(*) FROM conversa_ficha_vinculo WHERE vinculado_por = 'trigger_auto' AND created_at > now() - interval '24 hours'` — deve aumentar.
- **Ação Make:** desligar (pausar) o cenário "Make cria vínculo conversa↔ficha".
- **Rollback:** reativar cenário Make. O trigger é idempotente — não gera duplicidade (UPSERT por `telefone_cliente`).

### 0.2 Envio de link Asaas após finalização
- **Substituído por:** `auto-finalizacao` (acionada por trigger `trigger_auto_finalizacao_official`).
- **Status:** já desligado. Apenas confirmar que não há cenário Make legado ativo.

---

## Fase 1 — Migrações 🟡 prontas (Edge existe, falta apontar)

### 1.1 `criar-ficha-do-bot`
- **Substitui:** Make que faz INSERT em `fichas_de_servico`.
- **Pré-deploy:**
  - [ ] Confirmar que a Edge responde 200 num POST de teste com payload mínimo + header `x-bot-secret`.
  - [ ] Validar idempotência: 2 chamadas com mesmo `id_zoho` devem retornar `skipped: true` na 2ª.
- **Reapontamento Twilio Studio:**
  - [ ] Substituir HTTP widget que chama Make pelo URL da Edge Function.
  - [ ] Adicionar header `x-bot-secret: {{secret_do_bot}}`.
- **Validação (ficha-piloto):**
  - [ ] Disparar fluxo do bot end-to-end.
  - [ ] Conferir: ficha criada com `id` no formato `FGM<n>@YYMMDD`, status `Ficha Criada`, vínculo automático em `conversa_ficha_vinculo`.
  - [ ] Conferir log em `system_logs` (categoria `automation`).
- **Rollback:** reverter HTTP widget do Studio para a URL antiga do Make. **Não desligar o cenário Make até 48h de operação estável.**

### 1.2 `atualizar-status-ficha`
- **Substitui:** Make que faz UPDATE de status em `fichas_de_servico`.
- **Pré-deploy:**
  - [ ] Testar com status válido → 200, `status_anterior` e `status_novo` corretos.
  - [ ] Testar com status fora da whitelist → 400 com lista de permitidos.
  - [ ] Testar idempotência: chamar 2x com mesmo status → 2ª retorna `skipped: true`.
- **Reapontamento:**
  - [ ] Trocar URLs no Twilio Studio / cenários internos.
- **Validação (ficha-piloto):**
  - [ ] Mudar status via Edge.
  - [ ] Conferir registro automático em `ficha_status_historico` (gerado pelo trigger existente).
  - [ ] **Atenção:** mudança para `Finalizado` continua exigindo AlertDialog na UI. Não chamar via Edge automaticamente sem confirmação humana.
- **Rollback:** reverter URL para Make.

### 1.3 `upsert-cliente`
- **Substitui:** Make que cria/atualiza linha em `clientes`.
- **Política crítica:** **nunca sobrescreve** campo já preenchido (`nome`, `cpf`, `endereco`, `bairro`, `cidade`).
- **Pré-deploy:**
  - [ ] Cliente novo → cria.
  - [ ] Cliente existente com `nome` preenchido + payload com `nome` diferente → mantém o original (action: `skipped` ou `updated` apenas para campos vazios).
  - [ ] Cliente existente com `cpf` vazio + payload com `cpf` → atualiza apenas `cpf`.
- **Reapontamento:**
  - [ ] Trocar URL no Make / Twilio Studio para Edge.
- **Validação:**
  - [ ] Comparar contagem de clientes antes/depois (não deve cair).
  - [ ] Spot-check em 5 clientes recentes confirmando que `nome` original foi preservado.
- **Rollback:** reverter URL. Como a política é no-overwrite, mesmo se Edge e Make rodarem em paralelo por um curto período, **nenhum dado é perdido**.
- **Próximo passo opcional:** internalizar essa lógica direto no `twilio-webhook`, eliminando o cenário Make por completo.

---

## Fase 2 — Hardening RLS (depois de 1.1, 1.2 e 1.3 estáveis por ≥7 dias)

> Só executar **depois** que logs do Make confirmarem zero escritas diretas nas tabelas-alvo por 7 dias consecutivos.

### 2.1 Quick wins (Fase 1 do `anon-policies-map.md`)
- [ ] `mensagens_padronizadas`: remover INSERT/UPDATE/DELETE anon (manter SELECT).
- [ ] `categorias`: remover escrita anon.
- [ ] `ajustes_data_finalizacao`: remover SELECT/INSERT anon.
- [ ] `ficha_grupos` + `ficha_grupo_membros`: remover ALL anon.
- [ ] `bot_reactivation_schedule`: remover anon (Edge usa service_role).
- **Validação:** smoke test da UI autenticada (criar ficha, agendar, finalizar).
- **Rollback:** migration reversa que recria as policies.

### 2.2 Tabelas operacionais (somente após confirmar via logs do Make)
- [ ] `fichas_de_servico` + `ficha_status_historico`
- [ ] `conversa_ficha_vinculo`
- [ ] `clientes` (se existir policy anon — verificar)
- **Validação por tabela:**
  - [ ] Bot consegue criar ficha (via Edge).
  - [ ] Bot consegue mudar status (via Edge).
  - [ ] Webhook Twilio continua persistindo mensagens.
- **Rollback:** migration reversa imediata (manter SQL pronto antes de aplicar).

---

## Fase 3 — Limpeza final

- [ ] Arquivar/deletar cenários Make desligados há >30 dias.
- [ ] Remover secrets do Make do gerenciador de credenciais.
- [ ] Atualizar `documentação/mapeamento-automacoes.md` marcando os itens como 🟢 **Migrado**.
- [ ] Atualizar `.lovable/anon-policies-map.md` com snapshot novo.

---

## Matriz de risco × rollback

| Mudança | Risco | Tempo de rollback | Detecção |
|---|---|---|---|
| 0.1 Trigger vínculo | Baixo | Imediato (reativar Make) | Sem registro `trigger_auto` em `conversa_ficha_vinculo` |
| 1.1 `criar-ficha-do-bot` | Médio | 1 min (reverter HTTP widget Studio) | Bot não cria ficha → alerta `BotSemFichaNotification` |
| 1.2 `atualizar-status-ficha` | Médio | 1 min | Status não muda após ação do bot/operador |
| 1.3 `upsert-cliente` | Baixo (política no-overwrite) | 1 min | Cliente novo não aparece em `clientes` |
| 2.x RLS hardening | Alto | 1 migration reversa (~2 min) | Erros 401/403 em logs de Edge / Make / UI |

---

## Critérios "go / no-go" para cada fase

**GO se:**
- Teste em ficha-piloto passou.
- Logs de erro nas últimas 2h sem novos `error` relacionados.
- Rollback documentado e validado (ex.: URL antiga do Make ainda ativa).

**NO-GO se:**
- Qualquer divergência entre comportamento Make e Edge na ficha-piloto.
- Cenário Make tem dependência não mapeada (ex.: enriquecimento de dados externo).
- Não há janela para acompanhar 30min após o cutover.
