import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[asaas-webhook] Nova requisição recebida");

  try {
    // Validar token de autenticação do Asaas (opcional, mas recomendado)
    const asaasToken = req.headers.get("asaas-access-token");
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    
    if (expectedToken && asaasToken !== expectedToken) {
      console.error("[asaas-webhook] ❌ Token inválido");
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { event, payment } = body;

    console.log(`[asaas-webhook] 📩 Evento: ${event}, Payment ID: ${payment?.id}`);

    // Apenas processar eventos de pagamento confirmado/recebido
    const paymentEvents = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];
    if (!paymentEvents.includes(event)) {
      console.log(`[asaas-webhook] ⏭️ Evento ${event} ignorado (não é confirmação de pagamento)`);
      return new Response(
        JSON.stringify({ success: true, ignored: true, event }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payment) {
      console.error("[asaas-webhook] ❌ Payload sem objeto payment");
      return new Response(
        JSON.stringify({ error: "Payload inválido - sem payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Estratégia 1: Extrair ficha_id do campo "description" ou "externalReference" do pagamento
    // O create-payment-link salva com name: `${ficha_id} - ${nome_cliente}`
    let fichaId: string | null = null;

    // Tentar pelo externalReference (se configurado)
    if (payment.externalReference) {
      fichaId = payment.externalReference;
      console.log(`[asaas-webhook] 🔍 Ficha encontrada via externalReference: ${fichaId}`);
    }

    // Tentar pelo nome do link de pagamento (formato: "FS1-250101 - Cliente")
    if (!fichaId && payment.description) {
      const match = payment.description.match(/^(F[A-Z0-9@\\-]+)\s*-/);
      if (match) {
        fichaId = match[1];
        console.log(`[asaas-webhook] 🔍 Ficha extraída da description: ${fichaId}`);
      }
    }

    // Estratégia 2: Buscar pela URL do link de pagamento no banco
    if (!fichaId && payment.paymentLink) {
      // O Asaas envia o ID do paymentLink, precisamos buscar pela URL
      const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
      if (asaasApiKey) {
        try {
          const linkRes = await fetch(`https://api.asaas.com/v3/paymentLinks/${payment.paymentLink}`, {
            headers: { "access_token": asaasApiKey },
          });
          if (linkRes.ok) {
            const linkData = await linkRes.json();
            const linkUrl = linkData.url;
            console.log(`[asaas-webhook] 🔍 URL do link: ${linkUrl}`);
            
            if (linkUrl) {
              const { data: fichaByLink } = await supabase
                .from("fichas_de_servico")
                .select("id")
                .eq("pagamento_link", linkUrl)
                .maybeSingle();
              
              if (fichaByLink) {
                fichaId = fichaByLink.id;
                console.log(`[asaas-webhook] 🔍 Ficha encontrada via link URL: ${fichaId}`);
              }
            }

            // Tentar pelo name do link (formato: "FS1-250101 - Cliente")
            if (!fichaId && linkData.name) {
              const match = linkData.name.match(/^(F[A-Z0-9@\\-]+)\s*-/);
              if (match) {
                fichaId = match[1];
                console.log(`[asaas-webhook] 🔍 Ficha extraída do name do link: ${fichaId}`);
              }
            }
          }
        } catch (e) {
          console.error("[asaas-webhook] ⚠️ Erro ao buscar link no Asaas:", e);
        }
      }
    }

    if (!fichaId) {
      console.error("[asaas-webhook] ❌ Não foi possível identificar a ficha de serviço");
      console.error("[asaas-webhook] Payment data:", JSON.stringify(payment).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "Ficha não identificada", payment_id: payment.id }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se a ficha existe e se já está paga
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_de_servico")
      .select("id, pagamento_realizado, notas, nome_cliente, valor_total, telefone_cliente")
      .eq("id", fichaId)
      .maybeSingle();

    if (fichaError || !ficha) {
      console.error(`[asaas-webhook] ❌ Ficha ${fichaId} não encontrada`);
      return new Response(
        JSON.stringify({ error: "Ficha não encontrada", ficha_id: fichaId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (ficha.pagamento_realizado) {
      console.log(`[asaas-webhook] ⏭️ Ficha ${fichaId} já está marcada como paga`);
      return new Response(
        JSON.stringify({ success: true, already_paid: true, ficha_id: fichaId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ATUALIZAR: marcar pagamento como realizado
    const agora = new Date().toISOString();
    const valorPago = payment.value || ficha.valor_total || 0;
    const logEntry = `[${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}] ✅ Pagamento confirmado automaticamente via Asaas (${event}) — Valor: R$ ${valorPago.toFixed(2)} — Payment ID: ${payment.id}`;
    const notasAtualizadas = ficha.notas ? `${ficha.notas}\n${logEntry}` : logEntry;

    const { error: updateError } = await supabase
      .from("fichas_de_servico")
      .update({
        pagamento_realizado: true,
        notas: notasAtualizadas,
      })
      .eq("id", fichaId);

    if (updateError) {
      console.error(`[asaas-webhook] ❌ Erro ao atualizar ficha: ${updateError.message}`);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar ficha", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[asaas-webhook] ✅ Ficha ${fichaId} marcada como paga automaticamente`);

    // Disparar envio de recibo via WhatsApp (fire-and-forget)
    try {
      const reciboRes = await fetch(`${supabaseUrl}/functions/v1/send-recibo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ficha_id: fichaId,
          telefone_cliente: `whatsapp:${ficha.nome_cliente ? '' : ''}${payment.customer || ''}`.includes('whatsapp:')
            ? payment.customer
            : fichaId, // fallback - será resolvido abaixo
        }),
      });
      console.log(`[asaas-webhook] 📨 send-recibo status: ${reciboRes.status}`);
    } catch (reciboErr) {
      console.warn("[asaas-webhook] ⚠️ Erro ao disparar send-recibo:", reciboErr);
    }

    // Atualizar transação financeira (se existir)
    const { error: transError } = await supabase
      .from("transacoes_financeiras")
      .update({
        status_pagamento_cliente: "pago",
        data_pagamento_realizada: agora,
      })
      .eq("ficha_id", fichaId);

    if (transError) {
      console.warn(`[asaas-webhook] ⚠️ Erro ao atualizar transação (pode não existir): ${transError.message}`);
    } else {
      console.log(`[asaas-webhook] ✅ Transação financeira atualizada para ficha ${fichaId}`);
    }

    // Disparar webhook para planilha (sync com Make.com)
    try {
      const webhookUrl = Deno.env.get("MAKE_WEBHOOK_UPDATE_PLANILHA");
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "pagamento_cliente_confirmado",
            ficha_id: fichaId,
            valor_pago: valorPago,
            data_pagamento: agora,
            origem: "asaas_webhook",
            payment_id: payment.id,
            event,
          }),
        });
        console.log(`[asaas-webhook] ✅ Webhook planilha disparado`);
      }
    } catch (e) {
      console.warn("[asaas-webhook] ⚠️ Erro ao disparar webhook planilha:", e);
    }

    const duration = Date.now() - startTime;
    console.log(`[asaas-webhook] ✅ Concluído em ${duration}ms — Ficha: ${fichaId}`);

    return new Response(
      JSON.stringify({
        success: true,
        ficha_id: fichaId,
        event,
        valor_pago: valorPago,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[asaas-webhook] 💥 Erro interno:", err);
    return new Response(
      JSON.stringify({
        error: "Erro interno",
        details: err instanceof Error ? err.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
