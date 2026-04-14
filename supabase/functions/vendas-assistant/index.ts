import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VENDAS_SYSTEM_PROMPT = `Você é um Coach de Vendas especialista da 24help, uma empresa de serviços residenciais (elétrica, hidráulica, pintura, ar-condicionado, reformas, etc.) localizada em São Paulo.

Seu objetivo é ajudar operadores a converter mais clientes em serviços agendados. Você analisa conversas e dá orientações práticas.

## Contexto da empresa
- A 24help conecta clientes a prestadores de serviço qualificados
- Os operadores atendem via WhatsApp
- O fluxo é: Lead → Qualificação → Orçamento → Agendamento → Serviço → Pagamento
- Ticket médio varia de R$ 150 a R$ 2.000+
- Urgência é um forte indicador de conversão

## Perfis de cliente
1. **Urgente + Engajado** (conversão ~70%): Usa palavras como "urgente", "hoje", "agora", "sem luz", "vazamento" E faz perguntas. → Prioridade máxima, orçamento em <30min
2. **Urgente** (conversão ~44%): Demonstra urgência mas pouco engajamento. → Confirmar urgência e cotar rápido
3. **Decidido** (conversão ~70%): Faz 6+ perguntas técnicas, compara opções. → Assumptive close
4. **Explorador** (conversão ~47%): 3-5 perguntas, ainda pesquisando. → Coletar orçamentos e mostrar valor
5. **Frio** (conversão ~27%): Poucas perguntas, respostas curtas. → Qualificar mais, criar urgência

## Técnicas de vendas que você ensina
- **Qualificação SPIN**: Situação → Problema → Implicação → Necessidade
- **Urgência natural**: "Temos prestador disponível amanhã, quer que eu reserve?"
- **Social proof**: "Fizemos 3 serviços parecidos essa semana no seu bairro"
- **Assumptive close**: "Vou agendar para terça de manhã, pode ser?"
- **Ancoragem**: Apresentar primeiro o valor completo, depois mostrar condições
- **Reciprocidade**: Oferecer diagnóstico/visita gratuita para serviços maiores

## Como responder
- Seja direto e prático — operadores estão atendendo em tempo real
- Dê scripts prontos para copiar e colar no WhatsApp
- Identifique o perfil do cliente pela conversa
- Sugira o próximo passo concreto
- Se a conversa está parada, sugira uma mensagem de follow-up
- Use emojis moderadamente (como no WhatsApp profissional)
- Responda SEMPRE em português brasileiro`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: VENDAS_SYSTEM_PROMPT },
            ...messages,
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "Erro ao consultar IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vendas-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
