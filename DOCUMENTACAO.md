# 📘 Documentação Completa - Sistema 24Help

> **Versão**: 2.0  
> **Última atualização**: Março 2026  
> **Propósito**: Sistema de atendimento ao cliente via WhatsApp para serviços residenciais

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

---

## 1. Visão Geral do Sistema

O **24Help** é uma plataforma completa de atendimento ao cliente via WhatsApp, projetada para empresas de serviços residenciais (eletricistas, encanadores, técnicos, etc.).

### Funcionalidades Principais

| Módulo | Descrição |
|--------|-----------|
| **Chat WhatsApp** | Comunicação bidirecional em tempo real com clientes |
| **Bot Automatizado** | Atendimento inicial automatizado via Twilio Studio |
| **Fichas de Serviço** | CRM completo para gestão de ordens de serviço |
| **Orçamentos** | Sistema de cotação com prestadores cadastrados |
| **Dashboard Executivo** | KPIs operacionais e métricas de negócio |
| **Dashboard TV** | Monitor de acompanhamento com widgets freeform arrastáveis |
| **Financeiro** | Gestão financeira completa (transações, adiantamentos, conta corrente) |
| **Mensagens Internas** | Chat interno entre operadores e administradores |
| **Avisos** | Mural de avisos internos com controle de leitura |
| **NPS** | Pesquisa de satisfação pós-serviço (escala 1-5) |
| **Avaliação do Prestador** | Pesquisa de satisfação sobre o prestador |
| **Acompanhamento do Prestador** | Registro de comparecimento do prestador (Foi, Atrasou, Faltou) |
| **Gerenciamento de Prestadores** | Cadastro centralizado e detalhes individuais de prestadores |
| **Análise de Serviços** | Painel analítico de serviços e indicadores |
| **Manutenção** | Ferramentas administrativas (conta, usuários, ferramentas) |
| **Relatórios** | Análises por bairro, prestador e período |
| **Takeover de Conversas** | Sistema de transferência de conversa entre operadores |

### Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (WhatsApp)                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TWILIO (WhatsApp API)                       │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  Studio Flow    │───▶│  Webhooks → Edge Functions          │ │
│  │  (Bot IA)       │    │  • twilio-webhook (recebe msgs)     │ │
│  └─────────────────┘    │  • send-whatsapp (envia msgs)       │ │
│                         │  • twilio-status-callback           │ │
│                         │  • sync-twilio-messages (pull sync) │ │
│                         └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Backend)                            │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  Edge Functions │    │  PostgreSQL Database                │ │
│  │  (Deno Runtime) │───▶│  • clientes, mensagens              │ │
│  │  28 funções     │    │  • fichas_de_servico, orcamentos    │ │
│  └─────────────────┘    │  • transacoes_financeiras           │ │
│                         │  • internal_messages                │ │
│  ┌─────────────────┐    │  • tv_layouts, dashboard_metas      │ │
│  │  Auth           │    │  • avisos, aviso_leituras           │ │
│  │  (JWT + RLS)    │    │  • takeover_requests                │ │
│  └─────────────────┘    │  • twilio_sync_control              │ │
│                         └─────────────────────────────────────┘ │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  Storage        │    │  Realtime                           │ │
│  │  • chat-files   │    │  (mensagens, orçamentos, avisos)    │ │
│  │  • avisos-images│    │                                     │ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Make.com        │ │  Google Ads API  │ │  Lovable AI      │
│  • webhook-      │ │  • sync-google-  │ │  • Gemini 2.5    │
│    financeiro    │ │    ads           │ │  • Resumos       │
│  • submit-       │ │                  │ │  • Limpeza texto │
│    orcamento     │ │                  │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React SPA)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │  Chat    │ │Dashboard │ │Dashboard │ │  Financeiro      │   │
│  │  WhatsApp│ │Executivo │ │   TV     │ │  • Transações    │   │
│  │  + Fichas│ │  + KPIs  │ │ Freeform │ │  • Adiantamentos │   │
│  │  + Bot   │ │  + Funil │ │ Widgets  │ │  • Conta Corrente│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │Mensagens │ │  Avisos  │ │Prestador │ │  Manutenção      │   │
│  │ Internas │ │  Mural   │ │ Gestão   │ │  Ferramentas     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnológica

### Frontend

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| React | 18.3.1 | Framework UI |
| TypeScript | - | Tipagem estática |
| Vite | - | Build tool e dev server |
| Tailwind CSS | - | Estilização utility-first |
| shadcn/ui | - | Componentes UI acessíveis |
| TanStack Query | 5.x | Gerenciamento de estado servidor |
| React Router | 6.x | Roteamento SPA |
| Recharts | 2.x | Gráficos e visualizações |
| Lucide React | 0.462 | Ícones |
| date-fns | 3.x | Manipulação de datas |
| jsPDF | 3.x | Geração de PDFs (recibos) |
| Framer Motion | - | Animações (via Tailwind animate) |
| react-resizable-panels | 2.x | Painéis redimensionáveis |
| lodash-es | 4.x | Utilitários de manipulação de dados |

### Backend (Supabase / Lovable Cloud)

| Componente | Propósito |
|------------|-----------|
| PostgreSQL | Banco de dados relacional |
| Edge Functions (28) | Lógica serverless (Deno runtime) |
| Auth | Autenticação e autorização (JWT + RLS) |
| Storage | Armazenamento de arquivos (chat-files, avisos-images) |
| Realtime | Subscriptions WebSocket |
| RLS Policies | Segurança a nível de linha |
| Database Functions | Funções SQL para lógica de negócio |
| Triggers | Automações no banco de dados |

### Integrações Externas

| Serviço | Propósito |
|---------|-----------|
| Twilio | WhatsApp Business API (envio/recebimento) |
| Twilio Studio | Fluxos de bot automatizado |
| Google Ads API | Métricas de campanhas publicitárias |
| Make.com | Webhooks para automações (orçamentos + financeiro) |
| Lovable AI (Gemini) | IA para resumos e limpeza de texto |

---

## 3. Estrutura de Diretórios

