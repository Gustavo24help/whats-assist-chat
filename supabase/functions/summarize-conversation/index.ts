import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ficha_id } = await req.json();

    if (!ficha_id) {
      return new Response(
        JSON.stringify({ error: "ficha_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("📝 Gerando resumo para ficha:", ficha_id);

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Buscar dados da ficha
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_de_servico")
      .select("id, telefone_cliente, created_at, nome_ficha, status, descricao")
      .eq("id", ficha_id)
      .single();

    if (fichaError || !ficha) {
      console.error("❌ Erro ao buscar ficha:", fichaError);
      return new Response(
        JSON.stringify({ error: "Ficha não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("📋 Ficha encontrada:", {
      id: ficha.id,
      telefone: ficha.telefone_cliente,
      created_at: ficha.created_at,
    });

    // 2. Calcular início do período (00:00 do dia de criação da ficha)
    const fichaCreatedAt = new Date(ficha.created_at);
    const inicioPerido = new Date(fichaCreatedAt);
    inicioPerido.setHours(0, 0, 0, 0);
    const inicioPeriodoISO = inicioPerido.toISOString();

    console.log("📅 Período de busca - Início:", inicioPeriodoISO);

    // 3. Buscar próxima ficha do cliente (para delimitar o período)
    const { data: proximaFicha } = await supabase
      .from("fichas_de_servico")
      .select("id, created_at")
      .eq("telefone_cliente", ficha.telefone_cliente)
      .gt("created_at", ficha.created_at)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const fimPeriodoISO = proximaFicha?.created_at || new Date().toISOString();
    console.log("📅 Período de busca - Fim:", fimPeriodoISO);

    // 4. Buscar mensagens do período
    const { data: mensagens, error: mensagensError } = await supabase
      .from("mensagens")
      .select("id, texto, remetente, data_hora, tipo")
      .eq("cliente_id", ficha.telefone_cliente)
      .gte("data_hora", inicioPeriodoISO)
      .lte("data_hora", fimPeriodoISO)
      .order("data_hora", { ascending: true })
      .limit(150);

    if (mensagensError) {
      console.error("❌ Erro ao buscar mensagens:", mensagensError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar mensagens" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mensagens || mensagens.length === 0) {
      console.log("⚠️ Nenhuma mensagem encontrada no período");
      return new Response(
        JSON.stringify({
          resumo: null,
          mensagem: "Não há mensagens registradas para este período.",
          periodo: { inicio: inicioPeriodoISO, fim: fimPeriodoISO },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ ${mensagens.length} mensagens encontradas`);

    // 5. Formatar mensagens para o prompt
    const conversaFormatada = mensagens
      .map((msg) => {
        const dataHora = new Date(msg.data_hora).toLocaleString("pt-BR");
        const remetente = msg.remetente === "cliente" ? "CLIENTE" : "OPERADOR";
        const texto = msg.texto || `[${msg.tipo || "mídia"}]`;
        return `[${dataHora}] ${remetente}: ${texto}`;
      })
      .join("\n");

    // 6. Enviar para Lovable AI Gateway (Gemini 2.5 Flash)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("❌ LOVABLE_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Configuração de IA não encontrada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um assistente especializado em analisar conversas de atendimento ao cliente de uma empresa de serviços residenciais (manutenção, montagem, instalação).

Sua tarefa é criar um resumo ESTRUTURADO e OBJETIVO da conversa para facilitar a transferência de atendimento entre operadores.

IMPORTANTE:
- Seja direto e conciso
- Use frases curtas
- Extraia apenas informações relevantes
- Se algo não foi mencionado, indique "Não informado"
- Foque em dados acionáveis

Gere o resumo em português brasileiro com as seguintes seções:

## 📝 PROBLEMA RELATADO
O que o cliente precisa? Qual é a demanda principal?

## 📷 INFORMAÇÕES COLETADAS
- Endereço ou localização
- Disponibilidade do cliente
- Fotos ou documentos enviados
- Outras informações relevantes

## 💰 ORÇAMENTO
- Valor discutido (se houver)
- Status: aprovado/pendente/rejeitado/não enviado
- Forma de pagamento mencionada

## ✅ DECISÕES TOMADAS
O que foi acordado entre as partes?

## ⏳ PENDÊNCIAS
O que ainda precisa ser resolvido ou acompanhado?

## 📊 ÚLTIMA INTERAÇÃO
Data/hora aproximada e assunto da última mensagem relevante.`;

    const userPrompt = `Analise a seguinte conversa e gere o resumo estruturado:

FICHA: ${ficha.nome_ficha || ficha.id}
STATUS ATUAL: ${ficha.status || "Não definido"}
DESCRIÇÃO: ${ficha.descricao || "Sem descrição"}

=== CONVERSA ===
${conversaFormatada}
=== FIM DA CONVERSA ===

Gere o resumo seguindo o formato especificado.`;

    console.log("🤖 Enviando para IA...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorStatus = aiResponse.status;
      if (errorStatus === 429) {
        console.error("❌ Rate limit excedido");
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (errorStatus === 402) {
        console.error("❌ Créditos insuficientes");
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("❌ Erro na IA:", errorStatus, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar resumo com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const resumo = aiData.choices?.[0]?.message?.content;

    if (!resumo) {
      console.error("❌ Resposta da IA sem conteúdo");
      return new Response(
        JSON.stringify({ error: "Resposta da IA vazia" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Resumo gerado com sucesso");

    return new Response(
      JSON.stringify({
        resumo,
        periodo: {
          inicio: inicioPeriodoISO,
          fim: fimPeriodoISO,
        },
        total_mensagens: mensagens.length,
        ficha: {
          id: ficha.id,
          nome: ficha.nome_ficha,
          status: ficha.status,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
