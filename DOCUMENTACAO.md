# 📘 Documentação Completa - Sistema 24Help

> **Versão**: 1.0  
> **Última atualização**: Fevereiro 2026  
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
12. [Utilitários](#12-utilitários)
13. [Autenticação e Autorização](#13-autenticação-e-autorização)
14. [Sistema de Notificações](#14-sistema-de-notificações)
15. [Configurações do Sistema](#15-configurações-do-sistema)

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
| **NPS** | Pesquisa de satisfação pós-serviço |
| **Relatórios** | Análises por bairro, prestador e período |

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
│                         └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Backend)                            │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  Edge Functions │    │  PostgreSQL Database                │ │
│  │  (Deno Runtime) │───▶│  • clientes                         │ │
│  └─────────────────┘    │  • mensagens                        │ │
│                         │  • fichas_de_servico                │ │
│  ┌─────────────────┐    │  • orcamentos                       │ │
│  │  Auth           │    │  • prestadores                      │ │
│  │  (JWT + RLS)    │    │  • bot_historico                    │ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  Storage        │    │  Realtime                           │ │
│  │  (chat-files)   │    │  (mensagens em tempo real)          │ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React SPA)                          │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  Chat           │    │  Dashboard                          │ │
│  │  • Conversas    │    │  • KPIs Operacionais                │ │
│  │  • Mensagens    │    │  • Funil de Conversão               │ │
│  │  • Fichas       │    │  • Google Ads Metrics               │ │
│  │  • Orçamentos   │    │  • Gráficos                         │ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
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
| Lucide React | - | Ícones |
| date-fns | 3.x | Manipulação de datas |
| jsPDF | 3.x | Geração de PDFs (recibos) |

### Backend (Supabase)

| Componente | Propósito |
|------------|-----------|
| PostgreSQL | Banco de dados relacional |
| Edge Functions | Lógica serverless (Deno runtime) |
| Auth | Autenticação e autorização |
| Storage | Armazenamento de arquivos |
| Realtime | Subscriptions WebSocket |
| RLS Policies | Segurança a nível de linha |

### Integrações

| Serviço | Propósito |
|---------|-----------|
| Twilio | WhatsApp Business API |
| Twilio Studio | Fluxos de bot automatizado |
| Google Ads API | Métricas de campanhas |
| Make/Zapier | Webhooks para automações |
| Gemini (Lovable AI) | IA para resumos e limpeza de texto |

---

## 3. Estrutura de Diretórios

```
24help/
├── public/                      # Arquivos estáticos públicos
│   ├── favicon.ico
│   ├── placeholder.svg
│   └── robots.txt
│
├── src/
│   ├── assets/                  # Imagens e logos
│   │   ├── logo.png
│   │   ├── logo-green.png
│   │   └── logo-24help.png
│   │
│   ├── components/              # Componentes React
│   │   ├── dashboard/           # Módulo Dashboard
│   │   │   ├── index.ts         # Barrel export
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
│   │   │   └── charts/
│   │   │       ├── index.ts
│   │   │       ├── ServicesLineChart.tsx
│   │   │       ├── TicketMedioChart.tsx
│   │   │       ├── AdsPerformanceChart.tsx
│   │   │       └── ROIChart.tsx
│   │   │
│   │   ├── ui/                  # Componentes shadcn/ui
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ... (40+ componentes)
│   │   │
│   │   ├── ChatWindow.tsx           # Janela de chat principal
│   │   ├── ConversationList.tsx     # Lista de conversas
│   │   ├── ConversationCard.tsx     # Card de conversa individual
│   │   ├── FichaPanel.tsx           # Painel de fichas
│   │   ├── FichaServicoTab.tsx      # Detalhes da ficha
│   │   ├── FichaCard.tsx            # Card de ficha resumido
│   │   ├── FichasDashboard.tsx      # Dashboard de fichas
│   │   ├── FichasOverview.tsx       # Visão geral de fichas
│   │   ├── OrcamentosTab.tsx        # Gerenciamento de orçamentos
│   │   ├── OrcamentoNotification.tsx
│   │   ├── OrcamentosSemFichaNotification.tsx
│   │   ├── AprovacaoOrcamentoDialog.tsx
│   │   ├── CriarFichaDialog.tsx     # Criar nova ficha
│   │   ├── AbrirConversaDialog.tsx  # Iniciar conversa
│   │   ├── NovaConversaDialog.tsx
│   │   ├── ResumoConversaDialog.tsx # Resumo IA da conversa
│   │   ├── BotHistoricoDialog.tsx   # Histórico do bot
│   │   ├── VariableMappingDialog.tsx
│   │   ├── NotificationSystem.tsx   # Sistema de notificações
│   │   ├── ServicoAtrasadoNotification.tsx
│   │   ├── TemplateManagement.tsx   # Gerenciar templates WhatsApp
│   │   ├── MensagensPadronizadas.tsx
│   │   ├── MensagensPadronizadasDropdown.tsx
│   │   ├── VariaveisMensagemDropdown.tsx
│   │   ├── MessageContextMenu.tsx   # Menu de contexto mensagem
│   │   ├── ReplyIndicator.tsx       # Indicador de reply
│   │   ├── AudioPlayer.tsx          # Player de áudio
│   │   ├── AudioRecorder.tsx        # Gravador de áudio
│   │   ├── ReciboGenerator.tsx      # Gerador de recibos PDF
│   │   ├── NPSFlowPanel.tsx         # Painel de NPS
│   │   ├── NPSMetricsKPIs.tsx       # KPIs de NPS
│   │   ├── OrcamentoTempoKPIs.tsx
│   │   ├── VisitaConversaoKPIs.tsx
│   │   ├── ContactsTab.tsx          # Aba de contatos
│   │   ├── DeleteContactDialog.tsx
│   │   ├── FilterDropdown.tsx       # Filtros avançados
│   │   ├── TagManager.tsx           # Gerenciador de tags
│   │   ├── StatusConexaoTwilio.tsx  # Status da conexão Twilio
│   │   ├── UserManagement.tsx       # Gerenciamento de usuários
│   │   ├── PrestadorManagement.tsx  # Gerenciamento de prestadores
│   │   ├── PasswordChange.tsx       # Alteração de senha
│   │   ├── AccountInfo.tsx          # Informações da conta
│   │   ├── ProtectedRoute.tsx       # Rota protegida
│   │   ├── ErrorBoundary.tsx        # Tratamento de erros
│   │   └── Logo.tsx                 # Componente de logo
│   │
│   ├── contexts/                # Contextos React
│   │   ├── AuthContext.tsx      # Autenticação e perfil
│   │   ├── VisualModeContext.tsx    # Personalização visual
│   │   └── DashboardLayoutContext.tsx # Layout do dashboard
│   │
│   ├── hooks/                   # Hooks customizados
│   │   ├── use-mobile.tsx       # Detecção mobile
│   │   ├── use-toast.ts         # Sistema de toasts
│   │   ├── useConversationTimer.ts  # Timer janela 24h
│   │   ├── useOperationalKPIs.ts    # KPIs operacionais
│   │   ├── useGoogleAdsMetrics.ts   # Métricas Google Ads
│   │   └── useDashboardSummary.ts   # Resumo dashboard
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts        # Cliente Supabase (auto-gerado)
│   │       └── types.ts         # Tipos do banco (auto-gerado)
│   │
│   ├── lib/                     # Utilitários
│   │   ├── utils.ts             # Funções gerais (cn, formatação)
│   │   ├── audioConverter.ts    # Conversão de áudio
│   │   └── valorPorExtenso.ts   # Valor por extenso (recibos)
│   │
│   ├── pages/                   # Páginas da aplicação
│   │   ├── Home.tsx             # Página inicial
│   │   ├── Auth.tsx             # Login/Signup
│   │   ├── Chat.tsx             # Interface de chat
│   │   ├── Dashboard.tsx        # Dashboard executivo
│   │   ├── Settings.tsx         # Configurações
│   │   ├── FichasGeral.tsx      # Visão geral fichas
│   │   ├── BairrosReport.tsx    # Relatório por bairro
│   │   ├── PrestadoresReport.tsx    # Relatório prestadores
│   │   ├── OrcamentoPublico.tsx     # Form público orçamento
│   │   ├── PrestadorPortal.tsx      # Portal do prestador
│   │   └── NotFound.tsx         # Página 404
│   │
│   ├── App.tsx                  # Componente raiz + rotas
│   ├── App.css                  # Estilos globais
│   ├── main.tsx                 # Entry point
│   ├── index.css                # Tokens CSS + Tailwind
│   └── vite-env.d.ts            # Tipos Vite
│
├── supabase/
│   ├── config.toml              # Configuração Supabase (auto-gerado)
│   └── functions/               # Edge Functions
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
│       └── sync-google-ads/
│
├── .lovable/
│   └── plan.md                  # Plano de desenvolvimento
│
├── index.html                   # HTML base
├── tailwind.config.ts           # Config Tailwind
├── vite.config.ts               # Config Vite
├── tsconfig.json                # Config TypeScript
├── components.json              # Config shadcn/ui
└── package.json                 # Dependências
```

---

## 4. Páginas da Aplicação

### `src/pages/`

| Arquivo | Rota | Acesso | Descrição |
|---------|------|--------|-----------|
| `Home.tsx` | `/` | Autenticado | Página inicial com cards de acesso rápido ao Chat e Dashboard |
| `Auth.tsx` | `/auth` | Público | Login e signup com email/senha |
| `Chat.tsx` | `/chat` | Autenticado | Interface principal de atendimento WhatsApp |
| `Dashboard.tsx` | `/dashboard` | Autenticado | Dashboard executivo com KPIs e gráficos |
| `Settings.tsx` | `/settings` | Admin | Configurações do sistema |
| `FichasGeral.tsx` | `/geral` | Autenticado | Visão geral de todas as fichas de serviço |
| `BairrosReport.tsx` | `/bairros` | Autenticado | Relatório de serviços por bairro |
| `PrestadoresReport.tsx` | `/prestadores` | Autenticado | Relatório de desempenho dos prestadores |
| `OrcamentoPublico.tsx` | `/orcamento` | Público | Formulário para prestadores enviarem orçamentos |
| `PrestadorPortal.tsx` | `/prestador` | Público | Portal self-service para prestadores |
| `NotFound.tsx` | `*` | Público | Página 404 |

### Detalhes das Páginas Principais

#### `Chat.tsx`
A página mais complexa do sistema, responsável por:
- Listar todas as conversas ativas
- Exibir mensagens em tempo real
- Gerenciar fichas de serviço
- Processar orçamentos
- Controlar o bot automatizado

**Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│  Lista de Conversas  │  Janela de Chat  │  Painel de Fichas    │
│  (ConversationList)  │  (ChatWindow)    │  (FichaPanel)        │
│                      │                  │                       │
│  • Filtros           │  • Mensagens     │  • FichaServicoTab   │
│  • Busca             │  • Input         │  • OrcamentosTab     │
│  • Cards             │  • Ações         │  • Histórico         │
└────────────────────────────────────────────────────────────────┘
```

#### `Dashboard.tsx`
Dashboard modular com blocos personalizáveis:
- **KPIs Operacionais**: Fichas criadas, agendamentos, finalizados
- **Funil de Conversão**: Taxas de conversão entre etapas
- **Google Ads**: Métricas de campanhas publicitárias
- **Gráficos**: Evolução temporal de métricas

---

## 5. Componentes Principais

### Módulo de Chat

#### `ChatWindow.tsx` (~2000 linhas)

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

**Estados principais:**
```typescript
const [messages, setMessages] = useState<Message[]>([]);
const [newMessage, setNewMessage] = useState('');
const [isUploading, setIsUploading] = useState(false);
const [isRecording, setIsRecording] = useState(false);
const [replyingTo, setReplyingTo] = useState<Message | null>(null);
const [searchQuery, setSearchQuery] = useState('');
const [botEnabled, setBotEnabled] = useState(true);
```

**Realtime subscription:**
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`messages:${clienteId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'mensagens',
      filter: `cliente_id=eq.${clienteId}`
    }, handleRealtimeMessage)
    .subscribe();
    
  return () => { supabase.removeChannel(channel); };
}, [clienteId]);
```

#### `ConversationList.tsx` (~1300 linhas)

**Funcionalidades:**
- Listagem paginada de conversas
- Filtros avançados:
  - Status da conversa (aberta/fechada)
  - Status da ficha (Ficha Criada, Agendado, etc.)
  - Tags personalizadas
  - Bot (habilitado/desabilitado)
  - Pagamento (pendente/realizado)
- Busca por nome, telefone, ficha, prestador
- Toggle "Meus Tickets" / "Todos"
- Seleção em massa para ações em lote
- Indicadores visuais:
  - Mensagens não lidas
  - Bot desativado (alerta)
  - Tempo desde última mensagem

**Ordenação:**
- Conversas com mensagens não lidas primeiro
- Depois por última interação (mais recente primeiro)

#### `FichaServicoTab.tsx` (~1450 linhas)

**Seções:**
1. **Dados do Cliente**
   - Nome, telefone, CPF
   - Endereço, bairro, cidade
   
2. **Status do Serviço**
   - Pipeline visual de status
   - Motivo de perda (quando aplicável)
   
3. **Agendamento**
   - Data/hora de visita técnica
   - Data/hora do serviço
   - Preferência de horário do cliente
   
4. **Valores**
   - Valor total
   - Mão de obra
   - Peças
   - Tempo estimado do serviço
   
5. **Pagamento**
   - Tipo (PIX, cartão, dinheiro, etc.)
   - Parcelas
   - Status de pagamento
   - Link de pagamento
   
6. **Ações**
   - Enviar webhook para sistema externo
   - Gerar recibo PDF
   - Enviar NPS

### Módulo Dashboard

#### `DashboardContent.tsx`

Orquestrador que renderiza blocos do dashboard baseado na configuração do usuário:

```typescript
const sortedBlocks = [...blocks]
  .filter(block => block.enabled)
  .sort((a, b) => a.order - b.order);

