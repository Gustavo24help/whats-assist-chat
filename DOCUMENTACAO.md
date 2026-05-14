# 📘 Documentação Completa - Sistema 24Help

> **Versão**: 3.0
> **Última atualização**: Maio 2026
> **Propósito**: Sistema de atendimento ao cliente via WhatsApp para serviços residenciais
> **Changelog**: ver `documentação/changelog31032026.md` e notas em `mem://index.md`

---

## 📑 Índice

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Estrutura de Diretórios](#3-estrutura-de-diretórios)
4. [Páginas da Aplicação](#4-páginas-da-aplicação)
5. [Componentes Principais](#5-componentes-principais)
6. [Contextos React](#6-contextos-react)
7. [Hooks Customizados](#7-hooks-customizados)
8. [Edge Functions (Backend)](#8-edge-functions-backend)
9. [Modelo de Dados](#9-modelo-de-dados)
10. [Fluxos de Negócio](#10-fluxos-de-negócio)
11. [Integrações Externas](#11-integrações-externas)
12. [Trocas de Informações](#12-trocas-de-informações)
13. [Utilitários](#13-utilitários)
14. [Autenticação e Autorização](#14-autenticação-e-autorização)
15. [Sistema de Notificações](#15-sistema-de-notificações)
16. [Configurações do Sistema](#16-configurações-do-sistema)
17. [Troubleshooting](#17-troubleshooting)
18. [Notas de Desenvolvimento](#18-notas-de-desenvolvimento)

---

## 1. Visão Geral do Sistema

O **24Help** é uma plataforma de atendimento ao cliente via WhatsApp, projetada para empresas de serviços residenciais (eletricistas, encanadores, técnicos de eletrodomésticos, montadores, etc.). Combina bot Twilio Studio + IA, CRM operacional, financeiro completo e portal do prestador.

### Funcionalidades Principais

| Módulo | Descrição |
|--------|-----------|
| **Chat WhatsApp (clássico)** | Comunicação bidirecional em tempo real com clientes |
| **Chat BETA** | Nova UI com sistema unificado de leitura (`mensagem_leitura_operador`) e filtros por `status_conversa` |
| **Chat com Prestadores** | Canal Twilio isolado dos clientes, com recuperação de histórico via API Twilio |
| **Bot Automatizado** | Atendimento inicial via Twilio Studio + Lovable AI (Gemini), com pré-qualificação e criação automática de ficha |
| **Pré-qualificação Bot** | Tabela `pre_qualificacao_bot` armazena dados estruturados coletados pelo bot e SKU sugerido |
| **Fichas de Serviço** | CRM completo (16 status, lifecycle automático) |
| **Orçamentos** | Cotação com prestadores, formulário público (`/orcamento/:fichaId`), janela de envio controlada |
| **Calendário** | Visões mensal, semanal e diária com janela do cliente vs janela do prestador |
| **Tarefas / Tarefas Operacionais** | Delegação entre operadores, alertas modais, cron de checagem |
| **Registro de Ponto** | Tolerância 2 min, modal força logout ou hora extra ao final do turno |
| **Dashboard Executivo** | KPIs operacionais + drill-down |
| **Dashboard TV** | Monitor com widgets freeform arrastáveis |
| **Financeiro** | Contas a Pagar, Contas a Receber, Pagamentos Órfãos, Logs de Pagamento, Planilhas de Controle |
| **Integração Asaas** | Geração de link de pagamento + webhook de confirmação |
| **Mensagens Internas** | Chat entre operadores |
| **Avisos** | Mural interno com controle de leitura |
| **NPS** | Pesquisa pós-serviço (1-5) coletada via texto livre WhatsApp |
| **Avaliação do Prestador** | Pesquisa de satisfação sobre prestador |
| **Acompanhamento do Prestador** | Registro de comparecimento (Foi, Atrasou, Faltou) |
| **Portal do Prestador** | Área dedicada com KPIs, financeiro próprio, acesso admin via `/admin-prestador` |
| **Gerenciamento de Prestadores** | Cadastro centralizado + perfil estendido (`taxa_visita_padrao`) |
| **Análise de Serviços** | Painel analítico de serviços e indicadores |
| **Coach IA de Vendas** | Sugestões automáticas (Claude Sonnet 4) após resposta do cliente ou 3 min de inatividade |
| **System Logs** | Log global do sistema + log por ficha |
| **Manutenção** | Conta, usuários, ferramentas administrativas, configuração de cadeia de atribuição |
| **Relatórios** | Bairros, prestadores, tempo por status |
| **Takeover de Conversas** | Transferência segura entre operadores (15s timer + AlertDialog) |

### Arquitetura

```text
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (WhatsApp)                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TWILIO (WhatsApp API)                       │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  Studio Flow    │───▶│  Webhooks → Edge Functions          │ │
│  │  (Bot + IA)     │    │  • twilio-webhook                   │ │
│  └─────────────────┘    │  • send-whatsapp / send-template    │ │
│                         │  • twilio-status-callback           │ │
│                         │  • sync-twilio-messages (pull)      │ │
│                         │  • criar-ficha-do-bot               │ │
│                         │  • receber-ficha (Make/externo)     │ │
│                         └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SUPABASE / LOVABLE CLOUD                        │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  Edge Functions │    │  PostgreSQL                         │ │
│  │  (Deno, ~49)    │───▶│  • clientes, mensagens              │ │
│  └─────────────────┘    │  • fichas_de_servico, orcamentos    │ │
│                         │  • pre_qualificacao_bot             │ │
│                         │  • transacoes_financeiras           │ │
│                         │  • mensagem_leitura_operador        │ │
│  ┌─────────────────┐    │  • tarefas, ponto_registros         │ │
│  │  Auth (JWT+RLS) │    │  • atribuicao_cadeia, bot_historico │ │
│  └─────────────────┘    │  • system_logs, pagamento_logs      │ │
│                         └─────────────────────────────────────┘ │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  Storage        │    │  Realtime                           │ │
│  │  (chat-files,   │    │  (mensagens, orçamentos, avisos,    │ │
│  │   avisos, etc.) │    │   takeover broadcast)               │ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Make.com        │ │  Asaas (PIX/CC)  │ │  Lovable AI      │
│  • Google Ads    │ │  • Link pgto     │ │  Gateway         │
│  • Webhooks ext  │ │  • Webhook conf  │ │  (Gemini, GPT,   │
│  • Planilhas     │ │                  │ │   Claude)        │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## 2. Stack Tecnológica

### Frontend
- **React 18** + **Vite 5** + **TypeScript 5**
- **Tailwind CSS v3** + design system com tokens semânticos (HSL) em `index.css`/`tailwind.config.ts`
- **shadcn/ui** (Radix UI primitives)
- **react-router-dom** v6
- **@tanstack/react-query** para fetch/cache
- **date-fns** + locale ptBR
- **recharts** para gráficos
- **lucide-react** para ícones

### Backend (Supabase / Lovable Cloud)
- **PostgreSQL** com RLS habilitado em todas as tabelas
- **Edge Functions** (Deno runtime, ~49 funções)
  - Padrão obrigatório: importar `@supabase/supabase-js` via `npm:` specifier
  - Configurar `nodeModulesDir: auto` em `supabase/functions/deno.json`
- **Auth** (JWT + roles em tabela separada `user_roles`)
- **Realtime** para mensagens, orçamentos, avisos, takeover
- **Storage**: `chat-files`, `avisos-images`, etc.

### Integrações Externas
- **Twilio** (WhatsApp Business API + Studio Flow)
- **Asaas** (gateway de pagamento — PIX, cartão, boleto)
- **Make.com** (orquestração externa: Google Ads, planilhas, encaminhamento de fichas)
- **Google Ads API** (via Make → endpoint `sync-google-ads`)
- **Lovable AI Gateway** (Gemini 2.5 Flash, Gemini Flash Lite, Claude Sonnet 4)

---

## 3. Estrutura de Diretórios

```text
src/
├── App.tsx, main.tsx, index.css
├── components/
│   ├── ui/                          # shadcn primitives
│   ├── chat-beta/                   # Chat BETA (NinaTab, ResumoIATab, VendasAssistant…)
│   ├── prestador-chat/              # Canal Twilio isolado de prestadores
│   ├── calendario/                  # Visões diária/semanal/mensal
│   ├── financeiro/                  # PagamentoPrestadoresTabV2, etc.
│   ├── dashboard/                   # Widgets do Dashboard executivo e TV
│   ├── tasks/                       # Tarefas (TaskCard, TaskFormDialog, TaskAlertModal)
│   ├── tarefas-op/                  # Tarefas operacionais + Delegação
│   ├── internal-chat/               # Mensagens internas
│   ├── mobile/                      # Variantes mobile (chat, sheets)
│   └── *.tsx                        # Componentes globais (FichaPanel, ChatWindow, etc.)
├── contexts/                        # AuthContext, VisualMode, Notification, TVLayout, TVFreeform, DashboardLayout
├── hooks/                           # use* customizados
├── pages/                           # Rotas (ver seção 4)
├── lib/                             # Helpers puros
├── integrations/supabase/           # client.ts e types.ts (auto-gerados — NÃO EDITAR)
└── types/                           # Tipos compartilhados
supabase/
├── config.toml                      # Config edge functions (verify_jwt)
├── functions/
│   ├── _shared/                     # fichaLogger, pagamentoLogger, sanitizeAsaas, twilioNumbers
│   └── <49 funções>                 # ver seção 8
└── migrations/                      # Histórico SQL
documentação/                        # Documentos auxiliares
.lovable/                            # plan.md, anon-policies-map.md
mem://                               # Memória persistente (Core + memórias detalhadas)
```

---

## 4. Páginas da Aplicação

Lista completa em `src/pages/`:

| Página | Rota | Função |
|--------|------|--------|
| `Auth.tsx` | `/auth` | Login/cadastro com persistência de `returnTo` |
| `Home.tsx` | `/` | Hub inicial após login |
| `Chat.tsx` | `/chat` | Chat clássico WhatsApp |
| `ChatBeta.tsx` | `/chat-beta` | Nova UI de chat com Nina/Resumo IA, filtros `status_conversa` |
| `ChatPrestadores.tsx` | `/chat-prestadores` | Canal isolado de prestadores |
| `MobileChat.tsx` | `/mobile-chat` | Layout mobile dedicado |
| `Dashboard.tsx` | `/dashboard` | Dashboard executivo (KPIs operacionais + financeiros) |
| `DashboardTV.tsx` | `/dashboard-tv` | Modo TV com widgets freeform |
| `Fichas.tsx` / `FichasGeral.tsx` / `FichaDetalhes.tsx` | `/fichas`, `/fichas-geral`, `/ficha/:id` | CRUD/visualização de fichas |
| `Orcamentos.tsx` | `/orcamentos` | Lista interna de orçamentos |
| `OrcamentoPublico.tsx` | `/orcamento/:fichaId` | Formulário público (proxy via `public-orcamento-data`) |
| `Calendario.tsx` | `/calendario` | Agenda de serviços |
| `Tarefas.tsx` / `TarefasOperacionais.tsx` | `/tarefas`, `/tarefas-op` | Sistema de tarefas |
| `RegistroPonto.tsx` | `/registro-ponto` | Bater ponto |
| `Financeiro.tsx` | `/financeiro` | Visão financeira agregada |
| `ContasPagar.tsx` | `/contas-pagar` | Pagamento a prestadores |
| `ContasReceber.tsx` | `/contas-receber` | Recebimentos via Asaas |
| `PagamentosOrfaos.tsx` | `/pagamentos-orfaos` | Pagamentos sem ficha vinculada |
| `LogsPagamento.tsx` | `/logs-pagamento` | Histórico de webhooks Asaas/Make |
| `Planilha.tsx` / `PlanilhaControleFinanceiro.tsx` / `PlanilhaControlePagamentos.tsx` | `/planilha*` | Planilhas operacionais |
| `Avisos.tsx` | `/avisos` | Mural interno |
| `MensagensInternas.tsx` | `/mensagens-internas` | Chat operadores |
| `GerenciamentoPrestadores.tsx` / `PrestadorDetalhes.tsx` | `/prestadores`, `/prestador/:id` | CRUD prestadores |
| `PrestadorPortal.tsx` / `AdminPrestadorPortal.tsx` | `/portal-prestador`, `/admin-prestador` | Portal do prestador (auto-login via CPF, modo admin bypassa middleware estrito) |
| `PrestadoresReport.tsx` / `BairrosReport.tsx` / `AnaliseServicos.tsx` | `/relatorios/*` | Relatórios |
| `SystemLogs.tsx` / `SystemLogsFicha.tsx` | `/system-logs`, `/system-logs/:fichaId` | Logs |
| `Manutencao.tsx` | `/manutencao` | Admin (conta, usuários, ferramentas, cadeia de atribuição) |
| `Settings.tsx` | `/settings` | Configurações gerais (admin) |
| `VisibilitySettings.tsx` | `/visibility-settings` | Configurações de visibilidade (admin TI) |
| `UserDetails.tsx` | `/user/:id` | Detalhes de usuário |
| `NotFound.tsx` | `*` | 404 |

### 4.1 Sub-views, Tabs e Painéis Internos

Várias páginas funcionam como contêineres de múltiplas "sub-páginas" (painéis laterais, abas internas, modais full-screen). Cada sub-view tem função própria e, em muitos casos, dados/contextos isolados — devem ser tratadas como unidades independentes ao planejar mudanças.

**Chat (`/chat`, `/chat-beta`, `/chat-prestadores`)**
Layout de 3 colunas: lista de conversas → janela de mensagens → painel lateral. O painel lateral (`FichaPanel` / `FichaPanelBeta` / `PrestadorInfoPanel`) é praticamente uma página independente:
- Seletor de fichas do cliente (multi-ficha) + botões: criar, vincular, abrir logs em nova aba.
- Tabs internas: **Ficha** (`FichaServicoTab`) · **Acompanhamento** (`AcompanhamentoTab`) · **Orçamentos** (`OrcamentosTab`) · **Histórico** (`FichaHistoricoTab`).
- Em Chat BETA o painel ganha tabs adicionais: **Resumo IA**, **Resumo Ficha**, **Histórico Cliente**, **Nina** e **Vendas** (Coach IA).
- Define `setChatContext({ ficha_id, cliente_telefone })` para correlação automática de logs enquanto montado.

**Chat Prestadores**: painel lateral com `PrestadorInfoPanel` + `FichaVinculoSelector` (uma conversa pode vincular-se a múltiplas fichas via headers).

**Mensagens Internas (`/mensagens-internas`)**: lista (`InternalChatList`) + janela (`InternalChatWindow`) + diálogo de nova conversa.

**Dashboard (`/dashboard`)**: tabs internas — **Operacional**, **Financeiro**, **Avaliação Prestadores**, **NPS**, **Visita / Conversão**, **Tempo de Status**, **Orçamento**, **Acompanhamento Conversas**. Cada tab carrega hooks/queries próprios (`useOperationalKPIs`, `useDashboardSummary`, etc.). Drill-down via `useKPIDrillDown` abre fichas em nova aba.

**Dashboard TV (`/dashboard-tv`)**: layout freeform (`TVFreeformContext`) com widgets reposicionáveis; modo "layout" alterna para grid editável.

**Ficha Detalhes (`/ficha/:id`)**: as mesmas tabs do painel do chat (Ficha · Acompanhamento · Orçamentos · Histórico) em modo full-page, mais ações de WhatsApp, recibo e link de pagamento.

**Manutenção (`/manutencao`)**: tabs — **Conta** (`AccountInfo`/`PasswordChange`) · **Usuários** (`UserManagement`) · **Prestadores** (`PrestadorManagement`) · **Templates** (`TemplateManagement`) · **Mensagens Padronizadas** · **Ferramentas** (`FerramentasManutencao`, `TwilioReconcilePanel`) · **Cadeia de Atribuição** (`AtribuicaoCadeiaConfig`) · **Status/Cores** (`EditarCoresStatusFichaModal`) · **Alertas de Status** (`StatusAlertSettings`) · **Metas Diárias** (`DailyGoalsManager`).

**Settings (`/settings`)**: tabs — **Geral** · **Visibilidade** (somente `admin_ti`) · **Logs** · **Webhooks** (`PagamentoWebhookLogsViewer`).

**Financeiro / Contas a Receber / Contas a Pagar**: cada página tem filtros próprios (período, status pagamento, prestador) e modais — `EnviarLinkPagamentoDialog`, `PopupConfirmacaoFinanceira`, `TrocaPrestadorPagamentoDialog`, `AjustarDataFinalizacaoDialog`. A planilha (`/planilha*`) é uma view tabular separada com sincronização via `webhook-update-planilha`.

**Tarefas / Tarefas Operacionais**: lista + `TaskFormDialog` (criação/edição) + `TaskAlertModal` (alertas pop-up via `useTaskAlert`). Tarefas Operacionais adiciona tabs **Delegação** e **Resolver Conversas**.

**Calendário (`/calendario`)**: alterna entre **Janela do Cliente** (comercial) e **Janela do Prestador** (operacional) — são duas visualizações distintas dos mesmos serviços, com regras de mapeamento próprias.

**Prestador Detalhes (`/prestador/:id`)**: tabs — **Perfil**, **Financeiro** (cálculo líquido), **Histórico de Serviços**, **Avaliações/NPS**.

**Portal Prestador (`/portal-prestador`, `/admin-prestador`)**: app dedicado com suas próprias rotas internas (agenda, ficha aberta, finalização). `/admin-prestador` bypassa middleware estrito e permite auto-login via CPF para suporte.

**System Logs (`/system-logs`, `/system-logs/:fichaId`)**: a versão por ficha é uma sub-view filtrada por `ficha_id` com correlação automática de eventos de chat.

**Mobile (`/mobile-chat`)**: substitui o layout 3-colunas por bottom sheets (`MobileActionsSheet`, `MobileTemplatesSheet`) — cada sheet é equivalente a um painel desktop.

> **Regra ao planejar mudanças:** mudar uma "página" pode na verdade afetar várias sub-views. Sempre identifique se a alteração é no contêiner (rota), no painel lateral, em uma tab específica ou em um modal — e valide cada uma isoladamente.

---

## 5. Componentes Principais

### Módulo de Chat
- `ChatWindow.tsx`, `ChatWindowBeta.tsx` — janelas principais
- `ConversationList.tsx`, `ConversationListBeta.tsx`
- `ConversationCard.tsx`, `MessageContextMenu.tsx`, `ReplyIndicator.tsx`
- `AudioRecorder.tsx`, `AudioPlayer.tsx` (controle global via `STOP_ALL_AUDIO_EVENT`)
- `MensagensPadronizadas.tsx`, `MensagensPadronizadasDropdown.tsx`
- `VariableMappingDialog.tsx`, `VariaveisMensagemDropdown.tsx`
- `TakeoverRequestDialog.tsx`, `TakeoverWaitingDialog.tsx` (15s timer)
- `AbrirConversaDialog.tsx`, `NovaConversaDialog.tsx`
- `ResumoConversaDialog.tsx` (Gemini 2.5 Flash)

### Módulo Chat BETA (`src/components/chat-beta/`)
- `ChatBetaFilterSidebar.tsx`, `HistoricoClienteTab.tsx`, `NinaTab.tsx`, `ResumoFichaTab.tsx`, `ResumoIATab.tsx`, `VendasAssistant.tsx`

### Módulo Chat Prestadores (`src/components/prestador-chat/`)
- `ChatWindowPrestadores.tsx`, `ConversationListPrestadores.tsx`, `FichaVinculoSelector.tsx`, `PrestadorInfoPanel.tsx`

### Módulo Calendário (`src/components/calendario/`)
- `CalendarioDiario`, `CalendarioSemanal`, `CalendarioMensal`, `AgendamentoCard`, `AgendamentoDetalhesModal`, `EditarCoresStatusModal`

### Módulo Tarefas
- `tasks/TaskCard.tsx`, `tasks/TaskFormDialog.tsx`, `tasks/TaskAlertModal.tsx`
- `tarefas-op/DelegacaoTab.tsx`, `tarefas-op/DelegacaoFormDialog.tsx`, `tarefas-op/ConversasResolver.tsx`

### Módulo Dashboard TV
- `dashboard/*` widgets, `DashboardLayoutContext`, `TVFreeformContext`, `TVLayoutContext`

### Módulo Financeiro (`src/components/financeiro/`)
- `PagamentoPrestadoresTabV2.tsx`, `EnviarLinkPagamentoDialog.tsx`, `PopupConfirmacaoFinanceira.tsx`, `TrocaPrestadorPagamentoDialog.tsx`
- `ReciboGenerator.tsx`, `PagamentoWebhookLogsViewer.tsx`

### Módulo Mensagens Internas (`src/components/internal-chat/`)
- `InternalChatList.tsx`, `InternalChatWindow.tsx`, `NewInternalChatDialog.tsx`

### IA / Vendas
- `SkillVendasCoach.tsx`, `chat-beta/VendasAssistant.tsx` — sugestões pós-resposta do cliente / 3 min inatividade (Claude Sonnet 4)

### Notificações (sistema anti-stacking, popups silenciosos para webhooks)
- `NotificationSystem.tsx`, `BotSemFichaNotification.tsx`, `OrcamentoNotification.tsx`, `OrcamentosSemFichaNotification.tsx`, `ServicoAtrasadoNotification.tsx`, `FichaSemNomeNotification.tsx`, `AtribuicaoOperadorPopup.tsx`, `TarefaPopupOverlay.tsx`, `TarefaOpPopupOverlay.tsx`, `InternalMessagePopupOverlay.tsx`, `AvisoPopupOverlay.tsx`, `ExitReminderPopup.tsx`, `InactivityWarningModal.tsx`, `PontoEndModal.tsx`

### Componentes de Suporte
- `FichaPanel`, `FichaPanelBeta`, `FichaCard`, `FichaServicoTab`, `FichaHistoricoTab`, `FichaWhatsApp`, `FichaVinculoBadge`, `VincularFichaDialog`, `CriarFichaDialog`
- `BotHistoricoDialog`, `StatusConexaoTwilio`, `TwilioReconcilePanel`
- `AjustarDataFinalizacaoDialog`, `AprovacaoOrcamentoDialog`, `ConfirmReenvioDialog`
- `EditarCoresStatusFichaModal`, `StatusAlertSettings`, `AtribuicaoCadeiaConfig`, `AtribuicaoDescricaoDialog`
- `DescontoField`, `ContactsTab`, `DeleteContactDialog`, `TagManager`, `TemplateManagement`
- `DailyGoalsManager`, `RelatorioTempoStatus`, `OrcamentoTempoKPIs`, `VisitaConversaoKPIs`, `AvaliacaoPrestadorMetricsKPIs`, `AvaliacaoPrestadorFlowPanel`, `NPSMetricsKPIs`, `NPSFlowPanel`
- `FichasOverview`, `FichasDashboard`, `OrcamentosTab`, `AcompanhamentoTab`, `AcompanhamentoConversas`
- `Logo`, `PageLayout`, `ProtectedRoute`, `ErrorBoundary`, `FerramentasManutencao`, `UserManagement`, `AccountInfo`, `PasswordChange`, `PrestadorManagement`, `SystemLogsViewer`, `FilterDropdown`

---

## 6. Contextos React

### `AuthContext.tsx`
- Sessão Supabase, perfil, roles (`isAdmin`, `isAdminTI`)
- Tratamento estável de `SIGNED_OUT` transiente (verifica sessão imediatamente para evitar loop de login)
- Inatividade: 2h com aviso 15 min antes (`useInactivityLogout`)
- `TAB_GRACE_PERIOD` 15s para abas em background

### `VisualModeContext.tsx`
- Preferências visuais por usuário (densidade, dark mode), persistidas em `localStorage`

### `DashboardLayoutContext.tsx`
- Layout dos widgets do Dashboard executivo

### `TVFreeformContext.tsx`
- Posicionamento freeform (drag) dos widgets na TV

### `TVLayoutContext.tsx`
- Configurações persistidas do Dashboard TV (`tv_layouts`)

### `NotificationContext.tsx`
- Fila de notificações com anti-stacking (evita múltiplos popups idênticos)
- Modais silenciosos para webhooks (Asaas, Make)

---

## 7. Hooks Customizados

| Hook | Responsabilidade |
|------|------------------|
| `useConversationTimer` | Timer de conversa parada |
| `useOperationalKPIs` | KPIs (uso `created_at`, “Serviço Agendado” = `Agendado` estrito) |
| `useGoogleAdsMetrics` | Lê `google_ads_metrics` (sync via Make) |
| `useDashboardSummary` / `useDashboardTV` | Agregações para os dashboards |
| `useKPIDrillDown` | Drill-down clicando em KPI |
| `useFichaGrupo` | Agrupamento de fichas relacionadas |
| `useClienteSignalsBeta` | Sinais do cliente para Chat BETA / Coach IA |
| `useExitReminder` | Lembretes ao sair do chat sem responder |
| `useInactivityLogout` | Logout 2h + aviso 15 min |
| `useLogoutRedistribution` | Redistribui chats para próximo na `atribuicao_cadeia` |
| `useOpenInNewTab` | Abrir links em nova aba (default true, configurável por `admin_ti`) |
| `usePontoClock` | Relógio do ponto + estado de turno |
| `useTaskAlert` / `useTaskAuth` / `useVisibleTasks` | Sistema de tarefas |
| `use-mobile` / `use-toast` | Utilitários UI |

---

## 8. Edge Functions (Backend)

Total: **~49 funções**. Política JWT em `supabase/config.toml` — funções públicas (webhooks externos, formulários públicos) marcam `verify_jwt = false`. Funções internas usam JWT por padrão.

### Mensageria WhatsApp / Twilio
| Função | JWT | Propósito |
|--------|-----|-----------|
| `twilio-webhook` | ❌ | Recebe mensagens; identifica `cliente_id` dinamicamente por To/From |
| `twilio-status-callback` | ❌ | Status de delivery |
| `update-message-status` | ❌ | Atualiza status no DB |
| `send-whatsapp` | ❌ | Envia mensagem (texto/mídia) |
| `send-template` | ❌ | Envia template; persiste nome do operador; tokens nomeados (`{{nome}}`) |
| `get-twilio-templates` | ❌ | Lista templates aprovados |
| `transcribe-audio` | ✅ | Transcrição de áudio via Gemini (download de `MediaUrl`) |

### Sincronização / Recuperação de mensagens
| Função | JWT | Propósito |
|--------|-----|-----------|
| `sync-twilio-messages` | ❌ | Pull sync inbound + outbound (janela 15s repair) |
| `sync-twilio-messages-com-recuperacao` | — | Variante com recuperação extra |
| `sync-messages` | ❌ | Sync genérico |
| `recover-message-sids` / `force-recover-message-sids` | ❌ | Repara `message_sid` faltante |
| `recover-prestador-history` | — | Reconstrói histórico do prestador via API Twilio (dedup por `message_sid`) |
| `monitor-mensagens` | — | Monitora gaps de sincronização |
| `compare-messages-count` (legado) | ❌ | Auditoria |
| `reprocess-backup-queue` | ❌ | Reprocessa fila de backup |
| `search-messages` | — | Busca global em mensagens (bypassa RLS) |

### Bot / Atendimento
| Função | JWT | Propósito |
|--------|-----|-----------|
| `check-bot-status` | ❌ | Status atual do bot por cliente |
| `toggle-bot-status` | ❌ | Liga/desliga bot (manual exige “LIGAR”, log em `bot_historico`) |
| `process-bot-reactivation` | ❌ | Reativa bot conforme regras (10 dias Agendado/Visita; 24h demais) |
| `reactivate-bots-24h` | ❌ | Cron de reativação |
| `stop-twilio-flow` | ❌ | Encerra Studio Flow (POST_TurnBotOff) |
| `criar-ficha-do-bot` | ❌ | Substitui hop Studio→Make→Supabase; gera ID `FGM<n>@<YYMMDD>`; auth via `BOT_CRIAR_FICHA_SECRET` |
| `receber-ficha` | ❌ | **Endpoint público** para recebimento externo de fichas (Make/N8N). Auth: header `X-Api-Key` ou `X-Ficha-Secret` = `FICHA_WEBHOOK_SECRET`. Cria `fichas_de_servico` + `pre_qualificacao_bot` |
| `check-unanswered-clients` | ❌ | Cron 30 min: alerta admin (Gemini Flash Lite) sobre clientes sem resposta com bot desligado |
| `vincular-conversa-ficha` | — | Vincula conversa Twilio existente a uma ficha |

### Orçamentos
| Função | JWT | Propósito |
|--------|-----|-----------|
| `submit-orcamento` | ❌ | Recebe orçamento submetido pelo prestador (formulário público) |
| `check-orcamento-forms` | ❌ | Encerra formulários 2h após primeiro orçamento |
| `public-orcamento-data` | ❌ | **Proxy** que devolve dados do orçamento para a página pública (bypassa RLS de forma controlada) |

### Financeiro / Pagamentos
| Função | JWT | Propósito |
|--------|-----|-----------|
| `create-payment-link` | — | Gera link Asaas. Quando `maxInstallmentCount > 1`, força `billingType: 'UNDEFINED'` |
| `processar-pagamento` | ✅ | Processa pagamento confirmado |
| `update-pagamento` | ❌ | Atualiza estado do pagamento |
| `asaas-webhook` | ❌ | Webhook Asaas (PIX/CC/boleto) |
| `auto-finalizacao` | ❌ | Após status “Finalizado” gera link Asaas; após pagamento → status “Garantia” |
| `reconcile-asaas-payments` | — | Reconciliação Asaas |
| `webhook-financeiro` | — | Webhook financeiro genérico (Make) |
| `webhook-update-planilha` | — | Sync com planilhas externas |
| `send-recibo` | — | Envia recibo PDF (anexo dentro da janela 24h Twilio) |

### Tickets / Status
| Função | JWT | Propósito |
|--------|-----|-----------|
| `atualizar-status-ficha` | — | Atualiza status com auditoria |
| `search-ficha-id` | ❌ | Busca ficha por ID (parcial) |
| `clean-description` | ❌ | Sanitização de descrição |

### Bot IA / Vendas / Resumos
| Função | JWT | Propósito |
|--------|-----|-----------|
| `summarize-conversation` | ❌ | Resumo da conversa do dia (Gemini 2.5 Flash, máx 150 msgs) |
| `vendas-assistant` | — | Coach IA (Claude Sonnet 4) |

### Prestadores / Clientes
| Função | JWT | Propósito |
|--------|-----|-----------|
| `upsert-cliente` | — | Upsert por telefone normalizado |
| `update-prestador-idcrm` | — | Sincroniza id CRM |
| `recover-prestador-history` | — | (ver acima) |

### Administrativas
| Função | JWT | Propósito |
|--------|-----|-----------|
| `manage-users` | — | Criação/desativação (`ban_duration` 100 anos) |
| `sync-google-ads` | ❌ | Recebe métricas do Make |
| `twilio-reconcile` | — | Reconciliação Twilio |
| `send-nps` | — | Disparo de NPS |

> ⚠️ Toda função que importa `@supabase/supabase-js` deve usar `npm:@supabase/supabase-js@2`. `supabase/functions/deno.json` precisa ter `nodeModulesDir: auto`.

---

## 9. Modelo de Dados

### Diagrama ER simplificado

```text
clientes ──< mensagens
   │
   └──< fichas_de_servico ──< orcamentos
                │
                ├── pre_qualificacao_bot (1:1)
                ├──< transacoes_financeiras
                ├──< status_logs / ficha_logs
                └──< mensagem_leitura_operador (chat BETA)

prestadores ──< orcamentos
            └──< transacoes_financeiras (split em troca de prestador)

usuarios ──< user_roles
         └──< atribuicao_cadeia (rotação de chats)
         └──< ponto_registros
         └──< tarefas / delegacoes

bot_historico ── auditoria de ligar/desligar bot
google_ads_metrics ── sync via Make
pagamento_webhook_logs / system_logs ── auditoria
```

### Tabelas Principais (resumo)

- **`clientes`** — telefone (normalizado `whatsapp:+...`), nome, dados auxiliares
- **`mensagens`** — `cliente_telefone`, `origem`, `tipo`, `conteudo`, `message_sid`, `created_at`
- **`fichas_de_servico`** — id `text` (formato `FGM<n>@<YYMMDD>`), 16 status, lifecycle automático (Insert→`Ficha Criada`; Finalizado→billing). Campos: `nome_cliente`, `cidade`, `bairro`, `descricao`, `categoria_id`, `preferencia_horario_cliente`, `id_zoho`, `formulario_orcamento_*`, `pagamento_realizado`, `material_pago_24help`, `taxa_visita_padrao_aplicada`, etc.
- **`pre_qualificacao_bot`** ★ — `id uuid`, `ficha_id text FK ON DELETE CASCADE`, `dados jsonb` (informacoes_gerais / detalhes_tecnicos / informacoes_adicionais), `sku_sugerido text`, `confianca_classificacao numeric(3,2)`, `created_at`. Índice em `ficha_id`. RLS aberta para `authenticated`; inserts via `service_role` na `receber-ficha`.
- **`orcamentos`** — vínculo `ficha_id` + `prestador_id`, valores, status (`Aprovado`, `Não Aprovado`, etc.)

### Tabelas Financeiras
- **`transacoes_financeiras`** — receita/despesa. Tipos especiais `prestador_trocado` e `prestador_substituto` para split em troca. Coluna `pagamento_realizado` define receita reconhecida.
- **`asaas_payments` / `pagamento_webhook_logs`** — links e webhooks Asaas
- **Cálculo padrão**: margem 23% → `Total = Subtotal / 0.77`, arredondar para final 8

### Mensagens Internas / Avisos / Tarefas
- **`internal_messages`**, **`internal_chats`**
- **`avisos`**, **`aviso_leituras`**
- **`tarefas`**, **`tarefas_operacionais`**, **`delegacoes`**

### Chat BETA
- **`mensagem_leitura_operador`** ★ — fonte única de leitura: `last_read_at` + `manual_unread`. Helpers em `src/lib/chatBetaUnread.ts`.
- `status_conversa` (enum/texto) — usado nos filtros Chat BETA (default: “Ativas” + “Todas”)

### Dashboard TV / Layout
- **`tv_layouts`**, **`dashboard_metas`**

### Takeover
- **`takeover_requests`** — fluxo 15s timer + AlertDialog

### Avaliação / NPS
- NPS em texto livre dentro de `mensagens` (sem tabela separada — outbound genérico)

### Sincronização
- **`twilio_sync_control`**, **`backup_queue`**

### Sistema / Auditoria
- **`system_logs`**, **`ficha_logs`**, **`bot_historico`**, **`pagamento_webhook_logs`**

### Prestadores
- **`prestadores`** — perfil estendido com `taxa_visita_padrao` (cálculo automático de líquido)

### Usuários / Permissões
- **`user_roles`** (separada de `profiles`) — roles `admin`, `admin_ti`, `operador`, `prestador`
- **`atribuicao_cadeia`** — sequência de redistribuição de chats no logout
- **`ponto_registros`** — entradas/saídas com tolerância 2 min

### Marketing
- **`google_ads_metrics`** — recebido via Make.com

### Funções e Triggers do Banco
- `has_role(_user_id, _role)` — security definer
- `handle_ficha_duplicate_insert` — trigger anti-duplicidade
- `ensure_nome_cliente_preenchido` — fallback “Cliente”
- Trigger lifecycle de status (`Insert` → `Ficha Criada`)

### Enums
- `app_role`, `status_ficha`, `status_conversa`, `tipo_transacao`, `origem_mensagem`

---

## 10. Fluxos de Negócio

### Atendimento principal
1. Cliente envia WhatsApp → Twilio Studio Flow.
2. Bot IA coleta dados (Pré-Qualificação).
3. Studio chama `criar-ficha-do-bot` → cria `fichas_de_servico`.
4. (Alternativo) Sistema externo (Make) chama `receber-ficha` (`X-Api-Key`) → cria ficha + `pre_qualificacao_bot`.
5. Operador assume conversa; takeover requer AlertDialog se outro operador for o “dono” (último a responder).
6. Status evolui pelos 16 estados; “Finalizado” exige **AlertDialog de confirmação** (proteção contra cobrança acidental).

### Recebimento externo de ficha (`receber-ficha`)
- Auth: `X-Api-Key: FICHA_WEBHOOK_SECRET` (ou query `?secret=` ou body).
- Idempotência por `id` da ficha (retorna `already_exists`).
- Cria cliente automaticamente se telefone novo.
- Insere em `pre_qualificacao_bot` (best-effort — falha apenas warning).
- Concatena `1.3 + 1.4 + 2.1..2.4 + 3.3 + 3.4` em `descricao`.

### Janela de Orçamento
- Formulário ativo por 2h após o **primeiro** orçamento enviado, ou até status `Agendado`/`Aprovado`/`Perdido`.
- Cron `check-orcamento-forms` desativa automaticamente.

### Finalização e cobrança
- Status “Finalizado” → `auto-finalizacao` gera link Asaas.
- Pagamento confirmado (`asaas-webhook`) → status `Garantia`.
- Data esperada de pagamento = **2 dias úteis** após o **primeiro** registro `Finalizado` (calendário 2026 hardcoded em `businessDays2026.ts`).

### Cálculo financeiro
- Margem padrão 23%: `Total = Subtotal / 0.77`, arredondar final 8 (ex.: 108).
- Alerta em desconto que faz margem cair abaixo de 23%.
- `material_pago_24help = true` exclui custo de material do líquido do prestador.
- Troca de prestador gera 2 transações (`prestador_trocado` e `prestador_substituto`) para split.

### Janela do Cliente vs Janela do Prestador
- “Janela do Cliente” = comercial.
- “Janela do Prestador” = operacional, sempre em :00 ou :30 (mapeada a partir da janela do cliente).

### Takeover
- Solicitação cria `takeover_requests` + broadcast Realtime.
- Aguarda 15s; sem resposta → automático.
- Confirmação via AlertDialog.

### Redistribuição de chats no logout
- `useLogoutRedistribution` consulta `atribuicao_cadeia` e transfere para o próximo operador online.

### Reativação do Bot
- Status `Agendado`/`Visita`: 10 dias.
- Demais: 24h.
- Cron `reactivate-bots-24h`. Histórico em `bot_historico`. Ligação manual exige digitar “LIGAR”.

### Logout por inatividade
- 2h totais; aviso modal aos 15 min finais (`InactivityWarningModal`).
- `TAB_GRACE_PERIOD` 15s para abas em background.

### Ponto / Turno
- Tolerância 2 min.
- `PontoEndModal` força logout ou registrar hora extra ao final do turno.

### Coach IA de Vendas
- `vendas-assistant` (Claude Sonnet 4).
- Dispara após resposta do cliente ou 3 min de inatividade do operador.

### Alertas administrativos
- Cron 30 min (`check-unanswered-clients`) usa Gemini Flash Lite para detectar clientes sem resposta com bot desligado.
- `BotSemFichaNotification` se bot desligado e nenhuma ficha ativa em 24h.

---

## 11. Integrações Externas

### Twilio (WhatsApp)
- Studio Flow com etapas: `POST_UserMsg` (antes do status check) e `POST_TurnBotOff` (final).
- Templates v2 com tokens nomeados (`{{nome}}`); chaves normalizadas para Twilio.
- Validação de janela de 24h consulta os últimos 20 registros em `mensagens` (NÃO `ultima_interacao`).
- Deduplicação em 3 camadas: ID, `message_sid`, texto+sender em 30s.
- Canal de prestadores **isolado** do canal de clientes (números diferentes; identificação dinâmica em `twilio-webhook`).

### Asaas
- Link de pagamento via `create-payment-link`.
- Quando `maxInstallmentCount > 1`, **forçar `billingType: 'UNDEFINED'`** (para crédito).
- Webhook em `asaas-webhook`.

### Make.com
- Sync Google Ads → POST `sync-google-ads` → tabela `google_ads_metrics`.
- Encaminhamento externo de fichas → `receber-ficha`.
- Atualização de planilhas → `webhook-update-planilha`.

### Lovable AI Gateway
- **Gemini 2.5 Flash** — resumo de conversas (`summarize-conversation`).
- **Gemini Flash Lite** — alerta de mensagens não respondidas.
- **Gemini Pro/Flash** — transcrição de áudio.
- **Claude Sonnet 4** — coach de vendas.

### Links WhatsApp para o cliente
- **SEMPRE path parameters** (`/orcamento/:fichaId`), **NUNCA query params** (truncamento no WhatsApp).

---

## 12. Trocas de Informações

### Entradas externas
- Mensagens WhatsApp (Twilio webhook)
- Status de delivery (Twilio status callback)
- Webhooks Asaas (PIX/cartão/boleto)
- Make: Google Ads, fichas externas, planilhas
- Formulário público de orçamento (proxy via `public-orcamento-data`)

### Saídas externas
- Mensagens WhatsApp (texto/template/áudio/mídia)
- Recibos PDF (`send-recibo` dentro da janela 24h)
- NPS via WhatsApp (`send-nps`)
- Atualização de planilhas (Make)

### Trocas internas
- Realtime: `mensagens`, `orcamentos`, `avisos`, `internal_messages`, `takeover_requests`, `mensagem_leitura_operador`
- Notificações: anti-stacking, popups silenciosos para webhooks
- Broadcast Realtime para takeover

### Storage Buckets
- `chat-files` — anexos de mídia
- `avisos-images` — imagens dos avisos
- `recibos` — PDFs gerados

---

## 13. Utilitários

| Arquivo | Função |
|---------|--------|
| `src/lib/utils.ts` | `cn()` shadcn |
| `src/lib/audioConverter.ts` | OGG/Opus → MP3 (envio Twilio) |
| `src/lib/valorPorExtenso.ts` | Valor monetário por extenso |
| `src/lib/businessDays2026.ts` | Cálculo de dias úteis (calendário 2026 hardcoded) |
| `src/lib/tvSounds.ts` | Sons TV |
| `src/lib/chatBetaUnread.ts` | Helpers de leitura Chat BETA v3 |
| `src/lib/conflitoAgendamentoPrestador.ts` | Conflito de agenda |
| `src/lib/janelaHorarioPrestador.ts` | Mapeamento janela cliente→prestador (:00/:30) |
| `src/lib/calcularEstadoAgendamento.ts` | Estado do agendamento |
| `src/lib/calendarioStatusCores.ts` / `statusFichaCores.ts` | Cores configuráveis |
| `src/lib/financeiroPrestador.ts` | Líquido do prestador |
| `src/lib/asaasLinkValidator.ts` | Validação de link Asaas |
| `src/lib/conversationBookmarks.ts` | Bookmarks de conversa |
| `src/lib/whatsappTemplateVariables.ts` | Variáveis de templates |
| `src/lib/systemLogger.ts` | Logger global |
| `src/lib/taskUtils.ts` | Utilidades de tarefas |
| `src/lib/unreadState.ts` | Estado de não lidas |
| `src/lib/authRedirect.ts` | `PENDING_ROUTE_KEY` / `returnTo` |
| `src/lib/statusAlertConfig.ts` | Config de alertas por status |

### Paginação (regra global)
- Limite Supabase 1000 → usar `fetchAllPaginated` com `.range(from, from+999)`.
- Lookups por ID em lote → chunks de 500.

---

## 14. Autenticação e Autorização

### Autenticação
- Supabase Auth (email + Google OAuth opcional).
- Persistência de destino com `PENDING_ROUTE_KEY` / `returnTo`.
- Inicialização robusta: revalida sessão imediatamente em `SIGNED_OUT` transiente.

### Roles
- `admin` — administradores gerais
- `admin_ti` — gestão de usuários e configurações globais (visibility, navegação)
- `operador` — uso operacional
- `prestador` — portal do prestador (auto-login via CPF; admin acessa via `/admin-prestador`)

Roles armazenadas em **tabela separada `user_roles`** (NUNCA em `profiles`). Função `has_role(uid, role)` é `SECURITY DEFINER`.

### RLS Policies
- **Tabelas operacionais** (mensagens, fichas, orçamentos, transações, etc.): RLS **aberta para `anon`** para suportar webhooks externos.
- **Tabelas internas/sensíveis**: restritas a `authenticated` ou roles específicas.
- Mapa completo em `.lovable/anon-policies-map.md`.

### Desativação de usuário
- `manage-users` aplica `ban_duration` de 100 anos no Supabase Auth (revogação efetiva de tokens).

### Inatividade
- 2h totais; modal de aviso 15 min antes; `TAB_GRACE_PERIOD` 15s.

---

## 15. Sistema de Notificações

- `NotificationContext` + componentes overlay (popups).
- **Anti-stacking**: notificações idênticas são suprimidas se já houver uma ativa.
- **Webhooks silenciosos**: confirmações de Asaas/Make não geram popup intrusivo.
- **Alertas dedicados**:
  - `BotSemFichaNotification` — bot desligado e sem ficha ativa há 24h
  - `OrcamentosSemFichaNotification` — orçamentos sem vínculo
  - `ServicoAtrasadoNotification` — atraso operacional
  - `FichaSemNomeNotification` — ficha sem nome do cliente
  - `AtribuicaoOperadorPopup` — atribuição (popups de atribuição automática estão desativados conforme refinement)
  - `TarefaPopupOverlay` / `TarefaOpPopupOverlay` — alertas de tarefas
  - `InactivityWarningModal` — aviso de logout
  - `PontoEndModal` — fim de turno

---

## 16. Configurações do Sistema

### `/manutencao`
- Aba **Minha Conta** — `AccountInfo`, `PasswordChange`, `AtribuicaoCadeiaConfig`
- Aba **Gerenciar Usuários** (admin) — `UserManagement`
- Aba **Ferramentas** (admin) — `LogsPagamento`, `TwilioReconcilePanel`, `FerramentasManutencao`

### `/settings` (admin)
- Configurações gerais.

### `/visibility-settings` (admin TI)
- Permissões de visualização e regras de UI globais (ex.: `useOpenInNewTab` default).

### `/system-logs` e `/system-logs/:fichaId`
- Visualização do log global e do log por ficha.

### `/logs-pagamento`
- Histórico de webhooks Make/Asaas e criação de links.

### `/pagamentos-orfaos`
- Pagamentos sem ficha vinculada para conciliação manual.

### `/registro-ponto`
- Entrada/saída/intervalo com tolerância 2 min.

### `/admin-prestador`
- Acesso administrativo ao portal do prestador (bypassa middleware estrito; auto-login por CPF).

---

## 17. Troubleshooting

### Mensagens não chegam
- Verificar webhook Twilio apontando para `twilio-webhook`.
- Conferir logs em `system_logs` e Edge Function logs.
- Rodar `sync-twilio-messages` para repair.

### Bot não responde
- Conferir `bot_historico` e `check-bot-status`.
- Studio Flow: confirmar etapa `POST_UserMsg` antes do status check e `POST_TurnBotOff` no final.

### Orçamentos não aparecem na página pública
- Verificar `public-orcamento-data` (proxy RLS).
- Confirmar status do formulário (`formulario_orcamento_ativo`).

### Ficha não criada via `receber-ficha`
- Header `X-Api-Key` deve bater com `FICHA_WEBHOOK_SECRET`.
- `ficha_id` é obrigatório (vem em `FichaDeServicos` no payload).
- Se já existe → resposta `status: already_exists` (idempotente).

### `pre_qualificacao_bot` vazio
- Insert é best-effort (warning, não falha a request principal).
- Conferir Edge Function logs com filtro `aviso pre_qualificacao_bot`.

### Mensagens perdidas
- Cron `monitor-mensagens` + `recover-message-sids`.
- Auditoria em `compare-messages-count`.

### Pagamento não bate
- Conferir `transacoes_financeiras` (`pagamento_realizado`).
- Verificar `pagamento_webhook_logs` e `asaas-webhook`.
- Para crédito > 1x, `billingType` deve ser `UNDEFINED`.

### Status duration vazio
- Relatório usa fallback de `created_at` para “Ficha Criada”.

### Chat BETA com unread incorreto
- Conferir `mensagem_leitura_operador` (`last_read_at` + `manual_unread`).
- Helpers em `src/lib/chatBetaUnread.ts`.

### Dashboard TV não salva layout
- Verificar `tv_layouts` e `TVLayoutContext`.

### Mensagens internas não aparecem
- Confirmar Realtime habilitado em `internal_messages`.

### Login em loop
- `AuthContext` revalida sessão em `SIGNED_OUT` transiente — não forçar logout em handlers próprios.

---

## 18. Notas de Desenvolvimento

### Convenções
- TypeScript estrito.
- Tokens de design semânticos (HSL) — **nunca** cores hardcoded em componentes.
- Componentes pequenos, focados; preferir refatorar a inflar arquivos.

### Padrões de Estado
- React Query para server state.
- Context para sessão/UI globais.
- Realtime Supabase para colaboração ao vivo.

### Persistência de Fichas (regra crítica)
- Salvar com **parâmetros explícitos** (não objetos parciais).
- Bloquear realtime localmente por 2s após save (`skipRealtimeRef`) para impedir que payload do DB sobrescreva inputs em digitação.

### Arquivos Auto-gerados (NÃO EDITAR)
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `.env`
- Project-level em `supabase/config.toml` (apenas blocos de função podem ser adicionados)

### Memória
- Regras de Core ativas (Maio 2026) em `mem://index.md`. Toda lógica de data deve usar **calendário 2026**.

---

## 📚 Referências

- `documentação/changelog31032026.md` — changelog principal
- `documentação/dashboard.md` / `dashboard-tv.md`
- `documentação/chat-beta-leitura.md`
- `documentação/asaas-webhook-pagamentos.md`
- `documentação/checklist-migracao-make.md`
- `documentação/mapeamento-automacoes.md`
- `documentação/2026-03-09-detalhes-usuarios-configuracoes.md`
- `.lovable/anon-policies-map.md`
- `mem://index.md` (memórias persistentes do projeto)
