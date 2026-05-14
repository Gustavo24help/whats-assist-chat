# Plano: Atualização da Documentação Completa do Sistema 24Help

Atualizar `DOCUMENTACAO.md` (raiz) da versão **2.0 (Março 2026)** para **3.0 (Maio 2026)**, refletindo o estado atual do código.

## Escopo da atualização

A documentação atual está defasada em pelo menos 4 grandes áreas: novas páginas, novas edge functions, novos módulos de negócio e novas tabelas/regras. Não vou reescrever o arquivo do zero — vou aplicar edições cirúrgicas seção por seção, preservando o que continua válido.

### 1. Cabeçalho e versão
- Versão `2.0` → `3.0`
- Data → `Maio 2026`
- Adicionar nota de changelog resumida apontando para `documentação/changelog31032026.md`.

### 2. Funcionalidades Principais (seção 1)
Adicionar à tabela:
- **Chat BETA** (sistema de leitura unificado `mensagem_leitura_operador`, filtros `status_conversa`)
- **Chat com Prestadores** (canal Twilio isolado, recuperação de histórico)
- **Calendário** (mensal/semanal/diário com janela cliente vs prestador)
- **Tarefas / Tarefas Operacionais** (delegação, alertas, ponto)
- **Registro de Ponto** (tolerância 2 min, modal força logout/hora extra)
- **Portal do Prestador** (inclui acesso admin via `/admin-prestador`)
- **Contas a Pagar / Contas a Receber** (substituem visão antiga de Financeiro)
- **Pagamentos Órfãos** e **Logs de Pagamento**
- **Planilhas de Controle** (Financeiro / Pagamentos)
- **System Logs** (global e por ficha)
- **Avaliação do Prestador / NPS** (fluxos separados)
- **Coach IA de Vendas** (Claude Sonnet 4)
- **Pré-qualificação Bot** (`pre_qualificacao_bot` + `receber-ficha`)

### 3. Stack Tecnológica (seção 2)
- Confirmar libs adicionais usadas (date-fns, motion, recharts) sem inventar.
- Atualizar contagem de Edge Functions (era “28 funções” → agora ~49).

### 4. Páginas da Aplicação (seção 4)
Adicionar páginas inexistentes na doc:
`AdminPrestadorPortal`, `Calendario`, `ChatBeta`, `ChatPrestadores`, `ContasPagar`, `ContasReceber`, `FichaDetalhes`, `FichasGeral`, `LogsPagamento`, `MobileChat`, `PagamentosOrfaos`, `Planilha`, `PlanilhaControleFinanceiro`, `PlanilhaControlePagamentos`, `PrestadorDetalhes`, `PrestadorPortal`, `PrestadoresReport`, `RegistroPonto`, `SystemLogs`, `SystemLogsFicha`, `Tarefas`, `TarefasOperacionais`, `UserDetails`, `VisibilitySettings`.

### 5. Componentes (seção 5)
Adicionar módulos:
- **Chat BETA** (`src/components/chat-beta/*`)
- **Chat Prestadores** (`src/components/prestador-chat/*`)
- **Calendário** (`src/components/calendario/*`)
- **Tarefas** (`src/components/tasks/*`, `tarefas-op/*`)
- **Skill/Coach Vendas** (`SkillVendasCoach.tsx`, `VendasAssistant.tsx`)
- **Notificações novas** (`BotSemFichaNotification`, `OrcamentosSemFichaNotification`, `ServicoAtrasadoNotification`, `FichaSemNomeNotification`, etc.)

### 6. Hooks (seção 7)
Adicionar: `useClienteSignalsBeta`, `useExitReminder`, `useFichaGrupo`, `useInactivityLogout`, `useKPIDrillDown`, `useLogoutRedistribution`, `useOpenInNewTab`, `usePontoClock`, `useTaskAlert`, `useTaskAuth`, `useVisibleTasks`.

### 7. Edge Functions (seção 8)
Reorganizar em categorias e incluir as novas/faltantes:
- **Mensageria/Sync**: `sync-twilio-messages-com-recuperacao`, `recover-prestador-history`, `monitor-mensagens`, `search-messages`.
- **Bot/Atendimento**: `criar-ficha-do-bot`, `receber-ficha`, `check-unanswered-clients`, `vincular-conversa-ficha`.
- **Financeiro/Pagamentos**: `asaas-webhook`, `auto-finalizacao`, `create-payment-link`, `processar-pagamento`, `update-pagamento`, `reconcile-asaas-payments`, `webhook-financeiro`.
- **Prestadores**: `update-prestador-idcrm`, `upsert-cliente`, `recover-prestador-history`.
- **IA/Vendas**: `vendas-assistant`, `transcribe-audio`, `summarize-conversation`, `clean-description`.
- **Tickets/Status**: `atualizar-status-ficha`, `search-ficha-id`.
- **Templates/Notificações**: `send-recibo`, `send-nps`.
- **Outras**: `webhook-update-planilha`, `manage-users`.

