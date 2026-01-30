
# Plano de Integração Google Ads com o Dashboard

## Contexto Atual
O Dashboard exibe métricas de Google Ads (Impressões, Cliques, Conversões, CTR, Custo) com **valores estáticos hardcoded**. O objetivo é substituí-los por dados reais do Google Ads.

---

## Opções de Arquitetura

### Opção 1: Google Ads API Direta (via Edge Function)
**Complexidade: Alta | Manutenção: Média**

```text
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Dashboard  │────▶│  Edge Function   │────▶│  Google Ads API │
│  (Frontend) │     │  fetch-google-   │     │                 │
│             │◀────│  ads-metrics     │◀────│                 │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Supabase   │
                    │  (Cache)    │
                    └─────────────┘
```

**Prós:**
- Dados em tempo real (ou cache de 15 min)
- Sem dependências externas além da API Google

**Contras:**
- Requer OAuth2 com refresh tokens
- Complexidade de configuração (Google Cloud Console, credenciais)
- Custos de API mais altos para consultas frequentes

---

### Opção 2: Make.com com Atualização Periódica (Recomendada)
**Complexidade: Baixa | Manutenção: Baixa**

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│  Dashboard  │────▶│  Supabase   │◀────│  Make.com Scenario  │
│  (Frontend) │◀────│  google_ads │     │  (Scheduled Daily)  │
│             │     │  _metrics   │     │                     │
└─────────────┘     └─────────────┘     └─────────────────────┘
                                               │
                                               ▼
                                        ┌─────────────────┐
                                        │  Google Ads API │
                                        └─────────────────┘
```

**Prós:**
- Configuração visual e simples no Make.com
- Vocês já usam Make.com (integração com bairros/fichas)
- Sem gerenciar tokens OAuth no código
- Baixo custo (execução 1x ao dia)
- Histórico de dados preservado automaticamente

**Contras:**
- Dados com delay de até 24h
- Dependência do serviço Make.com

---

## Recomendação: Opção 2 (Make.com)

Considerando que:
- Vocês já utilizam Make.com para outras integrações
- Métricas de Ads não precisam ser em tempo real (relatórios diários são suficientes)
- A configuração é muito mais simples e mantém baixa a complexidade técnica

---

## Implementação Detalhada

### Fase 1: Estrutura de Dados (Supabase)

Criar tabela `google_ads_metrics`:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | Chave primária |
| data_referencia | date | Data das métricas |
| impressoes | integer | Total de impressões |
| cliques | integer | Total de cliques |
| conversoes | integer | Total de conversões |
| custo | decimal | Custo total em R$ |
| ctr | decimal | Taxa de cliques (%) |
| cpa | decimal | Custo por aquisição |
| campanha | text | Nome da campanha (opcional) |
| created_at | timestamp | Data de inserção |
| updated_at | timestamp | Última atualização |

**RLS Policy:** Apenas usuários autenticados com role `admin` ou `supervisor` podem visualizar.

---

### Fase 2: Cenário Make.com

Configurar cenário com:
1. **Trigger:** Schedule (diário às 06:00 ou horário preferido)
2. **Módulo:** Google Ads - Get Campaign Statistics
3. **Módulo:** HTTP - POST para webhook do Supabase

O webhook vai chamar uma Edge Function que insere/atualiza os dados.

---

### Fase 3: Edge Function `sync-google-ads`

Criar função que:
- Recebe dados do Make.com via webhook
- Valida o payload
- Insere ou atualiza na tabela `google_ads_metrics`
- Retorna confirmação

---

### Fase 4: Hook `useGoogleAdsMetrics`

Criar hook React que:
- Busca métricas do período selecionado
- Calcula variações vs período anterior
- Formata valores para exibição
- Retorna loading/error states

---

### Fase 5: Atualizar Dashboard

Modificar componentes para consumir dados reais:
- **KPICards** da seção "Marketing - Google Ads"
- **ConversionFunnel** (Impressões, Cliques)
- **AdsPerformanceChart** (gráfico semanal)

---

## Fluxo de Dados Final

```text
Google Ads ──▶ Make.com (diário) ──▶ Edge Function ──▶ Supabase
                                                          │
Dashboard ◀── useGoogleAdsMetrics ◀── React Query ◀───────┘
```

---

## Proteção de Dados Existentes

Como mencionado nas suas instruções, vou garantir que:
- Nenhum dado existente será modificado
- Os valores estáticos atuais permanecerão como fallback
- A migração será não-destrutiva (INSERT apenas, sem UPDATE em dados históricos)

---

## Próximos Passos

Após aprovação:
1. Criar tabela `google_ads_metrics` no Supabase
2. Criar Edge Function `sync-google-ads` para receber webhook
3. Criar hook `useGoogleAdsMetrics`
4. Atualizar Dashboard.tsx e componentes de gráficos
5. Fornecer instruções para configurar o cenário no Make.com

---

## Seção Técnica

### Estrutura de Arquivos a Criar/Modificar

```text
src/
├── hooks/
│   └── useGoogleAdsMetrics.ts (NOVO)
├── components/dashboard/
│   └── charts/
│       └── AdsPerformanceChart.tsx (MODIFICAR)
├── pages/
│   └── Dashboard.tsx (MODIFICAR)
supabase/
└── functions/
    └── sync-google-ads/
        └── index.ts (NOVO)
```

### Schema SQL

```sql
CREATE TABLE google_ads_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia DATE NOT NULL,
  impressoes INTEGER DEFAULT 0,
  cliques INTEGER DEFAULT 0,
  conversoes INTEGER DEFAULT 0,
  custo DECIMAL(10,2) DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0,
  cpa DECIMAL(10,2) DEFAULT 0,
  campanha TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(data_referencia, campanha)
);
```
