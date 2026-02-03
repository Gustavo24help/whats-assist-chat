
# Plano: Documentação Completa do Sistema 24Help

## Objetivo
Criar um arquivo de documentação abrangente que descreva a arquitetura, funcionalidades, localização de arquivos e operação do sistema de atendimento 24Help.

## Estrutura do Documento

O documento será organizado nas seguintes seções:

### 1. Visão Geral do Sistema
- Descrição do propósito (sistema de atendimento via WhatsApp)
- Stack tecnológica (React, Vite, TypeScript, Tailwind CSS, Supabase)
- Arquitetura geral (frontend SPA + backend serverless)

### 2. Estrutura de Diretórios
```text
src/
├── assets/          # Logos e imagens estáticas
├── components/      # Componentes React reutilizáveis
│   ├── dashboard/   # Componentes do Dashboard Executivo
│   └── ui/          # Componentes UI (shadcn/ui)
├── contexts/        # Contextos React (Auth, Visual Mode, Dashboard Layout)
├── hooks/           # Hooks customizados
├── integrations/    # Integrações (Supabase client)
├── lib/             # Utilitários e helpers
└── pages/           # Páginas da aplicação

supabase/
└── functions/       # Edge Functions (backend serverless)
```

### 3. Páginas da Aplicação (src/pages/)

| Arquivo | Rota | Descrição |
|---------|------|-----------|
| `Home.tsx` | `/` | Página inicial com acesso ao Chat e Dashboard |
| `Chat.tsx` | `/chat` | Interface principal de atendimento WhatsApp |
| `Dashboard.tsx` | `/dashboard` | Dashboard executivo com KPIs e métricas |
| `FichasGeral.tsx` | `/geral` | Visão geral de todas as fichas de serviço |
| `Settings.tsx` | `/settings` | Configurações do sistema (Twilio, usuários, webhooks) |
| `Auth.tsx` | `/auth` | Login e autenticação |
| `OrcamentoPublico.tsx` | `/orcamento` | Formulário público para prestadores enviarem orçamentos |
| `PrestadorPortal.tsx` | `/prestador` | Portal self-service para prestadores |
| `BairrosReport.tsx` | `/bairros` | Relatório de serviços por bairro |
| `PrestadoresReport.tsx` | `/prestadores` | Relatório de desempenho dos prestadores |

### 4. Componentes Principais

#### Módulo de Chat
- `ChatWindow.tsx` - Janela de conversa com cliente (2000+ linhas)
  - Envio/recebimento de mensagens em tempo real
  - Upload de arquivos (imagens, áudio, documentos)
  - Gravação de áudio
  - Reply (responder mensagem específica)
  - Controle do bot (ligar/desligar)
  - Busca no chat
  - Atribuição de tickets a operadores
  - Notas internas do cliente
  
- `ConversationList.tsx` - Lista de conversas (1300+ linhas)
  - Filtros avançados (status, tags, bot, pagamento)
  - Busca por nome, ficha, prestador, ID
  - Toggle Meus Tickets/Todos
  - Seleção em massa
  - Indicadores de não-lido e bot desativado

- `FichaPanel.tsx` - Painel lateral de fichas de serviço
- `FichaServicoTab.tsx` - Detalhes completos da ficha (1450+ linhas)
  - Dados do cliente
  - Status do serviço
  - Agendamento
  - Valores e pagamento
  - Webhook automático
  
- `OrcamentosTab.tsx` - Gerenciamento de orçamentos recebidos

#### Módulo Dashboard
- `DashboardContent.tsx` - Orquestrador de blocos do dashboard
- `OperationalKPIsSection.tsx` - Métricas operacionais
- `ConversionRatesSection.tsx` - Taxas de conversão do funil
- `GoogleAdsSection.tsx` - Métricas do Google Ads
- `DashboardBlockCustomizer.tsx` - Personalização de layout
- Gráficos: `ServicesLineChart`, `TicketMedioChart`, `ROIChart`, etc.

#### Componentes de Suporte
- `NotificationSystem.tsx` - Notificações em tempo real
- `TemplateManagement.tsx` - Gerenciamento de templates WhatsApp
- `MensagensPadronizadas.tsx` - Mensagens rápidas pré-definidas
- `ReciboGenerator.tsx` - Geração de recibos PDF
- `NPSFlowPanel.tsx` - Fluxo de pesquisa NPS

### 5. Contextos React (src/contexts/)

| Contexto | Arquivo | Propósito |
|----------|---------|-----------|
| `AuthContext` | `AuthContext.tsx` | Gerencia autenticação, perfil do usuário e roles (admin/supervisor/user) |
| `VisualModeContext` | `VisualModeContext.tsx` | Personalização visual (backgrounds, cards, acentos) |
| `DashboardLayoutContext` | `DashboardLayoutContext.tsx` | Layout modular do dashboard (blocos habilitados e ordem) |

### 6. Hooks Customizados (src/hooks/)