```
24help/
├── public/                          # Arquivos estáticos públicos
│   ├── favicon.ico
│   ├── velhofavicon.ico
│   ├── placeholder.svg
│   └── robots.txt
│
├── src/
│   ├── assets/                      # Imagens e logos
│   │   ├── logo.png
│   │   ├── logo-green.png
│   │   └── logo-24help.png
│   │
│   ├── components/
│   │   ├── dashboard/               # Módulo Dashboard Executivo
│   │   │   ├── index.ts
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── DashboardContent.tsx
│   │   │   ├── DashboardBlockCustomizer.tsx
│   │   │   ├── OperationalKPIsSection.tsx
│   │   │   ├── ConversionRatesSection.tsx
│   │   │   ├── GoogleAdsSection.tsx
│   │   │   ├── ExportReportSection.tsx
│   │   │   ├── KPICard.tsx
│   │   │   ├── KPIFilters.tsx
│   │   │   ├── SectionHeader.tsx
│   │   │   ├── VisualModeSelector.tsx
│   │   │   ├── ConversionFunnel.tsx
│   │   │   ├── charts/
│   │   │   │   ├── index.ts
│   │   │   │   ├── ServicesLineChart.tsx
│   │   │   │   ├── TicketMedioChart.tsx
│   │   │   │   ├── AdsPerformanceChart.tsx
│   │   │   │   └── ROIChart.tsx
│   │   │   └── tv/                  # ★ Módulo Dashboard TV
│   │   │       ├── TVFreeformCanvas.tsx
│   │   │       ├── TVAutoSizeWidget.tsx
│   │   │       ├── TVLayoutCustomizer.tsx
│   │   │       ├── TVWidgetProperties.tsx
│   │   │       ├── TVMonitorSettings.tsx
│   │   │       ├── TVGoalBars.tsx
│   │   │       ├── TVCelebration.tsx
│   │   │       ├── MetaGaugeCard.tsx
│   │   │       ├── MetasModal.tsx
│   │   │       └── MetasResultadosSection.tsx
│   │   │
│   │   ├── financeiro/              # ★ Módulo Financeiro
│   │   │   ├── FinanceiroKPIs.tsx
│   │   │   ├── HistoricoTransacoes.tsx
│   │   │   ├── ContaCorrenteTab.tsx
│   │   │   ├── AdiantamentosTab.tsx
│   │   │   └── NovoAdiantamentoDialog.tsx
│   │   │
│   │   ├── internal-chat/           # ★ Módulo Mensagens Internas
│   │   │   ├── InternalChatList.tsx
│   │   │   ├── InternalChatWindow.tsx
│   │   │   └── NewInternalChatDialog.tsx
│   │   │
│   │   ├── ui/                      # Componentes shadcn/ui (40+)
│   │   │   └── ...
│   │   │
│   │   ├── ChatWindow.tsx
│   │   ├── ConversationList.tsx
│   │   ├── ConversationCard.tsx
│   │   ├── FichaPanel.tsx
│   │   ├── FichaServicoTab.tsx
│   │   ├── FichaCard.tsx
│   │   ├── FichasDashboard.tsx
│   │   ├── FichasOverview.tsx
│   │   ├── OrcamentosTab.tsx
│   │   ├── OrcamentoNotification.tsx
│   │   ├── OrcamentosSemFichaNotification.tsx
│   │   ├── AprovacaoOrcamentoDialog.tsx
│   │   ├── CriarFichaDialog.tsx
│   │   ├── AbrirConversaDialog.tsx
│   │   ├── NovaConversaDialog.tsx
│   │   ├── ResumoConversaDialog.tsx
│   │   ├── BotHistoricoDialog.tsx
│   │   ├── VariableMappingDialog.tsx
│   │   ├── NotificationSystem.tsx
│   │   ├── ServicoAtrasadoNotification.tsx
│   │   ├── TemplateManagement.tsx
│   │   ├── MensagensPadronizadas.tsx
│   │   ├── MensagensPadronizadasDropdown.tsx
│   │   ├── VariaveisMensagemDropdown.tsx
│   │   ├── MessageContextMenu.tsx
│   │   ├── ReplyIndicator.tsx
│   │   ├── AudioPlayer.tsx
│   │   ├── AudioRecorder.tsx
│   │   ├── ReciboGenerator.tsx
│   │   ├── NPSFlowPanel.tsx
│   │   ├── NPSMetricsKPIs.tsx
│   │   ├── OrcamentoTempoKPIs.tsx
│   │   ├── VisitaConversaoKPIs.tsx
│   │   ├── ContactsTab.tsx
│   │   ├── DeleteContactDialog.tsx
│   │   ├── FilterDropdown.tsx
│   │   ├── TagManager.tsx
│   │   ├── StatusConexaoTwilio.tsx
│   │   ├── UserManagement.tsx
│   │   ├── PrestadorManagement.tsx
│   │   ├── PasswordChange.tsx
│   │   ├── AccountInfo.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── Logo.tsx
│   │   ├── AcompanhamentoTab.tsx          # ★ Comparecimento do prestador
│   │   ├── AvaliacaoPrestadorFlowPanel.tsx # ★ Fluxo de avaliação
│   │   ├── AvaliacaoPrestadorMetricsKPIs.tsx # ★ KPIs de avaliação
│   │   ├── FerramentasManutencao.tsx       # ★ Ferramentas admin
│   │   ├── PopupConfirmacaoFinanceira.tsx  # ★ Popup de liquidação financeira
│   │   ├── TakeoverRequestDialog.tsx       # ★ Solicitação de takeover
│   │   └── TakeoverWaitingDialog.tsx       # ★ Aguardando resposta takeover
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   ├── VisualModeContext.tsx
│   │   ├── DashboardLayoutContext.tsx
│   │   ├── TVFreeformContext.tsx           # ★ Layout freeform do TV
│   │   └── TVLayoutContext.tsx             # ★ Configurações gerais TV
│   │
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   ├── use-toast.ts
│   │   ├── useConversationTimer.ts
│   │   ├── useOperationalKPIs.ts
│   │   ├── useGoogleAdsMetrics.ts
│   │   ├── useDashboardSummary.ts
│   │   └── useDashboardTV.ts              # ★ Dados para o Dashboard TV
│   │
│   ├── integrations/supabase/
│   │   ├── client.ts                      # Auto-gerado (NÃO EDITAR)
│   │   └── types.ts                       # Auto-gerado (NÃO EDITAR)
│   │
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── audioConverter.ts
│   │   ├── valorPorExtenso.ts
│   │   ├── businessDays2026.ts            # ★ Cálculo de dias úteis 2026
│   │   └── tvSounds.ts                    # ★ Sons de celebração TV
│   │
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Auth.tsx
│   │   ├── Chat.tsx
│   │   ├── Dashboard.tsx
│   │   ├── DashboardTV.tsx                # ★ Monitor TV
│   │   ├── Settings.tsx
│   │   ├── FichasGeral.tsx
│   │   ├── Financeiro.tsx                 # ★ Hub financeiro
│   │   ├── GerenciamentoPrestadores.tsx   # ★ Gestão de prestadores
│   │   ├── PrestadorDetalhes.tsx          # ★ Detalhes do prestador
│   │   ├── AnaliseServicos.tsx            # ★ Análise de serviços
│   │   ├── Manutencao.tsx                 # ★ Ferramentas de manutenção
│   │   ├── Avisos.tsx                     # ★ Mural de avisos
│   │   ├── MensagensInternas.tsx          # ★ Chat interno
│   │   ├── BairrosReport.tsx
│   │   ├── PrestadoresReport.tsx
│   │   ├── OrcamentoPublico.tsx
│   │   ├── PrestadorPortal.tsx
│   │   └── NotFound.tsx
│   │
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
│
├── supabase/
│   ├── config.toml                        # Auto-gerado (NÃO EDITAR)
│   └── functions/                         # 28 Edge Functions
│       ├── deno.json
│       ├── twilio-webhook/
│       ├── send-whatsapp/
│       ├── send-template/
│       ├── twilio-status-callback/
│       ├── toggle-bot-status/
│       ├── check-bot-status/
│       ├── stop-twilio-flow/
│       ├── process-bot-reactivation/
│       ├── reactivate-bots-24h/
│       ├── submit-orcamento/
│       ├── check-orcamento-forms/
│       ├── summarize-conversation/
│       ├── clean-description/
│       ├── search-ficha-id/
│       ├── get-twilio-templates/
│       ├── manage-users/
│       ├── update-pagamento/
│       ├── update-prestador-idcrm/
│       ├── sync-google-ads/
│       ├── sync-messages/                 # ★ Proxy para sync-twilio
│       ├── sync-twilio-messages/          # ★ Pull sync Twilio
│       ├── sync-twilio-messages-com-recuperacao/ # ★ Sync com recuperação
│       ├── recover-message-sids/          # ★ Recupera SIDs faltantes
│       ├── force-recover-message-sids/    # ★ Força recuperação de SIDs
│       ├── reprocess-backup-queue/        # ★ Reprocessa fila de backup
│       ├── monitor-mensagens/             # ★ Monitoramento de mensagens
│       ├── update-message-status/         # ★ Atualiza status mensagens
│       └── webhook-financeiro/            # ★ Webhook Make.com financeiro
│
├── DOCUMENTACAO.md
├── index.html
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
├── components.json
└── package.json
```

---

## 4. Páginas da Aplicação

### `src/pages/`