Cada função: 1 linha de propósito + se requer JWT (ler `supabase/config.toml`) + secret usado quando aplicável.

### 8. Modelo de Dados (seção 9)
Adicionar tabelas que aparecem no código mas não no doc:
- `pre_qualificacao_bot` (nova — `ficha_id text FK`, `dados jsonb`, `sku_sugerido`, `confianca_classificacao`)
- `mensagem_leitura_operador` (Chat BETA v3)
- `tarefas`, `tarefas_operacionais`, `delegacoes`
- `ponto_registros`
- `atribuicao_cadeia`
- `bot_historico`
- `pagamento_webhook_logs`, `system_logs`, `ficha_logs`
- `transacoes_financeiras` (ampliar — tipos `prestador_trocado` / `prestador_substituto`)
- `prestadores` extended (`taxa_visita_padrao`, etc.)
- `google_ads_metrics`
- `status_conversa` enum

### 9. Fluxos de Negócio (seção 10)
Adicionar/atualizar:
- **Recebimento de ficha externa** via `receber-ficha` (X-Api-Key) gravando `fichas_de_servico` + `pre_qualificacao_bot`.
- **Finalização do serviço** (AlertDialog obrigatório → `auto-finalizacao` → Asaas → Garantia).
- **Cálculo financeiro 23%** (Total = Subtotal/0.77, arredondar para final 8).
- **Janela cliente vs janela prestador** (mapeamento sempre :00 ou :30).
- **Takeover de chat** (15s timer + AlertDialog).
- **Redistribuição de chats no logout** (`atribuicao_cadeia`).
- **Reativação de bot** (10 dias Agendado/Visita, 24h demais).
- **Logout por inatividade** (2h, aviso 15 min).
- **Pagamento dividido em troca de prestador**.

### 10. Integrações (seção 11) e Trocas (seção 12)
- Adicionar **Asaas** (link de pagamento, webhook, regra `billingType: UNDEFINED` quando `maxInstallmentCount > 1`).
- Adicionar **endpoint público `receber-ficha`** (header `X-Api-Key`).
- Adicionar **`public-orcamento-data`** como proxy RLS-bypass.
- Atualizar **WhatsApp templates v2** com tokens nomeados (`{{nome}}`).
- Confirmar **Make.com** (Google Ads + receber-ficha externo).

### 11. Autenticação e Autorização (seção 14)
- Adicionar role `admin_ti` (gerencia usuários e configs globais de UI).
- Documentar `useInactivityLogout` (2h) e `TAB_GRACE_PERIOD` 15s.
- Documentar política de RLS aberta para `anon` em tabelas operacionais (webhooks) vs internas restritas — referenciar `.lovable/anon-policies-map.md`.
- Desativação de usuário via `ban_duration` 100 anos.

### 12. Notificações (seção 15)
Acrescentar: anti-stacking, popups silenciosos para webhooks, alertas de bot sem ficha, alerta de mensagens não respondidas (cron 30 min com Gemini flash-lite).

### 13. Configurações (seção 16)
Adicionar `/visibility-settings`, `/system-logs`, `/system-logs-ficha`, `/logs-pagamento`, `/pagamentos-orfaos`, `/registro-ponto`, `/admin-prestador`.

### 14. Troubleshooting (seção 17)
Acrescentar entradas:
- Ficha não criada via `receber-ficha` → verificar `FICHA_WEBHOOK_SECRET` e header `X-Api-Key`.
- `pre_qualificacao_bot` vazio → verificar logs (insert é best-effort).
- Pagamento não bate → verificar `transacoes_financeiras` e webhook Asaas.
- Status duration vazio → verifica fallback `created_at` para `Ficha Criada`.
- Chat BETA com unread errado → conferir `mensagem_leitura_operador`.

### 15. Notas de Desenvolvimento
- Reforçar regras de Core Memory: contexto Março/Maio 2026, 23% margem, AlertDialog para Finalizado, 2h logout, links WhatsApp por path param, `fetchAllPaginated`.

## Detalhes técnicos da execução

- **Ferramenta**: edições incrementais com `code--line_replace` por seção (preservando trechos válidos), garantindo zero perda de conteúdo já correto.
- **Validação**: ao final, `grep -n "^## \|^### "` no arquivo atualizado para checar índice consistente; revisar contagem de seções e atualizar índice no topo se títulos mudarem.
- **Princípio**: documentação é texto puro — nenhum risco a dados/produção. Não há migrations envolvidas.

## Fora de escopo
- Não vou criar/atualizar outros docs em `documentação/` neste passo.
- Não vou alterar código fonte, schema ou edge functions.
- Não vou inventar tabelas/funções — só documentar o que existe no repositório.