| Hook | Arquivo | Propósito |
|------|---------|-----------|
| `useConversationTimer` | `useConversationTimer.ts` | Calcula tempo restante da janela de 24h do WhatsApp |
| `useOperationalKPIs` | `useOperationalKPIs.ts` | Busca KPIs operacionais com filtros de período |
| `useGoogleAdsMetrics` | `useGoogleAdsMetrics.ts` | Métricas do Google Ads |
| `useDashboardSummary` | `useDashboardSummary.ts` | Resumo do dashboard |
| `use-mobile` | `use-mobile.tsx` | Detecta se é dispositivo móvel |
| `use-toast` | `use-toast.ts` | Sistema de notificações toast |

### 7. Edge Functions (supabase/functions/)

| Função | Propósito |
|--------|-----------|
| `twilio-webhook` | Recebe mensagens do WhatsApp via Twilio Studio |
| `send-whatsapp` | Envia mensagens para clientes (com verificação de janela 24h) |
| `send-template` | Envia templates aprovados do WhatsApp |
| `twilio-status-callback` | Atualiza status de entrega das mensagens |
| `toggle-bot-status` | Liga/desliga bot para um cliente (com auditoria) |
| `check-bot-status` | Verifica se bot está habilitado |
| `stop-twilio-flow` | Para execução do fluxo Twilio Studio |
| `process-bot-reactivation` | Processa reativação agendada do bot |
| `reactivate-bots-24h` | Job que reativa bots após período definido |
| `submit-orcamento` | Processa envio de orçamento (webhook Make) |
| `check-orcamento-forms` | Verifica formulários de orçamento expirados |
| `summarize-conversation` | Gera resumo da conversa com IA (Gemini) |
| `clean-description` | Limpa descrição do serviço com IA |
| `search-ficha-id` | Busca ficha por ID (bypassa RLS) |
| `get-twilio-templates` | Lista templates disponíveis no Twilio |
| `manage-users` | CRUD de usuários (admin) |
| `update-pagamento` | Atualiza status de pagamento |
| `update-prestador-idcrm` | Atualiza ID CRM do prestador |
| `sync-google-ads` | Sincroniza métricas do Google Ads |

### 8. Modelo de Dados (Tabelas Principais)

```text
clientes
├── telefone (PK) - Número WhatsApp
├── nome
├── tags[]
├── bot_habilitado
├── atendente_id
├── ficha_ativa_id
└── ...

fichas_de_servico
├── id (PK) - Ex: "NomeCliente@20240101"
├── telefone_cliente (FK)
├── status (enum: Ficha Criada → Agendado → Finalizado...)
├── prestador_id (CPF)
├── valores (total, mao_obra, pecas)
├── horario_agendamento
├── pagamento_*
└── ...

mensagens
├── id (UUID)
├── cliente_id (telefone)
├── remetente (cliente/atendente/bot)
├── texto
├── tipo (texto/imagem/audio/video/arquivo)
├── message_sid (Twilio)
├── reply_to_message_id
└── ...

orcamentos
├── id (UUID)
├── ficha_nome (FK)
├── prestador_cpf (FK)
├── valores
├── status (pendente/aprovado/rejeitado)
└── ...

prestadores
├── cpf (PK)
├── nome
├── telefone
├── id_crm
└── ...

bot_historico
├── telefone_cliente
├── acao (ligado/desligado)
├── origem (manual/automatico/sistema)
├── executado_por_id
└── ...
```

### 9. Fluxos de Negócio

#### Fluxo de Atendimento
1. Cliente envia mensagem WhatsApp → Twilio → `twilio-webhook`
2. Webhook salva em `mensagens` e atualiza `clientes`
3. Bot processa via Twilio Studio (se habilitado)
4. Operador assume → bot é desligado
5. Ficha de serviço é criada
6. Orçamentos são enviados por prestadores
7. Operador aprova orçamento e agenda serviço
8. Serviço é executado e finalizado
9. NPS é enviado

#### Fluxo do Bot
1. Bot inicia habilitado por padrão
2. Ao assumir conversa → `toggle-bot-status` desliga
3. Ao mudar status da ficha → `schedule_bot_reactivation` agenda reativação
4. Job `reactivate-bots-24h` reativa após 24h (perdido) ou 10 dias (outros)

### 10. Integrações Externas

- **Twilio**: WhatsApp Business API + Studio Flows
- **Google Ads**: Sincronização de métricas via API
- **Webhooks externos**: Make/Zapier para automações
- **Lovable AI**: Resumo de conversas, limpeza de descrições

### 11. Utilitários (src/lib/)

- `utils.ts` - Funções utilitárias gerais (cn, formatação)
- `audioConverter.ts` - Conversão de áudio para formato compatível
- `valorPorExtenso.ts` - Converte valores para texto (recibos)

---

## Arquivo a Criar

**Localização**: `DOCUMENTACAO.md` na raiz do projeto

**Tamanho estimado**: ~800-1000 linhas de Markdown

---

## Detalhes Técnicos da Implementação

O arquivo será criado com sintaxe Markdown completa incluindo:
- Tabelas para listagem de arquivos e funções
- Blocos de código para exemplos
- Diagramas em texto (ASCII art para fluxos)
- Links internos entre seções
- Badges de status onde aplicável
