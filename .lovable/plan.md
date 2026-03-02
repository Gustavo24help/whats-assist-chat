
# Plano: Atualizar DOCUMENTACAO.md

## Resumo
Reescrever completamente o arquivo `DOCUMENTACAO.md` para refletir o estado atual do sistema, incluindo todos os modulos, paginas, componentes, edge functions, tabelas e integrações que foram adicionados desde a versao original.

## O que sera atualizado

### 1. Cabecalho e Visao Geral
- Versao para 2.0, data para Marco 2026
- Tabela de funcionalidades atualizada com novos modulos: Financeiro, Dashboard TV, Mensagens Internas, Avisos, Gerenciamento de Prestadores, Analise de Servicos, Manutencao, Avaliacao de Prestador, Acompanhamento de Prestador

### 2. Diagrama de Arquitetura
- Adicionar modulo Financeiro (transacoes, adiantamentos, conta corrente)
- Adicionar Dashboard TV com freeform canvas
- Adicionar Mensagens Internas
- Adicionar webhook-financeiro (Make)
- Adicionar modulo de sincronizacao de mensagens Twilio
- Atualizar storage buckets (chat-files + avisos-images)

### 3. Estrutura de Diretorios
- Adicionar `src/components/dashboard/tv/` (10 arquivos)
- Adicionar `src/components/financeiro/` (5 arquivos)
- Adicionar `src/components/internal-chat/` (3 arquivos)
- Adicionar novos componentes raiz: `AcompanhamentoTab`, `AvaliacaoPrestadorFlowPanel`, `AvaliacaoPrestadorMetricsKPIs`, `FerramentasManutencao`, `PopupConfirmacaoFinanceira`, `TakeoverRequestDialog`, `TakeoverWaitingDialog`, `OrcamentosSemFichaNotification`
- Adicionar novos contextos: `TVFreeformContext`, `TVLayoutContext`
- Adicionar novos hooks: `useDashboardTV`
- Adicionar novos utilitarios: `businessDays2026.ts`, `tvSounds.ts`

### 4. Paginas da Aplicacao (Secao 4)
Adicionar 8 paginas novas com rota, acesso e descricao:
- `/dashboard-tv` - DashboardTV (Monitor TV com widgets freeform)
- `/gerenciamento-prestadores` - GerenciamentoPrestadores
- `/gerenciamento-prestadores/:cpf` - PrestadorDetalhes
- `/analise-servicos` - AnaliseServicos
- `/manutencao` - Manutencao (ferramentas de manutencao do sistema)
- `/avisos` - Avisos (mural de avisos internos)
- `/mensagens` - MensagensInternas (chat interno entre operadores)
- `/financeiro` - Financeiro (gestao financeira completa)

### 5. Componentes Principais (Secao 5)
Adicionar documentacao para:
- **Modulo Dashboard TV**: TVFreeformCanvas, TVAutoSizeWidget, TVLayoutCustomizer, TVWidgetProperties, TVMonitorSettings, TVGoalBars, TVCelebration, MetaGaugeCard, MetasModal, MetasResultadosSection
- **Modulo Financeiro**: FinanceiroKPIs, HistoricoTransacoes, ContaCorrenteTab, AdiantamentosTab, NovoAdiantamentoDialog, PopupConfirmacaoFinanceira
- **Modulo Mensagens Internas**: InternalChatList, InternalChatWindow, NewInternalChatDialog
- **Acompanhamento do Prestador**: AcompanhamentoTab (comparecimento: Foi, Atrasou, Faltou)
- **Avaliacao do Prestador**: AvaliacaoPrestadorFlowPanel, AvaliacaoPrestadorMetricsKPIs
- **Takeover de Conversas**: TakeoverRequestDialog, TakeoverWaitingDialog
- Atualizar FichaServicoTab com secao de comparecimento_prestador

### 6. Contextos React (Secao 6)
Adicionar:
- `TVFreeformContext` - layout freeform do Dashboard TV (widgets arrastáveis, presets, salvamento no banco via tabela tv_layouts)
- `TVLayoutContext` - configuracoes gerais do TV

### 7. Hooks (Secao 7)
Adicionar:
- `useDashboardTV` - dados para o dashboard TV

### 8. Edge Functions (Secao 8)
Adicionar 9 edge functions novas:
- `monitor-mensagens` - monitoramento de mensagens
- `sync-messages` - sincronizacao de mensagens
- `sync-twilio-messages` - sync direto com Twilio
- `sync-twilio-messages-com-recuperacao` - sync com recuperacao de falhas
- `recover-message-sids` - recupera SIDs faltantes
- `force-recover-message-sids` - forcas recuperacao de SIDs
- `reprocess-backup-queue` - reprocessa fila de backup de mensagens
- `update-message-status` - atualiza status de mensagens
- `webhook-financeiro` - webhook para integracao financeira com Make

### 9. Modelo de Dados (Secao 9)
Adicionar tabelas novas:
- `transacoes_financeiras` (financeiro completo)
- `descontos_ajustes`
- `conta_corrente_prestador`
- `adiantamentos`
- `avaliacao_prestador`
- `tv_layouts` (layouts do dashboard TV por usuario)
- `avisos` e `aviso_leituras`
- `internal_conversations`, `internal_conversation_members`, `internal_messages`
- `takeover_requests`
- `mensagens_backup_queue` e `mensagens_backup_27fev`
- `twilio_sync_control`
- `dashboard_metas` (metas diarias e mensais)
- `webhook_debug_logs`
- Atualizar `fichas_de_servico` com campo `comparecimento_prestador`

Adicionar funcoes do banco:
- `calculate_conversas_iniciadas`
- `is_internal_conversation_member`
- `adicionar_dias_uteis`
- `arredondar_para_8`

### 10. Fluxos de Negocio (Secao 10)
Adicionar fluxos:
- **Fluxo Financeiro**: criacao de transacao, calculo de margem, pagamento prestador/cliente, adiantamentos, conta corrente
- **Fluxo de Takeover**: solicitacao, aprovacao, transferencia de conversa
- **Fluxo de Acompanhamento**: registro de comparecimento do prestador
- **Fluxo de Avaliacao do Prestador**: envio, resposta, classificacao
- **Fluxo de Sincronizacao de Mensagens**: sync-twilio, backup queue, recuperacao

### 11. Integracoes Externas (Secao 11)
Atualizar:
- Adicionar webhook-financeiro (Make) para sincronizacao financeira
- Detalhar fluxo de sincronizacao de mensagens Twilio (sync bidirecional)
- Documentar storage bucket `avisos-images`

### 12. Nova secao: Trocas de Informacoes
Criar secao dedicada documentando:
- **Entradas externas**: Twilio webhooks, formulario publico de orcamento, portal do prestador, Google Ads sync
- **Saidas externas**: Envio de mensagens WhatsApp, webhooks para Make (orcamento + financeiro), templates WhatsApp
- **Trocas internas**: Realtime subscriptions (mensagens, orcamentos, avisos), RLS policies por role, triggers do banco (status historico, bot reactivation, mark first orcamento)

### 13. Utilitarios (Secao 12)
Adicionar:
- `businessDays2026.ts` - calculo de dias uteis 2026
- `tvSounds.ts` - sons de celebracao para o Dashboard TV

### 14. Atualizar secao de Troubleshooting
Adicionar cenarios para novos modulos (financeiro, TV, mensagens internas)

## Arquivos a editar
- `DOCUMENTACAO.md` (reescrita completa)

## Nenhum dado existente sera modificado
Apenas o arquivo de documentacao sera atualizado. Nenhuma tabela, componente ou funcao sera alterada.
