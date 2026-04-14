

# Plano: Vendas Assistant no Chat Beta

## O que será feito

Criar um assistente de vendas com IA integrado ao Chat Beta, com painel de chat interativo onde o operador pode colar conversas e receber orientações de vendas em tempo real.

## Mudanças importantes no prompt do usuário

- **Não usaremos Anthropic/Claude** — usaremos Lovable AI (gateway já disponível, `LOVABLE_API_KEY` já configurado). Isso evita precisar de uma API key externa.
- O modelo será `google/gemini-3-flash-preview` (rápido e eficiente para coaching de vendas).
- A integração será no **Chat Beta** (não no Chat antigo), como painel colapsável na COL 4 (ao lado da FichaPanel) ou como aba/drawer.

## Arquitetura

```text
┌──────────────┬────────────┬──────────────┬────────────────┐
│ FilterSidebar│ ConvList   │ ChatWindow   │ FichaPanel     │
│              │            │              │ + VendasAssist │
│              │            │              │   (aba/toggle) │
└──────────────┴────────────┴──────────────┴────────────────┘
```

## Etapas

### 1. Criar Edge Function `vendas-assistant`
- `supabase/functions/vendas-assistant/index.ts`
- Usa Lovable AI gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`)
- System prompt com instruções de vendas da 24help (baseado no contexto do `useClienteSignalsBeta` e no perfil da empresa)
- CORS, validação de input, tratamento de erros 429/402
- Sem streaming (resposta direta via `supabase.functions.invoke`)

### 2. Criar componente `VendasAssistant.tsx`
- `src/components/chat-beta/VendasAssistant.tsx`
- Chat simples: lista de mensagens user/assistant + textarea + botão enviar
- Botão "Colar conversa atual" que puxa as últimas mensagens do cliente automaticamente
- Indicador de loading
- Estilização consistente com o tema do Chat Beta

### 3. Integrar no ChatBeta
- Adicionar como aba ou toggle dentro do painel da COL 4 (junto com FichaPanel)
- Ou como drawer/coluna adicional colapsável
- Acessível apenas quando há um cliente selecionado

### 4. Remover/manter SkillVendasCoach
- Manter o `SkillVendasCoach` existente (heurística rápida, sem custo de IA)
- O `VendasAssistant` será complementar — o operador usa quando quer orientação mais profunda

## Detalhes técnicos

**Edge Function** usará:
```typescript
fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
  body: JSON.stringify({
    model: "google/gemini-3-flash-preview",
    messages: [{ role: "system", content: VENDAS_PROMPT }, ...userMessages]
  })
})
```

**System prompt** incluirá contexto de vendas de serviços residenciais (elétrica, hidráulica, etc.), técnicas de qualificação, urgência, e scripts de fechamento adaptados ao perfil 24help.

