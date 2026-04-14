import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

async function logAudit(
  supabase: any,
  fichaId: string,
  etapa: string,
  status: string,
  detalhe?: string,
  paymentId?: string
) {
  try {
    await supabase.from("automation_audit").insert({
      ficha_id: fichaId,
      etapa,
      status,
      detalhe: detalhe?.substring(0, 1000),
      payment_id: paymentId,
    });
  } catch (e) {
    console.warn("[asaas-webhook] ⚠️ Erro ao registrar audit:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[asaas-webhook] Nova requisição recebida");

  try {
    // Validar token de autenticação do Asaas
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
      console.log(`[asaas-webhook] ⏭️ Evento ${event} ignorado`);
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

    // ========== IDEMPOTÊNCIA: verificar se já processamos este payment.id ==========
    const { data: auditExistente } = await supabase
      .from("automation_audit")
      .select("id")
      .eq("etapa", "webhook_pagamento")
      .eq("status", "success")
      .eq("payment_id", payment.id)
      .maybeSingle();

    if (auditExistente) {
      console.log(`[asaas-webhook] ⏭️ Payment ${payment.id} já processado (idempotência)`);
      return new Response(
        JSON.stringify({ success: true, already_processed: true, payment_id: payment.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== Identificar ficha ==========
    let fichaId: string | null = null;

    // Estratégia 1: externalReference
    if (payment.externalReference) {
      fichaId = payment.externalReference;
      console.log(`[asaas-webhook] 🔍 Ficha via externalReference: ${fichaId}`);
    }

    // Estratégia 2: description regex
    if (!fichaId && payment.description) {
      const match = payment.description.match(/^(F[A-Z0-9@\\-]+)\s*-/);
      if (match) {
        fichaId = match[1];
        console.log(`[asaas-webhook] 🔍 Ficha via description: ${fichaId}`);
      }
    }

    // Estratégia 3: paymentLink API lookup
    if (!fichaId && payment.paymentLink) {
      const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
      if (asaasApiKey) {
        try {
          const linkRes = await fetch(`https://api.asaas.com/v3/paymentLinks/${payment.paymentLink}`, {
            headers: { "access_token": asaasApiKey },
          });
          if (linkRes.ok) {
            const linkData = await linkRes.json();
            const linkUrl = linkData.url;

            if (linkUrl) {
              const { data: fichaByLink } = await supabase
                .from("fichas_de_servico")
                .select("id")
                .eq("pagamento_link", linkUrl)
                .maybeSingle();
              if (fichaByLink) {
                fichaId = fichaByLink.id;
                console.log(`[asaas-webhook] 🔍 Ficha via link URL: ${fichaId}`);
              }
            }

            if (!fichaId && linkData.name) {
              const match = linkData.name.match(/^(F[A-Z0-9@\\-]+)\s*-/);
              if (match) {
                fichaId = match[1];
                console.log(`[asaas-webhook] 🔍 Ficha via name do link: ${fichaId}`);
              }
            }
          }
        } catch (e) {
          console.error("[asaas-webhook] ⚠️ Erro ao buscar link no Asaas:", e);
        }
      }
    }

    if (!fichaId) {
      console.error("[asaas-webhook] ❌ Ficha não identificada");
      console.error("[asaas-webhook] Payment data:", JSON.stringify(payment).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "Ficha não identificada", payment_id: payment.id }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await logAudit(supabase, fichaId, "webhook_pagamento", "started", `Event: ${event}`, payment.id);

    // ========== Verificar ficha ==========
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_de_servico")
      .select("id, pagamento_realizado, notas, nome_cliente, valor_total, telefone_cliente, status")
      .eq("id", fichaId)
      .maybeSingle();

    if (fichaError || !ficha) {
      console.error(`[asaas-webhook] ❌ Ficha ${fichaId} não encontrada`);
      await logAudit(supabase, fichaId, "webhook_pagamento", "error", "Ficha não encontrada", payment.id);
      return new Response(
        JSON.stringify({ error: "Ficha não encontrada", ficha_id: fichaId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (ficha.pagamento_realizado) {
      console.log(`[asaas-webhook] ⏭️ Ficha ${fichaId} já está marcada como paga`);
      await logAudit(supabase, fichaId, "webhook_pagamento", "skipped", "Já pago", payment.id);
      return new Response(
        JSON.stringify({ success: true, already_paid: true, ficha_id: fichaId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ATUALIZAR FICHA ==========
    const agora = new Date().toISOString();
    const valorPago = payment.value || ficha.valor_total || 0;
    const logEntry = `[${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}] ✅ Pagamento confirmado automaticamente via Asaas (${event}) — Valor: R$ ${valorPago.toFixed(2)} — Payment ID: ${payment.id}`;
    const notasAtualizadas = ficha.notas ? `${ficha.notas}\n${logEntry}` : logEntry;

    const updatePayload: Record<string, unknown> = {
      pagamento_realizado: true,
      notas: notasAtualizadas,
    };

    // Mudar para Garantia se status elegível
    const statusParaGarantia = ['Finalizado', 'Em andamento', 'Agendado'];
    if (statusParaGarantia.includes(ficha.status as string)) {
      updatePayload.status = 'Garantia';
      console.log(`[asaas-webhook] 🔄 Status mudado para Garantia (era: ${ficha.status})`);
    }

    const { error: updateError } = await supabase
      .from("fichas_de_servico")
      .update(updatePayload)
      .eq("id", fichaId);

    if (updateError) {
      console.error(`[asaas-webhook] ❌ Erro ao atualizar ficha: ${updateError.message}`);
      await logAudit(supabase, fichaId, "webhook_pagamento", "error", `Erro update ficha: ${updateError.message}`, payment.id);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar ficha", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[asaas-webhook] ✅ Ficha ${fichaId} marcada como paga`);

    // ========== ATUALIZAR CONTAS A RECEBER ==========
    const { data: contaReceber } = await supabase
      .from("contas_receber")
      .select("id")
      .eq("ficha_id", fichaId)
      .maybeSingle();

    if (contaReceber) {
      const { error: contaError } = await supabase
        .from("contas_receber")
        .update({
          status: "pago",
          data_pagamento: agora.split("T")[0],
          asaas_id: payment.id,
          asaas_status: event,
        })
        .eq("id", contaReceber.id);

      if (contaError) {
        console.warn(`[asaas-webhook] ⚠️ Erro ao atualizar conta a receber: ${contaError.message}`);
      } else {
        console.log(`[asaas-webhook] ✅ Conta a receber atualizada para pago`);
      }
    } else {
      console.log(`[asaas-webhook] ℹ️ Nenhuma conta a receber encontrada para ficha ${fichaId}`);
    }

    // ========== ATUALIZAR TRANSAÇÃO FINANCEIRA ==========
    const { error: transError } = await supabase
      .from("transacoes_financeiras")
      .update({
        status_pagamento_cliente: "pago",
        data_pagamento_realizada: agora,
      })
      .eq("ficha_id", fichaId);

    if (transError) {
      console.warn(`[asaas-webhook] ⚠️ Erro ao atualizar transação: ${transError.message}`);
    } else {
      console.log(`[asaas-webhook] ✅ Transação financeira atualizada`);
    }

    // ========== DISPARAR ENVIO DE RECIBO ==========
    try {
      const reciboRes = await fetch(`${supabaseUrl}/functions/v1/send-recibo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          ficha_id: fichaId,
          telefone_cliente: ficha.telefone_cliente,
        }),
      });
      const reciboStatus = reciboRes.status;
      const reciboBody = await reciboRes.text();
      console.log(`[asaas-webhook] 📨 send-recibo status: ${reciboStatus}`);
      await logAudit(supabase, fichaId, "recibo", reciboStatus < 300 ? "success" : "error", `Status: ${reciboStatus}, Body: ${reciboBody.substring(0, 300)}`, payment.id);
    } catch (reciboErr) {
      console.warn("[asaas-webhook] ⚠️ Erro ao disparar send-recibo:", reciboErr);
      await logAudit(supabase, fichaId, "recibo", "error", `Exceção: ${reciboErr}`, payment.id);
    }

    // ========== WEBHOOK PLANILHA ==========
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
    await logAudit(supabase, fichaId, "webhook_pagamento", "success", `Valor: ${valorPago}, Event: ${event}, Duration: ${duration}ms`, payment.id);
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