| Arquivo | Rota | Acesso | Descrição |
|---------|------|--------|-----------|
| `Home.tsx` | `/` | Autenticado | Hub central com cards de acesso rápido a todos os módulos |
| `Auth.tsx` | `/auth` | Público | Login e signup com email/senha |
| `Chat.tsx` | `/chat` | Autenticado | Interface principal de atendimento WhatsApp |
| `Dashboard.tsx` | `/dashboard` | Autenticado | Dashboard executivo com KPIs e gráficos |
| `DashboardTV.tsx` | `/dashboard-tv` | Autenticado | Monitor TV com widgets freeform arrastáveis |
| `Settings.tsx` | `/settings` | Admin | Configurações do sistema |
| `FichasGeral.tsx` | `/geral` | Autenticado | Visão geral de todas as fichas de serviço |
| `Financeiro.tsx` | `/financeiro` | Autenticado | Hub financeiro (transações, adiantamentos, conta corrente) |
| `GerenciamentoPrestadores.tsx` | `/gerenciamento-prestadores` | Autenticado | Cadastro e listagem centralizada de prestadores |
| `PrestadorDetalhes.tsx` | `/gerenciamento-prestadores/:cpf` | Autenticado | Detalhes individuais do prestador (fichas, avaliações) |
| `AnaliseServicos.tsx` | `/analise-servicos` | Autenticado | Painel analítico de serviços e indicadores |
| `Manutencao.tsx` | `/manutencao` | Autenticado | Minha conta, gerenciar usuários (admin) e ferramentas |
| `Avisos.tsx` | `/avisos` | Autenticado | Mural de avisos com lido/não lido |
| `MensagensInternas.tsx` | `/mensagens` | Autenticado | Chat interno entre operadores |
| `BairrosReport.tsx` | `/bairros` | Autenticado | Relatório de serviços por bairro |
| `PrestadoresReport.tsx` | `/prestadores` | Autenticado | Relatório de desempenho dos prestadores |
| `OrcamentoPublico.tsx` | `/orcamento` | Público | Formulário público para prestadores enviarem orçamentos |
| `PrestadorPortal.tsx` | `/prestador` | Público | Portal self-service para prestadores |
| `NotFound.tsx` | `*` | Público | Página 404 |

### Detalhes das Páginas Principais

#### `Chat.tsx`
A página mais complexa do sistema, responsável por:
- Listar todas as conversas ativas (ConversationList)
- Exibir mensagens em tempo real (ChatWindow)
- Gerenciar fichas de serviço (FichaPanel com 3 abas: Ficha, Acompanhamento, Orçamentos)
- Processar orçamentos
- Controlar o bot automatizado
- Takeover de conversas entre operadores

**Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│  Lista de Conversas  │  Janela de Chat  │  Painel de Fichas    │
│  (ConversationList)  │  (ChatWindow)    │  (FichaPanel)        │
│                      │                  │                       │
│  • Filtros           │  • Mensagens     │  • FichaServicoTab   │
│  • Busca             │  • Input         │  • AcompanhamentoTab │
│  • Cards             │  • Ações         │  • OrcamentosTab     │
└────────────────────────────────────────────────────────────────┘
```

#### `Dashboard.tsx`
Dashboard modular com blocos personalizáveis:
- **KPIs Operacionais**: Fichas criadas, agendamentos, finalizados
- **Funil de Conversão**: Taxas de conversão entre etapas
- **Google Ads**: Métricas de campanhas publicitárias
- **Gráficos**: Evolução temporal de métricas

#### `DashboardTV.tsx`
Monitor de acompanhamento para exibição em TV:
- Canvas freeform com widgets arrastáveis e redimensionáveis
- Presets de layout (grid, foco, minimal)
- Metas diárias e mensais com gauge cards
- Celebração visual+sonora ao atingir metas
- Auto-scale para qualquer resolução de tela
- Salvamento de layouts no banco por usuário (`tv_layouts`)

#### `Financeiro.tsx`
Hub financeiro organizado em abas:
- **Pagamentos do Dia**: Liquidação com atualização em massa de status
- **Histórico de Transações**: Filtros por data/prestador e exportação CSV
- **Adiantamentos**: Rastreamento de pendentes/compensados e criação
- **Conta Corrente**: Extrato por prestador com saldo

#### `Manutencao.tsx`
Ferramentas administrativas em 3 abas:
- **Minha Conta**: Informações e alteração de senha
- **Gerenciar Usuários** (admin): CRUD de usuários com roles
- **Ferramentas** (admin): Ferramentas de manutenção do sistema

---

## 5. Componentes Principais

### Módulo de Chat

#### `ChatWindow.tsx`

**Funcionalidades:**
- Envio/recebimento de mensagens em tempo real (Realtime Supabase)
- Upload de arquivos (imagens, áudio, documentos, vídeos)
- Gravação de áudio nativo
- Reply (responder mensagem específica)
- Controle do bot (ligar/desligar com auditoria)
- Busca dentro do chat
- Atribuição de tickets a operadores
- Notas internas do cliente
- Indicador de janela de 24h do WhatsApp
- Status de entrega das mensagens (enviado/entregue/lido)
- Menu de contexto para ações rápidas

#### `ConversationList.tsx`

**Funcionalidades:**
- Listagem paginada de conversas
- Filtros avançados: status conversa, status ficha, tags, bot, pagamento
- Busca por nome, telefone, ficha, prestador
- Toggle "Meus Tickets" / "Todos"
- Seleção em massa para ações em lote
- Indicadores visuais: não lidas, bot desativado, tempo desde última mensagem

#### `FichaPanel.tsx`

Painel lateral com 3 abas:
1. **Ficha** (`FichaServicoTab`): Dados do cliente, status, agendamento, valores, pagamento
2. **Acompanhamento** (`AcompanhamentoTab`): Comparecimento do prestador (Foi, Atrasou, Faltou)
3. **Orçamentos** (`OrcamentosTab`): Gerenciamento de orçamentos recebidos

#### `FichaServicoTab.tsx`

**Seções:**
1. **Dados do Cliente**: Nome, telefone, CPF, endereço, bairro, cidade
2. **Status do Serviço**: Pipeline visual de status + motivo de perda
3. **Agendamento**: Data/hora visita técnica e serviço
4. **Valores**: Total, mão de obra, peças, tempo estimado
5. **Pagamento**: Tipo, parcelas, status, link
6. **Ações**: Enviar webhook, gerar recibo PDF, enviar NPS, confirmar financeiro

#### `TakeoverRequestDialog.tsx` / `TakeoverWaitingDialog.tsx`

Sistema de takeover de conversas:
- Operador solicita assumir conversa de outro operador
- Operador atual recebe popup com timer de 15s para aprovar/negar
- Se não responder, conversa é transferida automaticamente
- Baseado em realtime via tabela `takeover_requests`

### Módulo Dashboard TV

#### `TVFreeformCanvas.tsx`
Canvas com widgets arrastáveis e redimensionáveis:
- Drag & drop com snap to grid (10px)
- Resize com handles nos 8 cantos/bordas
- Lock de aspect ratio (Shift ou propriedade `locked`)
- Grid overlay no modo de edição
- Scale automático para caber na tela

#### `TVAutoSizeWidget.tsx`
Widget que ajusta automaticamente o tamanho do conteúdo.

#### `TVLayoutCustomizer.tsx`
Painel para customizar quais widgets aparecem, suas posições, e presets.

#### `TVWidgetProperties.tsx`
Propriedades do widget selecionado (posição, tamanho, modo de escala).

#### `TVGoalBars.tsx`
Barras de progresso das metas diárias/mensais.

#### `TVCelebration.tsx`
Animação de celebração quando meta é atingida (com sons via `tvSounds.ts`).

#### `MetaGaugeCard.tsx` / `MetasModal.tsx` / `MetasResultadosSection.tsx`
Configuração e exibição de metas (tabela `dashboard_metas`).

### Módulo Financeiro

#### `PopupConfirmacaoFinanceira.tsx`
Popup de liquidação financeira acionado pelo botão "Confirmar Financeiro" em fichas finalizadas:
- Cálculo automático de margem (23% padrão)
- Arredondamento do valor final para terminar em "8" (via `arredondar_para_8`)
- Data de pagamento do prestador: +2 dias úteis (via `adicionar_dias_uteis`)
- Compensação automática de adiantamentos pendentes
- Busca inline de ficha por ID
- Webhook para Make.com (`MAKE_WEBHOOK_FINANCEIRO`)

#### `FinanceiroKPIs.tsx`
KPIs resumidos do financeiro (volume, margem, tickets pendentes).

#### `HistoricoTransacoes.tsx`
Tabela com histórico de transações, filtros por data/prestador e exportação CSV.

#### `ContaCorrenteTab.tsx`
Extrato de conta corrente por prestador com saldo.

#### `AdiantamentosTab.tsx` / `NovoAdiantamentoDialog.tsx`
Gestão de adiantamentos: listagem, criação e compensação.

### Módulo Mensagens Internas

#### `InternalChatList.tsx`
Lista de conversas internas entre operadores com indicador de não lidas.

#### `InternalChatWindow.tsx`
Janela de chat para conversas internas (texto + arquivos).

#### `NewInternalChatDialog.tsx`
Diálogo para criar nova conversa (1:1 ou grupo).

### Avaliação do Prestador

#### `AvaliacaoPrestadorFlowPanel.tsx`
Painel para enviar avaliação do prestador ao cliente e processar respostas.

#### `AvaliacaoPrestadorMetricsKPIs.tsx`
KPIs e métricas de avaliação dos prestadores.

### Componentes de Suporte

#### `NotificationSystem.tsx`
Sistema de notificações em tempo real para mensagens, orçamentos, serviços atrasados.

#### `TemplateManagement.tsx`
Gerenciamento de templates WhatsApp aprovados do Twilio.

#### `ReciboGenerator.tsx`
Geração de recibos PDF com dados do serviço e valor por extenso.

#### `FerramentasManutencao.tsx`
Ferramentas administrativas do sistema (manutenção, sincronização, etc.).

---

## 6. Contextos React

### `AuthContext.tsx`

Gerencia autenticação e perfil do usuário:

```typescript
interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  userRole: AppRole;
  isAdmin: boolean;
  isSupervisor: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}