return (
  <main className="flex-1 p-6 space-y-8 overflow-auto">
    {sortedBlocks.map(block => renderBlock(block.id))}
  </main>
);
```

**Blocos disponíveis:**
| ID | Componente | Descrição |
|----|------------|-----------|
| `operational-kpis` | `OperationalKPIsSection` | Métricas operacionais |
| `conversion-funnel` | `ConversionRatesSection` + `ConversionFunnel` | Funil de conversão |
| `google-ads` | `GoogleAdsSection` | Métricas Google Ads |
| `charts` | Gráficos variados | Evolução temporal |
| `export` | `ExportReportSection` | Exportação de relatórios |

#### `OperationalKPIsSection.tsx`

Exibe cards de KPIs operacionais:
- **FS Criadas**: Fichas de serviço criadas no período
- **Visita Técnica**: Agendamentos de visita técnica
- **Serviços Agendados**: Total de serviços agendados
- **Finalizados + Pagos**: Serviços concluídos com pagamento

#### `ConversionRatesSection.tsx`

Calcula e exibe taxas de conversão:
- Taxa Ficha → Agendamento
- Taxa Agendamento → Finalizado
- Taxa Geral (Ficha → Finalizado)

### Componentes de Suporte

#### `NotificationSystem.tsx`

Sistema de notificações em tempo real para:
- Novas mensagens de clientes
- Orçamentos recebidos
- Serviços atrasados
- Bot desativado

#### `TemplateManagement.tsx`

Gerenciamento de templates WhatsApp aprovados:
- Listar templates do Twilio
- Configurar mapeamento de variáveis
- Enviar templates para clientes

#### `ReciboGenerator.tsx`

Geração de recibos PDF com:
- Dados do cliente
- Descrição do serviço
- Valores por extenso
- QR Code PIX
- Assinatura do prestador

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

**Roles:**
- `admin`: Acesso total ao sistema
- `supervisor`: Acesso ao dashboard e relatórios
- `user`: Acesso apenas ao chat

### `VisualModeContext.tsx`

Personalização visual do sistema:

```typescript
interface VisualMode {
  background: 'default' | 'gradient' | 'dark' | 'light';
  cardStyle: 'default' | 'glass' | 'solid' | 'outlined';
  accentColor: string;
}
```

### `DashboardLayoutContext.tsx`

Configuração modular do dashboard:

```typescript
interface DashboardBlock {
  id: BlockType;
  label: string;
  enabled: boolean;
  order: number;
  size: 'full' | 'half' | 'third';
}

// Persistência em localStorage
const STORAGE_KEY = 'dashboard-layout-v1';
```

---

## 7. Hooks Customizados

### `useConversationTimer.ts`

Calcula tempo restante da janela de 24h do WhatsApp:

```typescript
const { hoursRemaining, minutesRemaining, isExpired, isWithin24h } = 
  useConversationTimer(ultimaInteracao);
```

**Lógica:**
- Se última mensagem do cliente foi há menos de 24h → pode enviar mensagem normal
- Se expirou → precisa enviar template aprovado

### `useOperationalKPIs.ts`

Busca KPIs operacionais com filtros de período:

```typescript
interface OperationalKPIs {
  fsCriadas: number;
  visitaTecnica: number;
  servicoAgendadoTotal: number;
  finalizadoPago: number;
  conversasIniciadas: number;
}

const { data, isLoading, error } = useOperationalKPIs({
  period: 'month',
  customRange: { from: Date, to: Date }
});
```

### `useGoogleAdsMetrics.ts`

Métricas do Google Ads:

```typescript
interface GoogleAdsMetrics {
  impressoes: number;
  cliques: number;
  conversoes: number;
  custo: number;
  ctr: number;
  cpa: number;
}
```

### `useDashboardSummary.ts`

Resumo geral para o dashboard.

### `use-mobile.tsx`

Detecção de dispositivo móvel:

```typescript
const isMobile = useMobile(); // true se width < 768px
```

### `use-toast.ts`

Sistema de notificações toast (shadcn/ui).

---

## 8. Edge Functions (Backend)

### Funções de Mensageria WhatsApp

#### `twilio-webhook/index.ts`

**Propósito:** Recebe mensagens do WhatsApp via Twilio Studio

**Fluxo:**
1. Recebe POST do Twilio com dados da mensagem
2. Extrai informações (texto, mídia, remetente)
3. Cria/atualiza registro do cliente
4. Salva mensagem no banco
5. Atualiza `ultima_interacao` do cliente
6. Retorna confirmação para Twilio

**Payload recebido:**
```json
{
  "From": "whatsapp:+5541999999999",
  "Body": "Texto da mensagem",
  "MediaUrl0": "https://...",
  "MediaContentType0": "image/jpeg",
  "MessageSid": "SM..."
}
```

#### `send-whatsapp/index.ts`

**Propósito:** Envia mensagens para clientes

**Verificações:**
1. Janela de 24h ainda válida?
2. Se não → retorna erro, precisa usar template
3. Se sim → envia via Twilio API

**Payload:**
```typescript
{
  to: string;      // telefone destino
  body: string;    // texto da mensagem
  mediaUrl?: string; // URL da mídia (opcional)
}
```

#### `send-template/index.ts`

**Propósito:** Envia templates aprovados do WhatsApp

**Payload:**
```typescript
{
  to: string;
  contentSid: string;
  variables: Record<string, string>;
}
```

#### `twilio-status-callback/index.ts`

**Propósito:** Atualiza status de entrega das mensagens

**Status possíveis:**
- `queued` → na fila
- `sent` → enviado
- `delivered` → entregue
- `read` → lido
- `failed` → falhou

### Funções de Controle do Bot

#### `toggle-bot-status/index.ts`

**Propósito:** Liga/desliga bot para um cliente com auditoria completa

**Fluxo:**
1. Recebe telefone e ação desejada
2. Atualiza `bot_habilitado` na tabela `clientes`
3. Registra em `bot_historico` com:
   - Quem executou
   - Origem (manual/automatico/sistema)
   - Ficha relacionada
   - Timestamp

#### `check-bot-status/index.ts`

**Propósito:** Verifica se bot está habilitado para um cliente

**Retorno:**
```json
{
  "bot_habilitado": true,
  "data_desabilitado": null
}
```

#### `stop-twilio-flow/index.ts`

**Propósito:** Para execução do fluxo Twilio Studio

Usado quando operador assume conversa para evitar que bot continue respondendo.

#### `process-bot-reactivation/index.ts`

**Propósito:** Processa reativações agendadas do bot

**Consulta:** `bot_reactivation_schedule` onde `scheduled_at <= now()` e `executed = false`

#### `reactivate-bots-24h/index.ts`

**Status:** DESATIVADA

> A reativação agora é controlada apenas pelo trigger `schedule_bot_reactivation` que agenda baseado na mudança de status da ficha.

### Funções de Orçamento

#### `submit-orcamento/index.ts`

**Propósito:** Processa envio de orçamento de prestador

**Fluxo:**
1. Valida dados do orçamento
2. Salva em `orcamentos`
3. Envia webhook para Make (assíncrono com `waitUntil`)
4. Retorna sucesso imediato

#### `check-orcamento-forms/index.ts`

**Propósito:** Fecha formulários de orçamento expirados

**Regra:** Se primeiro orçamento foi há mais de 2 horas, fecha para novos envios.

### Funções de IA

#### `summarize-conversation/index.ts`

**Propósito:** Gera resumo da conversa usando Gemini

**Fluxo:**
1. Busca últimas N mensagens do cliente
2. Envia para Gemini com prompt específico
3. Retorna resumo estruturado

#### `clean-description/index.ts`

**Propósito:** Limpa e formata descrição do serviço

Usa IA para padronizar descrições enviadas por clientes.

### Funções Administrativas

#### `manage-users/index.ts`

**Propósito:** CRUD de usuários (admin only)

**Operações:**
- Listar usuários
- Criar usuário
- Atualizar role
- Deletar usuário

#### `get-twilio-templates/index.ts`

**Propósito:** Lista templates disponíveis no Twilio

#### `search-ficha-id/index.ts`

**Propósito:** Busca ficha por ID (bypassa RLS)

#### `update-pagamento/index.ts`

**Propósito:** Atualiza status de pagamento

#### `update-prestador-idcrm/index.ts`

**Propósito:** Atualiza ID CRM do prestador

#### `sync-google-ads/index.ts`

**Propósito:** Sincroniza métricas do Google Ads

---

## 9. Modelo de Dados

### Diagrama ER Simplificado

```
┌─────────────────┐       ┌─────────────────────┐
│    clientes     │───────│  fichas_de_servico  │
│  (telefone PK)  │ 1:N   │     (id PK)         │
└─────────────────┘       └─────────────────────┘
        │                          │
        │ 1:N                      │ 1:N
        ▼                          ▼