```

**Roles:** `admin` (acesso total), `supervisor` (dashboard + relatórios), `user` (chat apenas)

### `VisualModeContext.tsx`

Personalização visual: background, card style, accent color.

### `DashboardLayoutContext.tsx`

Configuração modular do dashboard executivo (blocos, ordem, tamanho). Persistência em `localStorage`.

### `TVFreeformContext.tsx` ★

Layout freeform do Dashboard TV:
- Lista de widgets com posição (x, y), tamanho (width, height), zIndex
- Modo de edição (drag, resize, propriedades)
- Snap to grid
- Presets de layout
- Salvamento/carregamento no banco (`tv_layouts`)
- Modo de escala: fixed (px) ou responsive (%)

### `TVLayoutContext.tsx` ★

Configurações gerais do Dashboard TV (resolução, orientação, auto-refresh).

---

## 7. Hooks Customizados

### `useConversationTimer.ts`
Calcula tempo restante da janela de 24h do WhatsApp para envio de mensagens normais.

### `useOperationalKPIs.ts`
Busca KPIs operacionais (FS criadas, agendamentos, finalizados) com filtros de período.

### `useGoogleAdsMetrics.ts`
Métricas do Google Ads (impressões, cliques, conversões, custo, CTR, CPA).

### `useDashboardSummary.ts`
Resumo geral para o dashboard executivo.

### `useDashboardTV.ts` ★
Dados em tempo real para o Dashboard TV (KPIs, metas, progresso).

### `use-mobile.tsx`
Detecção de dispositivo móvel (`width < 768px`).

### `use-toast.ts`
Sistema de notificações toast (shadcn/ui).

---

## 8. Edge Functions (Backend)

### Funções de Mensageria WhatsApp

#### `twilio-webhook/index.ts`
Recebe mensagens do WhatsApp via Twilio Studio. Cria/atualiza cliente, salva mensagem, atualiza `ultima_interacao`.

#### `send-whatsapp/index.ts`
Envia mensagens para clientes. Verifica janela de 24h antes de enviar.

#### `send-template/index.ts`
Envia templates aprovados do WhatsApp (para quando janela de 24h expirou).

#### `twilio-status-callback/index.ts`
Atualiza status de entrega (queued → sent → delivered → read → failed).

#### `update-message-status/index.ts` ★
Atualiza status de mensagens no banco de dados.

### Funções de Sincronização de Mensagens ★

#### `sync-twilio-messages/index.ts`
Pull sync direto com Twilio API como redundância do webhook. Usa `twilio_sync_control` para rastrear último sync. Processa mídias e evita duplicatas via `message_sid`. Requer `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

#### `sync-twilio-messages-com-recuperacao/index.ts`
Versão com recuperação de falhas (retry logic).

#### `sync-messages/index.ts`
Proxy manual que redireciona para `sync-twilio-messages`. Pode ser acionado via POST externo.

#### `recover-message-sids/index.ts`
Recupera `message_sid` faltantes de mensagens existentes.

#### `force-recover-message-sids/index.ts`
Força recuperação completa de SIDs.

#### `reprocess-backup-queue/index.ts`
Reprocessa mensagens da `mensagens_backup_queue` que falharam anteriormente.

#### `monitor-mensagens/index.ts`
Monitoramento geral do estado das mensagens.

### Funções de Controle do Bot

#### `toggle-bot-status/index.ts`
Liga/desliga bot com auditoria completa em `bot_historico`.

#### `check-bot-status/index.ts`
Verifica se bot está habilitado para um cliente.

#### `stop-twilio-flow/index.ts`
Para execução do fluxo Twilio Studio quando operador assume conversa.

#### `process-bot-reactivation/index.ts`
Processa reativações agendadas do bot (consulta `bot_reactivation_schedule`).

#### `reactivate-bots-24h/index.ts`
**Status:** DESATIVADA. Reativação controlada por trigger `schedule_bot_reactivation`.

### Funções de Orçamento

#### `submit-orcamento/index.ts`
Processa envio de orçamento. Salva em `orcamentos`, envia webhook para Make (assíncrono).

#### `check-orcamento-forms/index.ts`
Fecha formulários de orçamento expirados (>2h após primeiro orçamento).

### Funções de IA

#### `summarize-conversation/index.ts`
Gera resumo da conversa usando Gemini (Lovable AI).

#### `clean-description/index.ts`
Limpa e formata descrição do serviço usando IA.

### Funções Administrativas

#### `manage-users/index.ts`
CRUD de usuários (admin only): listar, criar, atualizar role, deletar.

#### `get-twilio-templates/index.ts`
Lista templates disponíveis no Twilio.

#### `search-ficha-id/index.ts`
Busca ficha por ID (bypassa RLS).

#### `update-pagamento/index.ts`
Atualiza status de pagamento.

#### `update-prestador-idcrm/index.ts`
Atualiza ID CRM do prestador.

#### `sync-google-ads/index.ts`
Sincroniza métricas do Google Ads.

### Funções Financeiras ★

#### `webhook-financeiro/index.ts`
Webhook que envia dados financeiros para Make.com via `MAKE_WEBHOOK_FINANCEIRO`. Após envio, marca transação como sincronizada em `transacoes_financeiras`.

---

## 9. Modelo de Dados

### Diagrama ER Simplificado