┌─────────────────┐       ┌─────────────────────┐
│   mensagens     │       │    orcamentos       │
│   (id UUID)     │       │    (id UUID)        │
└─────────────────┘       └─────────────────────┘
        │                          │
        │ N:1                      │ N:1
        ▼                          ▼
┌─────────────────┐       ┌─────────────────────┐
│    profiles     │       │   prestadores       │
│   (id UUID)     │       │    (cpf PK)         │
└─────────────────┘       └─────────────────────┘
```

### Tabelas Principais

#### `clientes`

```sql
CREATE TABLE clientes (
  telefone TEXT PRIMARY KEY,          -- Número WhatsApp (ex: "5541999999999")
  nome TEXT NOT NULL DEFAULT 'Cliente Desconhecido',
  cpf TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  tags TEXT[] DEFAULT '{}',           -- Tags personalizadas
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
  nome_cliente TEXT,
  nome_ficha TEXT,
  descricao TEXT,
  
  -- Localização
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  cpf TEXT,
  
  -- Categorização
  categoria_id INTEGER REFERENCES categorias(id),
  prestador_id TEXT REFERENCES prestadores(cpf),
  
  -- Status e datas
  status status_ficha_enum DEFAULT 'Ficha Criada',
  horario_agendamento TIMESTAMPTZ,
  data_visita_tecnica DATE,
  horario_visita_tecnica TIMESTAMPTZ,
  preferencia_horario_cliente TEXT,
  
  -- Valores
  valor_total NUMERIC DEFAULT 0,
  valor_mao_obra NUMERIC DEFAULT 0,
  valor_pecas NUMERIC DEFAULT 0,
  tempo_servico TEXT,
  
  -- Pagamento
  pagamento_tipo tipo_pagamento_enum,
  pagamento_parcelas INTEGER DEFAULT 1,
  pagamento_realizado BOOLEAN DEFAULT false,
  pagamento_link TEXT,
  pagamento_gerar_link BOOLEAN DEFAULT true,
  recibo_url TEXT,
  
  -- Controle de orçamentos
  formulario_orcamento_ativo BOOLEAN DEFAULT true,
  formulario_orcamento_data_primeiro_envio TIMESTAMPTZ,
  formulario_orcamento_encerrado_em TIMESTAMPTZ,
  
  -- Metadados
  motivo_perda TEXT,
  notas TEXT,
  id_zoho TEXT,
  webhook_pendente BOOLEAN DEFAULT false,
  data_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Status disponíveis (enum):**
- `Ficha Criada`
- `Contato Inicial`
- `Dúvida Prestador`
- `Orçamento Enviado`
- `Negociação`
- `Visita Técnica`
- `Orçamento Aprovado / Agendamento`
- `Orçamento Não Aprovado`
- `Agendado`
- `Em andamento`
- `Finalizado`
- `Garantia`
- `Perdido`
- `Não foi adiante`

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
  status status_mensagem_enum DEFAULT 'enviado',
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
  ficha_nome TEXT NOT NULL,           -- ID da ficha
  prestador_cpf TEXT NOT NULL,        -- CPF do prestador
  valor_total NUMERIC,
  valor_mao_obra NUMERIC,
  valor_pecas NUMERIC,
  tempo_servico TEXT,
  horario_sugerido TIMESTAMPTZ,
  pode_horario BOOLEAN,
  observacoes TEXT,
  categoria TEXT,
  status status_orcamento_enum DEFAULT 'pendente',  -- pendente, aprovado, rejeitado
  data_criacao TIMESTAMPTZ DEFAULT now()
);
```

#### `prestadores`

```sql
CREATE TABLE prestadores (
  cpf TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  cnpj TEXT,
  categoria TEXT,
  especialidade TEXT,
  id_azure TEXT,
  id_crm TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `bot_historico`

```sql
CREATE TABLE bot_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_cliente TEXT NOT NULL REFERENCES clientes(telefone),
  acao TEXT NOT NULL,                 -- 'ligado', 'desligado'
  origem TEXT NOT NULL,               -- 'manual', 'automatico', 'sistema'
  executado_por_id UUID REFERENCES profiles(id),
  ficha_id TEXT REFERENCES fichas_de_servico(id),
  observacao TEXT,
  user_agent TEXT,
  ip_address TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `bot_reactivation_schedule`

```sql
CREATE TABLE bot_reactivation_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_cliente TEXT NOT NULL,
  ficha_id TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabelas de Suporte

#### `profiles`

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,  -- Referencia auth.users
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `user_roles`

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role DEFAULT 'user',       -- admin, supervisor, user
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `tags`

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `categorias`

```sql
CREATE TABLE categorias (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `mensagens_padronizadas`

```sql
CREATE TABLE mensagens_padronizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tag TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `whatsapp_templates`

```sql
CREATE TABLE whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_sid TEXT NOT NULL,          -- ID no Twilio
  friendly_name TEXT NOT NULL,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  variable_mapping JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `nps_respostas`

```sql
CREATE TABLE nps_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id TEXT NOT NULL,
  telefone_cliente TEXT NOT NULL,
  prestador_id TEXT,
  nota INTEGER,                       -- 1-5 (escala atual)
  classificacao TEXT,                 -- 'positivo', 'neutro', 'critico'
                                    -- legado: 'promotor', 'detrator'
  feedback TEXT,
  tipo_feedback TEXT,
  enviado_em TIMESTAMPTZ DEFAULT now(),
  respondido_em TIMESTAMPTZ,
  feedback_respondido_em TIMESTAMPTZ,
  operador_id UUID,
  prioridade BOOLEAN DEFAULT false,
  supervisor_alertado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```



#### Estratégia para dados históricos da pesquisa

**Escolha adotada: Opção A (coexistência de modelos)**

- O histórico legado com notas **0-10** é mantido sem transformação.
- Os novos KPIs principais utilizam apenas respostas da escala **1-5**.
- Respostas legadas aparecem apenas como contagem informativa para contexto operacional.
- Motivação: preservar rastreabilidade e evitar conversão retroativa sem validação formal do negócio.

**Regra operacional de classificação (escala 1-5)**

- **1-2:** crítico
- **3:** neutro
- **4-5:** positivo

> Observação: esta regra deve permanecer alinhada entre operação, atendimento e monitoramento de KPIs.

#### `google_ads_metrics`

```sql
CREATE TABLE google_ads_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia DATE NOT NULL,
  campanha TEXT,
  impressoes INTEGER DEFAULT 0,
  cliques INTEGER DEFAULT 0,
  conversoes INTEGER DEFAULT 0,
  custo NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpa NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `ficha_status_historico`

```sql
CREATE TABLE ficha_status_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id TEXT NOT NULL REFERENCES fichas_de_servico(id),
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  data_inicio TIMESTAMPTZ DEFAULT now(),
  data_fim TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `configuracoes`

```sql
CREATE TABLE configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  valor TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 10. Fluxos de Negócio

### Fluxo de Atendimento Principal

```
┌─────────────────────────────────────────────────────────────────┐
│  1. CLIENTE ENVIA MENSAGEM                                       │
│     WhatsApp → Twilio → twilio-webhook                           │
│     • Salva mensagem em 'mensagens'                              │
│     • Cria/atualiza cliente                                      │
│     • Atualiza ultima_interacao                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. BOT PROCESSA (se habilitado)                                 │
│     Twilio Studio Flow                                           │
│     • Coleta informações iniciais                                │
│     • Responde perguntas frequentes                              │
│     • Encaminha para atendente quando necessário                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. OPERADOR ASSUME CONVERSA                                     │
│     ChatWindow.tsx                                               │
│     • Clica em "Assumir" → toggle-bot-status (desliga)           │
│     • Bot é desligado com auditoria                              │
│     • Operador é atribuído ao cliente                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. CRIAÇÃO DA FICHA DE SERVIÇO                                  │
│     CriarFichaDialog.tsx → FichaServicoTab.tsx                   │
│     • Preenche dados do cliente                                  │
│     • Descreve o problema/serviço                                │
│     • Define categoria                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. SOLICITAÇÃO DE ORÇAMENTOS                                    │
│     TemplateManagement.tsx                                       │
│     • Envia formulário para prestadores selecionados             │
│     • Prestadores acessam OrcamentoPublico.tsx                   │
│     • Formulário fecha após 2h do primeiro orçamento             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. RECEBIMENTO E APROVAÇÃO DE ORÇAMENTOS                        │
│     OrcamentosTab.tsx → AprovacaoOrcamentoDialog.tsx             │
│     • Operador visualiza orçamentos recebidos                    │
│     • Apresenta ao cliente                                       │
│     • Cliente escolhe prestador                                  │
│     • Operador aprova orçamento                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. AGENDAMENTO DO SERVIÇO                                       │
│     FichaServicoTab.tsx                                          │
│     • Define data/hora do serviço                                │
│     • Atualiza status para "Agendado"                            │
│     • Trigger agenda reativação do bot (10 dias)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. EXECUÇÃO DO SERVIÇO                                          │
│     FichaServicoTab.tsx                                          │
│     • Status: "Em andamento"                                     │
│     • Acompanhamento via chat                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  9. FINALIZAÇÃO E PAGAMENTO                                      │
│     FichaServicoTab.tsx                                          │
│     • Status: "Finalizado"                                       │
│     • Registra pagamento                                         │
│     • Gera recibo (ReciboGenerator.tsx)                          │
│     • Trigger agenda reativação do bot (10 dias)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  10. PESQUISA NPS                                                │
│      NPSFlowPanel.tsx                                            │
│      • Envia template de NPS para cliente                        │
│      • Cliente responde com nota (1-5)                           │
│      • Sistema classifica (positivo/neutro/crítico)              │
│      • Alerta supervisor se crítico                              │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de Controle do Bot

```
┌─────────────────────────────────────────────────────────────────┐
│  ESTADO INICIAL                                                  │
│  • Novo cliente → bot_habilitado = true                          │
│  • Bot responde automaticamente via Twilio Studio                │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌─────────────────────┐               ┌─────────────────────┐
│  OPERADOR ASSUME    │               │  BOT CONTINUA       │
│  toggle-bot-status  │               │  Atendimento auto   │
│  bot_habilitado=    │               │                     │
│  false              │               │                     │
└─────────────────────┘               └─────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  ATENDIMENTO HUMANO                                              │
│  • Operador conversa com cliente                                 │
│  • Cria ficha, processa orçamentos, agenda                       │
│  • Bot permanece desligado                                       │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  MUDANÇA DE STATUS DA FICHA                                      │
│  Trigger: schedule_bot_reactivation                              │
│                                                                  │
│  Se status = 'Perdido':                                          │
│    → Agenda reativação em 24 HORAS                               │
│                                                                  │
│  Outros status (Finalizado, Agendado, etc.):                     │
│    → Agenda reativação em 10 DIAS                                │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  REATIVAÇÃO AGENDADA                                             │
│  process-bot-reactivation (job periódico)                        │
│  • Verifica agendamentos vencidos                                │
│  • Liga bot novamente: bot_habilitado = true                     │
│  • Registra em bot_historico (origem: 'automatico')              │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de Orçamentos

```
┌─────────────────────────────────────────────────────────────────┐
│  1. OPERADOR SOLICITA ORÇAMENTOS                                 │
│     • Seleciona prestadores por categoria                        │
│     • Envia template WhatsApp com link do formulário             │
│     • formulario_orcamento_ativo = true                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. PRESTADOR ACESSA FORMULÁRIO                                  │
│     /orcamento?ficha=XXX&prestador=YYY                           │
│     • Valida ficha e prestador                                   │
│     • Verifica se formulário ainda está ativo                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. PRESTADOR ENVIA ORÇAMENTO                                    │
│     submit-orcamento edge function                               │
│     • Salva em tabela 'orcamentos'                               │
│     • Marca data do primeiro orçamento (se for o primeiro)       │
│     • Envia webhook para Make (assíncrono)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. FECHAMENTO DO FORMULÁRIO                                     │
│     check-orcamento-forms (job periódico)                        │
│     • Se primeiro orçamento foi há > 2 horas                     │
│     • formulario_orcamento_ativo = false                         │
│     • Novos orçamentos são bloqueados                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. OPERADOR AVALIA ORÇAMENTOS                                   │
│     OrcamentosTab.tsx                                            │
│     • Lista todos os orçamentos recebidos                        │
│     • Compara valores, tempo, observações                        │
│     • Apresenta opções ao cliente                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. APROVAÇÃO DO ORÇAMENTO                                       │
│     AprovacaoOrcamentoDialog.tsx                                 │
│     • Marca orçamento como 'aprovado'                            │
│     • Copia valores para a ficha                                 │
│     • Atribui prestador à ficha                                  │
│     • Atualiza status da ficha                                   │
└─────────────────────────────────────────────────────────────────┘
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

### Google Ads

**Integração:**
- Edge function `sync-google-ads` sincroniza métricas periodicamente
- Dados salvos em `google_ads_metrics`
- Dashboard exibe métricas agregadas

**Métricas coletadas:**
- Impressões, Cliques, Conversões
- Custo, CTR, CPA
- Por campanha e por data

### Make/Zapier

**Webhooks de saída:**
- Novo orçamento recebido
- Ficha atualizada
- Pagamento confirmado

**Configuração:**
- URL do webhook configurada via `configuracoes` ou hardcoded
- Chamadas assíncronas com `EdgeRuntime.waitUntil`

### Lovable AI (Gemini)

**Funções que usam IA:**
- `summarize-conversation`: Resumo de conversas
- `clean-description`: Limpeza de descrições

**Modelo utilizado:** `google/gemini-2.5-flash`

---

## 12. Utilitários

### `src/lib/utils.ts`

```typescript
// Merge de classes Tailwind
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### `src/lib/audioConverter.ts`

Conversão de áudio para formato compatível com WhatsApp (OGG/Opus).

### `src/lib/valorPorExtenso.ts`

Converte valores numéricos para texto (usado em recibos):

```typescript
valorPorExtenso(1234.56); 
// "um mil duzentos e trinta e quatro reais e cinquenta e seis centavos"
```

---

## 13. Autenticação e Autorização

### Sistema de Autenticação

- **Provider**: Supabase Auth
- **Método**: Email/Senha
- **Verificação**: Email (confirmação obrigatória)

### Roles e Permissões

| Role | Dashboard | Chat | Settings | Relatórios |
|------|-----------|------|----------|------------|
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `supervisor` | ✅ | ✅ | ❌ | ✅ |
| `user` | ❌ | ✅ | ❌ | ❌ |

### RLS Policies

Todas as tabelas possuem Row Level Security habilitado com políticas baseadas em roles.

**Exemplo (mensagens):**
```sql
-- Atendentes podem ver todas as mensagens
CREATE POLICY "Atendentes podem ver todas as mensagens"
ON mensagens FOR SELECT
USING (true);

-- Atendentes podem inserir mensagens
CREATE POLICY "Atendentes podem inserir mensagens"
ON mensagens FOR INSERT
WITH CHECK (true);
```

---

## 14. Sistema de Notificações

### Tipos de Notificação

| Tipo | Componente | Trigger |
|------|------------|---------|
| Nova mensagem | `NotificationSystem` | Realtime subscription |
| Orçamento recebido | `OrcamentoNotification` | Insert em `orcamentos` |
| Serviço atrasado | `ServicoAtrasadoNotification` | Query periódica |
| Bot desativado | Badge visual | `bot_habilitado = false` |

### Implementação

```typescript
// Realtime subscription para notificações
useEffect(() => {
  const channel = supabase
    .channel('notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'mensagens'
    }, handleNewMessage)
    .subscribe();
}, []);
```

---

## 15. Configurações do Sistema

### Página de Settings (`/settings`)

**Seções disponíveis (admin only):**

1. **Conta**
   - Informações do usuário
   - Alteração de senha

2. **Usuários**
   - CRUD de usuários
   - Atribuição de roles

3. **Prestadores**
   - Cadastro de prestadores
   - Atualização de ID CRM

4. **Twilio**
   - Status da conexão
   - Teste de envio

5. **Templates**
   - Gerenciamento de templates WhatsApp
   - Mapeamento de variáveis

6. **Mensagens Padronizadas**
   - CRUD de respostas rápidas
   - Organização por tags

7. **Tags**
   - Gerenciamento de tags para clientes
   - Cores personalizadas

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
- **Persistência**: localStorage (preferências de layout)

### Performance

- **Code splitting**: Lazy loading de páginas
- **Memoização**: useMemo/useCallback para cálculos pesados
- **Virtualização**: Não implementada (listas geralmente < 100 itens)
- **Debounce**: Busca em tempo real

---

## 🔧 Troubleshooting

### Mensagens não chegam

1. Verificar conexão Twilio (Settings → Twilio)
2. Checar logs do `twilio-webhook`
3. Verificar se o fluxo Studio está passando pelo widget correto

### Bot não responde

1. Verificar `bot_habilitado` do cliente
2. Checar `bot_historico` para entender desativações
3. Verificar fluxo no Twilio Studio

### Orçamentos não aparecem

1. Verificar se `formulario_orcamento_ativo = true`
2. Checar se o prestador está cadastrado corretamente
3. Verificar logs do `submit-orcamento`

---

## 📚 Referências

- [Documentação Supabase](https://supabase.com/docs)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)
- [shadcn/ui](https://ui.shadcn.com)
- [TanStack Query](https://tanstack.com/query)
- [Tailwind CSS](https://tailwindcss.com)

---

*Documentação gerada em Fevereiro 2026*