```
┌─────────────────┐       ┌─────────────────────┐       ┌────────────────────┐
│    clientes     │───────│  fichas_de_servico  │───────│  transacoes_       │
│  (telefone PK)  │ 1:N   │     (id PK)         │ 1:1   │  financeiras       │
└─────────────────┘       └─────────────────────┘       └────────────────────┘
        │                          │                            │
        │ 1:N                      │ 1:N                        │ 1:N
        ▼                          ▼                            ▼
┌─────────────────┐       ┌─────────────────────┐       ┌────────────────────┐
│   mensagens     │       │    orcamentos       │       │  descontos_ajustes │
│   (id UUID)     │       │    (id UUID)        │       │  (id UUID)         │
└─────────────────┘       └─────────────────────┘       └────────────────────┘
        │                          │
        │ N:1                      │ N:1
        ▼                          ▼
┌─────────────────┐       ┌─────────────────────┐       ┌────────────────────┐
│    profiles     │       │   prestadores       │───────│  conta_corrente_   │
│   (id UUID)     │       │    (cpf PK)         │ 1:N   │  prestador         │
└─────────────────┘       └─────────────────────┘       └────────────────────┘
                                   │
                                   │ 1:N
                                   ▼
                          ┌─────────────────────┐
                          │   adiantamentos     │
                          │   (id UUID)         │
                          └─────────────────────┘

┌────────────────────┐    ┌─────────────────────┐    ┌────────────────────┐
│ internal_          │───│ internal_            │───│ internal_          │
│ conversations      │1:N│ conversation_members │N:1│ messages           │
└────────────────────┘    └─────────────────────┘    └────────────────────┘

┌────────────────────┐    ┌─────────────────────┐
│     avisos         │───│   aviso_leituras    │
│   (id UUID)        │1:N│   (id UUID)         │
└────────────────────┘    └─────────────────────┘
```

### Tabelas Principais

#### `clientes`

```sql
CREATE TABLE clientes (
  telefone TEXT PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT 'Cliente Desconhecido',
  cpf TEXT, endereco TEXT, bairro TEXT, cidade TEXT,
  tags TEXT[] DEFAULT '{}',
  bot_habilitado BOOLEAN DEFAULT true,
  bot_desligado_manualmente BOOLEAN DEFAULT false,
  bot_ja_desligado_alguma_vez BOOLEAN DEFAULT false,
  data_bot_desabilitado TIMESTAMPTZ,
  atendente_id UUID REFERENCES profiles(id),
  ficha_ativa_id TEXT,
  status_conversa status_conversa_enum DEFAULT 'aberta',
  ultima_interacao TIMESTAMPTZ DEFAULT now(),
  marcado_nao_lido BOOLEAN DEFAULT false,
  bot_desativado_notificacao_vista BOOLEAN,
  notas_internas TEXT,
  arquivado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `fichas_de_servico`

```sql
CREATE TABLE fichas_de_servico (
  id TEXT PRIMARY KEY,                -- Ex: "JoaoSilva@20240115"
  telefone_cliente TEXT NOT NULL REFERENCES clientes(telefone),
  nome_cliente TEXT, nome_ficha TEXT, descricao TEXT,
  endereco TEXT, bairro TEXT, cidade TEXT, cpf TEXT,
  categoria_id INTEGER REFERENCES categorias(id),
  prestador_id TEXT REFERENCES prestadores(cpf),
  status status_ficha_enum DEFAULT 'Ficha Criada',
  horario_agendamento TIMESTAMPTZ,
  data_visita_tecnica DATE, horario_visita_tecnica TIMESTAMPTZ,
  preferencia_horario_cliente TEXT,
  valor_total NUMERIC DEFAULT 0, valor_mao_obra NUMERIC DEFAULT 0,
  valor_pecas NUMERIC DEFAULT 0, tempo_servico TEXT,
  pagamento_tipo tipo_pagamento_enum, pagamento_parcelas INTEGER DEFAULT 1,
  pagamento_realizado BOOLEAN DEFAULT false, pagamento_link TEXT,
  pagamento_gerar_link BOOLEAN DEFAULT true, recibo_url TEXT,
  formulario_orcamento_ativo BOOLEAN DEFAULT true,
  formulario_orcamento_data_primeiro_envio TIMESTAMPTZ,
  formulario_orcamento_encerrado_em TIMESTAMPTZ,
  comparecimento_prestador TEXT,     -- ★ "Foi", "Atrasou", "Faltou"
  motivo_perda TEXT, notas TEXT, id_zoho TEXT,
  webhook_pendente BOOLEAN DEFAULT false,
  data_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Status disponíveis (enum `status_ficha_enum`):**
Ficha Criada → Contato Inicial → Dúvida Prestador → Orçamento Enviado → Negociação → Visita Técnica → Orçamento Aprovado / Agendamento → Agendado → Em andamento → Finalizado → Garantia | Perdido | Não foi adiante | Orçamento Não Aprovado | pendente

#### `mensagens`

```sql
CREATE TABLE mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id TEXT NOT NULL REFERENCES clientes(telefone),
  remetente TEXT NOT NULL,            -- 'cliente', 'atendente', 'bot'
  texto TEXT,
  tipo tipo_mensagem_enum DEFAULT 'texto',  -- texto, imagem, audio, video, arquivo
  arquivo_url TEXT,
  message_sid TEXT,                   -- ID da mensagem no Twilio
  status status_mensagem_enum DEFAULT 'enviado', -- enviado, recebido, lido
  status_atualizado_em TIMESTAMPTZ DEFAULT now(),
  reply_to_message_id UUID REFERENCES mensagens(id),
  enviado_por_id UUID REFERENCES profiles(id),
  ficha_id TEXT REFERENCES fichas_de_servico(id),
  data_hora TIMESTAMPTZ DEFAULT now()
);
```

#### `orcamentos`

```sql
CREATE TABLE orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_nome TEXT NOT NULL,
  prestador_cpf TEXT NOT NULL,
  valor_total NUMERIC, valor_mao_obra NUMERIC, valor_pecas NUMERIC,
  tempo_servico TEXT, horario_sugerido TIMESTAMPTZ, pode_horario BOOLEAN,
  observacoes TEXT, categoria TEXT,
  status status_orcamento_enum DEFAULT 'pendente',
  data_criacao TIMESTAMPTZ DEFAULT now()
);
```

#### `prestadores`

```sql
CREATE TABLE prestadores (
  cpf TEXT PRIMARY KEY,
  nome TEXT NOT NULL, telefone TEXT NOT NULL,
  cnpj TEXT, categoria TEXT, especialidade TEXT,
  id_azure TEXT, id_crm TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabelas Financeiras ★

#### `transacoes_financeiras`

```sql
CREATE TABLE transacoes_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id TEXT NOT NULL, prestador_id TEXT NOT NULL, cliente_id TEXT NOT NULL,
  prestador_nome TEXT NOT NULL, prestador_cpf TEXT, prestador_cnpj TEXT,
  prestador_codigo TEXT, cliente_nome TEXT DEFAULT 'Cliente',
  -- Valores
  valor_mao_obra NUMERIC DEFAULT 0, valor_material NUMERIC DEFAULT 0,
  taxa_visita NUMERIC DEFAULT 0,
  adiantamento_cliente NUMERIC DEFAULT 0, adiantamento_prestador NUMERIC DEFAULT 0,
  valor_subtotal NUMERIC DEFAULT 0,
  margem_percentual NUMERIC DEFAULT 23.00,
  valor_cliente_calculado NUMERIC DEFAULT 0, valor_cliente_final NUMERIC DEFAULT 0,
  valor_lucro_bruto NUMERIC DEFAULT 0, margem_operacional_real NUMERIC DEFAULT 0,
  material_pago_24help BOOLEAN DEFAULT false,
  valor_a_pagar_prestador NUMERIC DEFAULT 0,
  -- Datas
  data_contratacao TIMESTAMPTZ, data_execucao TIMESTAMPTZ DEFAULT now(),
  data_pagamento_prevista TIMESTAMPTZ NOT NULL, data_pagamento_realizada TIMESTAMPTZ,
  -- Status
  status_pagamento_cliente TEXT DEFAULT 'pendente',
  status_pagamento_prestador TEXT DEFAULT 'pendente',
  forma_pagamento_cliente TEXT, link_pagamento_asaas TEXT,
  -- Dados bancários
  pix_prestador TEXT, banco_prestador TEXT, agencia_prestador TEXT, conta_prestador TEXT,
  -- Controle
  tem_adiantamento BOOLEAN DEFAULT false, tem_desconto BOOLEAN DEFAULT false,
  criado_por UUID, atualizado_por UUID, aprovado_por UUID, aprovado_em TIMESTAMPTZ,
  sincronizado_sheets BOOLEAN DEFAULT false, sincronizado_em TIMESTAMPTZ,
  sheets_row_id TEXT, categoria TEXT, observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `descontos_ajustes`

```sql
CREATE TABLE descontos_ajustes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transacao_id UUID NOT NULL REFERENCES transacoes_financeiras(id),
  tipo TEXT NOT NULL, motivo TEXT DEFAULT '',
  valor NUMERIC DEFAULT 0, percentual NUMERIC,
  criado_por UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `adiantamentos`

```sql
CREATE TABLE adiantamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id TEXT NOT NULL, ficha_id TEXT,
  valor NUMERIC DEFAULT 0, motivo TEXT,
  status TEXT DEFAULT 'pendente',      -- pendente, compensado
  transacao_id UUID REFERENCES transacoes_financeiras(id),
  data_adiantamento TIMESTAMPTZ DEFAULT now(),
  compensado_em TIMESTAMPTZ,
  criado_por UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `conta_corrente_prestador`

```sql
CREATE TABLE conta_corrente_prestador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id TEXT NOT NULL,
  tipo TEXT NOT NULL, origem TEXT NOT NULL, descricao TEXT DEFAULT '',
  valor NUMERIC DEFAULT 0,
  saldo_anterior NUMERIC DEFAULT 0, saldo_atual NUMERIC DEFAULT 0,
  transacao_id UUID REFERENCES transacoes_financeiras(id),
  adiantamento_id UUID REFERENCES adiantamentos(id),
  data_movimentacao TIMESTAMPTZ DEFAULT now(),
  criado_por UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabelas de Mensagens Internas ★

#### `internal_conversations`

```sql
CREATE TABLE internal_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group BOOLEAN DEFAULT false,
  group_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `internal_conversation_members`

```sql
CREATE TABLE internal_conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES internal_conversations(id),
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ
);
```

#### `internal_messages`

```sql
CREATE TABLE internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES internal_conversations(id),
  sender_id UUID NOT NULL,
  content TEXT, file_url TEXT, file_name TEXT, file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabelas de Avisos ★

#### `avisos`

```sql
CREATE TABLE avisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL, conteudo TEXT NOT NULL,
  imagem_url TEXT, criado_por UUID, criado_por_nome TEXT,
  arquivado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `aviso_leituras`

```sql
CREATE TABLE aviso_leituras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id UUID NOT NULL REFERENCES avisos(id),
  user_id UUID NOT NULL,
  lido_em TIMESTAMPTZ DEFAULT now()
);
```

### Tabelas de Dashboard TV ★

#### `tv_layouts`

```sql
CREATE TABLE tv_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT DEFAULT 'default',
  widgets JSONB DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `dashboard_metas`

```sql
CREATE TABLE dashboard_metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT DEFAULT 'diarias',         -- diarias, mensais
  valor_os NUMERIC DEFAULT 0, lucro_bruto NUMERIC DEFAULT 0,
  ticket_medio NUMERIC DEFAULT 0,
  quantidade_servicos INTEGER DEFAULT 0, quantidade_fs INTEGER DEFAULT 0,
  quantidade_agendados INTEGER DEFAULT 0,
  taxa_fs_agendado NUMERIC DEFAULT 0, taxa_agendado_pago NUMERIC DEFAULT 0,
  taxa_conversao_total NUMERIC DEFAULT 0,
  tempo_resposta_max INTEGER DEFAULT 60, tempo_orcamento_max INTEGER DEFAULT 120,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabelas de Takeover ★

#### `takeover_requests`

```sql
CREATE TABLE takeover_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_cliente TEXT NOT NULL,
  solicitante_id UUID NOT NULL, solicitante_nome TEXT NOT NULL,
  operador_atual_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',       -- pending, approved, denied, timeout
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabelas de Avaliação ★

#### `avaliacao_prestador`

```sql
CREATE TABLE avaliacao_prestador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id TEXT NOT NULL, telefone_cliente TEXT NOT NULL,
  prestador_id TEXT, operador_id UUID,
  nota INTEGER,                        -- 1-5
  classificacao TEXT,                  -- positivo, neutro, critico
  feedback TEXT, tipo_feedback TEXT,
  enviado_em TIMESTAMPTZ DEFAULT now(),
  respondido_em TIMESTAMPTZ, feedback_respondido_em TIMESTAMPTZ,
  prioridade BOOLEAN DEFAULT false, supervisor_alertado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabelas de NPS

#### `nps_respostas`

Mesma estrutura de `avaliacao_prestador` (nota 1-5, classificação positivo/neutro/crítico).

**Regra de classificação (escala 1-5):** 1-2: crítico | 3: neutro | 4-5: positivo

### Tabelas de Sincronização ★

#### `twilio_sync_control`

```sql
CREATE TABLE twilio_sync_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_sync_timestamp TIMESTAMPTZ DEFAULT now(),
  last_message_sid TEXT,
  messages_found INTEGER DEFAULT 0, messages_new INTEGER DEFAULT 0,
  messages_already_exist INTEGER DEFAULT 0, errors INTEGER DEFAULT 0,
  sync_in_progress BOOLEAN DEFAULT false, sync_started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `mensagens_backup_queue`

```sql
CREATE TABLE mensagens_backup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id TEXT NOT NULL, message_sid TEXT,
  payload JSONB NOT NULL,
  tentativas INTEGER DEFAULT 0, processado BOOLEAN DEFAULT false,
  erro_ultimo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `mensagens_backup_27fev`
Tabela de backup histórico de mensagens (snapshot de 27/fev). Mesma estrutura de `mensagens`.

### Tabelas de Suporte

#### `profiles`, `user_roles`, `tags`, `categorias`, `mensagens_padronizadas`, `whatsapp_templates`, `bot_historico`, `bot_reactivation_schedule`, `ficha_status_historico`, `google_ads_metrics`, `configuracoes`, `webhook_debug_logs`

(Mantidas da v1.0 — ver seções anteriores do histórico)

### Funções do Banco de Dados

| Função | Propósito |
|--------|-----------|
| `has_role(_user_id, _role)` | Verifica se usuário tem determinada role (SECURITY DEFINER) |
| `is_internal_conversation_member(_conversation_id, _user_id)` | Verifica se usuário é membro de conversa interna |
| `calculate_conversas_iniciadas(p_from_date, p_to_date, ...)` | Calcula conversas iniciadas no período |
| `adicionar_dias_uteis(data_base, dias)` | Adiciona N dias úteis a uma data |
| `arredondar_para_8(valor)` | Arredonda valor para terminar em "8" (ex: 123 → 128) |

### Enums

| Enum | Valores |
|------|---------|
| `app_role` | admin, user, supervisor |
| `status_conversa_enum` | aberta, fechada |
| `status_ficha_enum` | Ficha Criada, Contato Inicial, Dúvida Prestador, Orçamento Enviado, Negociação, Visita Técnica, Orçamento Aprovado / Agendamento, Orçamento Não Aprovado, Agendado, Em andamento, Finalizado, Garantia, Perdido, Não foi adiante, pendente |
| `status_mensagem_enum` | enviado, recebido, lido |
| `status_orcamento_enum` | pendente, aprovado, rejeitado |
| `tipo_mensagem_enum` | texto, arquivo, imagem, video, audio |
| `tipo_pagamento_enum` | dinheiro, cartao_credito, cartao_debito, pix, boleto, transferencia |

---

## 10. Fluxos de Negócio

### Fluxo de Atendimento Principal

```
1. CLIENTE ENVIA MENSAGEM
   WhatsApp → Twilio → twilio-webhook → salva em mensagens + atualiza cliente

2. BOT PROCESSA (se habilitado)
   Twilio Studio Flow → coleta informações → responde perguntas → encaminha

3. OPERADOR ASSUME CONVERSA
   toggle-bot-status → desliga bot → atribui operador ao cliente

4. CRIAÇÃO DA FICHA DE SERVIÇO
   CriarFichaDialog → FichaServicoTab → preenche dados e categoria

5. SOLICITAÇÃO DE ORÇAMENTOS
   Template WhatsApp → prestadores acessam /orcamento → formulário fecha após 2h

6. RECEBIMENTO E APROVAÇÃO DE ORÇAMENTOS
   OrcamentosTab → compara → AprovacaoOrcamentoDialog → atribui prestador

7. AGENDAMENTO DO SERVIÇO
   FichaServicoTab → define data/hora → status "Agendado" → agenda reativação bot (10 dias)

8. EXECUÇÃO DO SERVIÇO
   Status "Em andamento" → acompanhamento via chat

9. FINALIZAÇÃO E PAGAMENTO
   Status "Finalizado" → pagamento → recibo PDF → reativação bot (10 dias)

10. CONFIRMAÇÃO FINANCEIRA ★
    PopupConfirmacaoFinanceira → cálculo de margem → transação financeira → webhook Make

11. PESQUISA NPS / AVALIAÇÃO
    Envia template → cliente responde 1-5 → classificação automática

12. ACOMPANHAMENTO DO PRESTADOR ★
    AcompanhamentoTab → registra comparecimento (Foi, Atrasou, Faltou)
```

### Fluxo de Controle do Bot

```
NOVO CLIENTE → bot_habilitado = true → Bot responde automaticamente

OPERADOR ASSUME → toggle-bot-status → bot_habilitado = false

MUDANÇA DE STATUS DA FICHA → Trigger: schedule_bot_reactivation
  • Status 'Perdido' → reativação em 24 HORAS
  • Outros status → reativação em 10 DIAS

REATIVAÇÃO → process-bot-reactivation → bot_habilitado = true
```

### Fluxo Financeiro ★

```
1. Ficha em "Finalizado" ou "Em andamento" com prestador atribuído
2. Operador clica "Confirmar Financeiro" → PopupConfirmacaoFinanceira
3. Preenchimento:
   • Mão de obra + material + taxa de visita
   • Adiantamentos (cliente e/ou prestador)
   • Margem automática: 23%
   • Valor final arredondado para terminar em "8" (arredondar_para_8)
   • Data pagamento prestador: +2 dias úteis (adicionar_dias_uteis)
4. Ao confirmar:
   • Cria registro em transacoes_financeiras
   • Compensa adiantamentos pendentes automaticamente
   • Registra movimentações em conta_corrente_prestador
   • Envia webhook para Make.com (webhook-financeiro)
```

### Fluxo de Takeover ★

```
1. Operador A solicita assumir conversa que está com Operador B
2. Cria registro em takeover_requests (status: pending)
3. Operador B recebe TakeoverRequestDialog com timer de 15s
4. Se Operador B aprova → status: approved → conversa transferida
5. Se Operador B nega → status: denied → nada acontece
6. Se timeout (15s) → status: timeout → conversa transferida automaticamente
```

### Fluxo de Sincronização de Mensagens ★

```
CAMINHO PRINCIPAL (Push):
  WhatsApp → Twilio → twilio-webhook → salva em mensagens

REDUNDÂNCIA (Pull):
  sync-twilio-messages → Twilio API → compara com banco → insere novas
  • Controlado por twilio_sync_control (último timestamp, último SID)
  • Pode ser acionado manualmente via sync-messages

RECUPERAÇÃO DE FALHAS:
  • mensagens_backup_queue: fila de mensagens que falharam
  • reprocess-backup-queue: reprocessa a fila periodicamente
  • recover-message-sids: recupera SIDs faltantes
  • force-recover-message-sids: força recuperação completa
```

---

## 11. Integrações Externas

### Twilio

**Serviços utilizados:**
- **WhatsApp Business API**: Envio e recebimento de mensagens
- **Twilio Studio**: Fluxos de bot automatizado
- **Content Templates**: Templates aprovados pelo WhatsApp

**Variáveis de ambiente:**
- `TWILIO_ACCOUNT_SID`: ID da conta Twilio
- `TWILIO_AUTH_TOKEN`: Token de autenticação
- `TWILIO_PHONE_NUMBER`: Número WhatsApp Business
- `TWILIO_FLOW_SID`: ID do fluxo Studio

**Webhooks configurados:**
- Incoming Messages → `twilio-webhook`
- Status Callbacks → `twilio-status-callback`

**Pull Sync (redundância):**
- `sync-twilio-messages` consulta Twilio API periodicamente
- Usa `twilio_sync_control` para rastrear estado do sync

### Google Ads

- Edge function `sync-google-ads` sincroniza métricas periodicamente
- Dados salvos em `google_ads_metrics`
- Dashboard exibe métricas agregadas (impressões, cliques, conversões, custo, CTR, CPA)

### Make.com

**Webhooks de saída:**
1. **Orçamentos**: `submit-orcamento` envia novo orçamento para Make
2. **Financeiro** ★: `webhook-financeiro` envia dados de transações financeiras
   - Variável: `MAKE_WEBHOOK_FINANCEIRO`
   - Payload: dados da transação + prestador + cliente
   - Marca `sincronizado_sheets = true` após envio

**Configuração:**
- URLs de webhook configuradas via secrets do projeto
- Chamadas assíncronas com `EdgeRuntime.waitUntil`

### Lovable AI (Gemini)

**Funções que usam IA:**
- `summarize-conversation`: Resumo de conversas
- `clean-description`: Limpeza e formatação de descrições

**Modelo utilizado:** `google/gemini-2.5-flash`

---

## 12. Trocas de Informações ★

### Entradas Externas (dados que entram no sistema)

| Origem | Destino | Mecanismo | Descrição |
|--------|---------|-----------|-----------|
| WhatsApp (cliente) | `mensagens` | Twilio webhook → `twilio-webhook` | Mensagens recebidas de clientes |
| WhatsApp (status) | `mensagens.status` | Twilio callback → `twilio-status-callback` | Status de entrega (sent/delivered/read) |
| Twilio API | `mensagens` | `sync-twilio-messages` (pull) | Redundância para mensagens perdidas |
| Formulário público | `orcamentos` | `submit-orcamento` | Prestadores enviam orçamentos via `/orcamento` |
| Portal prestador | `prestadores` | `/prestador` → Supabase direto | Self-service de dados do prestador |
| Google Ads API | `google_ads_metrics` | `sync-google-ads` | Métricas de campanhas |

### Saídas Externas (dados que saem do sistema)

| Origem | Destino | Mecanismo | Descrição |
|--------|---------|-----------|-----------|
| `mensagens` | WhatsApp (cliente) | `send-whatsapp` → Twilio API | Mensagens enviadas por operadores |
| Templates | WhatsApp (cliente) | `send-template` → Twilio API | Templates aprovados (NPS, orçamento) |
| `orcamentos` | Make.com | `submit-orcamento` → webhook | Notificação de novo orçamento |
| `transacoes_financeiras` | Make.com | `webhook-financeiro` → webhook | Dados financeiros para planilhas |
| Bot | Twilio Studio | `stop-twilio-flow` | Para o fluxo do bot |

### Trocas Internas (comunicação dentro do sistema)

| Tipo | Mecanismo | Tabelas envolvidas |
|------|-----------|-------------------|
| Mensagens em tempo real | Supabase Realtime (postgres_changes) | `mensagens` |
| Orçamentos em tempo real | Supabase Realtime | `orcamentos` |
| Avisos em tempo real | Supabase Realtime | `avisos` |
| Takeover de conversas | Supabase Realtime | `takeover_requests` |
| Mensagens internas | Supabase Realtime | `internal_messages` |
| Histórico de status | Trigger `track_ficha_status_changes` | `ficha_status_historico` |
| Reativação do bot | Trigger `schedule_bot_reactivation` | `bot_reactivation_schedule` |
| Primeiro orçamento | Trigger `mark_first_orcamento` | `fichas_de_servico` |
| Segurança de dados | RLS Policies por role (has_role) | Todas as tabelas |
| Membros de chat interno | Function `is_internal_conversation_member` | `internal_conversation_members` |

### Storage Buckets

| Bucket | Conteúdo | Acesso |
|--------|----------|--------|
| `chat-files` | Arquivos de chat (imagens, áudio, documentos, vídeos) | Autenticado |
| `avisos-images` | Imagens dos avisos internos | Autenticado |

---

## 13. Utilitários

### `src/lib/utils.ts`
Merge de classes Tailwind (`cn`) e formatações gerais.

### `src/lib/audioConverter.ts`
Conversão de áudio para formato compatível com WhatsApp (OGG/Opus).

### `src/lib/valorPorExtenso.ts`
Converte valores numéricos para texto (usado em recibos).

### `src/lib/businessDays2026.ts` ★
Cálculo de dias úteis para 2026, considerando feriados brasileiros. Usado pelo financeiro para calcular data de pagamento do prestador.

### `src/lib/tvSounds.ts` ★
Sons de celebração para o Dashboard TV quando metas são atingidas.

---

## 14. Autenticação e Autorização

### Sistema de Autenticação
- **Provider**: Supabase Auth (Lovable Cloud)
- **Método**: Email/Senha
- **Verificação**: Email (confirmação obrigatória)

### Roles e Permissões

| Role | Chat | Dashboard | Dashboard TV | Financeiro | Settings | Relatórios | Manutenção |
|------|------|-----------|-------------|------------|----------|------------|------------|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (completo) |
| `supervisor` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | Parcial |
| `user` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Parcial |

### RLS Policies

Todas as tabelas possuem Row Level Security habilitado. Políticas baseadas em roles via função `has_role()` (SECURITY DEFINER para evitar recursão).

**Padrão geral:**
- Tabelas operacionais (mensagens, fichas, clientes): acesso para todos os autenticados
- Tabelas administrativas (configuracoes, dashboard_metas): acesso restrito a admin/supervisor
- Tabelas pessoais (tv_layouts, aviso_leituras): acesso apenas ao próprio usuário
- Mensagens internas: acesso via `is_internal_conversation_member()`

---

## 15. Sistema de Notificações

| Tipo | Componente | Trigger |
|------|------------|---------|
| Nova mensagem | `NotificationSystem` | Realtime em `mensagens` |
| Orçamento recebido | `OrcamentoNotification` | Insert em `orcamentos` |
| Orçamento sem ficha | `OrcamentosSemFichaNotification` | Query periódica |
| Serviço atrasado | `ServicoAtrasadoNotification` | Query periódica |
| Bot desativado | Badge visual | `bot_habilitado = false` |
| Avisos não lidos | Badge na Home | Contagem `avisos - aviso_leituras` |
| Takeover | `TakeoverRequestDialog` | Realtime em `takeover_requests` |

---

## 16. Configurações do Sistema

### Página de Settings (`/settings`) — Admin only

1. **Twilio**: Status da conexão, teste de envio
2. **Templates**: Gerenciamento de templates WhatsApp + mapeamento de variáveis
3. **Mensagens Padronizadas**: CRUD de respostas rápidas organizadas por tags
4. **Tags**: Gerenciamento de tags para clientes (cores personalizadas)

### Página de Manutenção (`/manutencao`)

1. **Minha Conta**: Informações do usuário + alteração de senha
2. **Gerenciar Usuários** (admin): CRUD de usuários + atribuição de roles
3. **Ferramentas** (admin): Ferramentas administrativas do sistema

---

## 17. Troubleshooting

### Mensagens não chegam
1. Verificar conexão Twilio (Settings → Twilio)
2. Checar logs do `twilio-webhook`
3. Verificar se o fluxo Studio está passando pelo widget correto
4. Verificar `twilio_sync_control` para status do pull sync

### Bot não responde
1. Verificar `bot_habilitado` do cliente
2. Checar `bot_historico` para entender desativações
3. Verificar `bot_reactivation_schedule` para reativações pendentes
4. Verificar fluxo no Twilio Studio

### Orçamentos não aparecem
1. Verificar se `formulario_orcamento_ativo = true`
2. Checar se o prestador está cadastrado corretamente
3. Verificar logs do `submit-orcamento`

### Mensagens perdidas ★
1. Verificar `mensagens_backup_queue` para mensagens na fila
2. Executar `reprocess-backup-queue` para reprocessar falhas
3. Executar `sync-twilio-messages` para pull sync manual
4. Verificar `twilio_sync_control` para estado do último sync

### Financeiro não calcula corretamente ★
1. Verificar se a ficha tem prestador atribuído
2. Checar se a função `arredondar_para_8` retorna valor correto
3. Verificar adiantamentos pendentes do prestador
4. Checar logs do `webhook-financeiro` para erros de sincronização

### Dashboard TV não salva layout ★
1. Verificar se o usuário está autenticado
2. Checar RLS policies da tabela `tv_layouts` (acesso apenas ao próprio user_id)
3. Verificar se o layout está sendo serializado corretamente (JSONB)

### Mensagens internas não aparecem ★
1. Verificar se o usuário é membro da conversa (`internal_conversation_members`)
2. Checar função `is_internal_conversation_member`
3. Verificar Realtime subscription para `internal_messages`

---

## 📝 Notas de Desenvolvimento

### Convenções de Código
- **Componentes**: PascalCase (`ChatWindow.tsx`)
- **Hooks**: camelCase com prefixo `use` (`useOperationalKPIs.ts`)
- **Funções utilitárias**: camelCase (`formatPhone()`)
- **Constantes**: UPPER_SNAKE_CASE (`STORAGE_KEY`)

### Padrões de Estado
- **Estado do servidor**: TanStack Query
- **Estado local**: useState
- **Estado global**: Context API
- **Persistência**: localStorage (preferências de layout), banco de dados (tv_layouts, dashboard_metas)

### Arquivos Auto-gerados (NÃO EDITAR)
- `supabase/config.toml`
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `.env`

---

## 📚 Referências

- [Documentação Supabase](https://supabase.com/docs)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)
- [shadcn/ui](https://ui.shadcn.com)
- [TanStack Query](https://tanstack.com/query)
- [Tailwind CSS](https://tailwindcss.com)

---

## 📋 Changelog — 31/03/2026

### Correções aplicadas

1. **Bug de data de pagamento prevista (crítico)**: O sistema calculava a data de pagamento do prestador a partir da data atual (`new Date()`) em vez da data real de finalização do serviço (obtida de `ficha_status_historico`). Isso causava datas de pagamento incorretas quando a confirmação financeira era feita dias após a finalização. Corrigido em:
   - `PopupConfirmacaoFinanceira.tsx` — busca `data_inicio` do histórico de status "Finalizado"
   - `PagamentoPrestadoresTab.tsx` — mesmo fix para marcação rápida de pagamento
   - `TrocaPrestadorPagamentoDialog.tsx` — mesmo fix para troca de prestador com pagamento

2. **Dados corrigidos**: `FS11-260316` tinha `data_pagamento_prevista` = 31/03 (errado), corrigido para 27/03 (2 dias úteis após finalização em 25/03).

3. **Formulário público de orçamento**: Corrigido erro "Ficha não encontrada" causado por queries diretas bloqueadas por RLS. Criada Edge Function `public-orcamento-data` como proxy seguro usando `service_role`.

4. **Bot reativação 24h**: Corrigido `reactivate-bots-24h` para processar corretamente agendamentos pendentes da tabela `bot_reactivation_schedule`.

### Regra de negócio reforçada

- **Data de pagamento ao prestador**: Sempre calculada como 2 dias úteis após a **data real de finalização** do serviço (campo `data_inicio` do registro "Finalizado" em `ficha_status_historico`), nunca a partir do momento da confirmação financeira.

---

*Documentação atualizada em 31/03/2026 — v2.1*
