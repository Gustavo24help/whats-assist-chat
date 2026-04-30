import { createClient } from "npm:@supabase/supabase-js@2";
import { sanitizeAsaasName, sanitizeAsaasDescription } from "../_shared/sanitizeAsaas.ts";
import { createFichaLogger } from "../_shared/fichaLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_URL = "https://api.asaas.com/v3";

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
    console.warn("[auto-finalizacao] ⚠️ Erro ao registrar audit:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[auto-finalizacao] 🚀 Iniciando automação de finalização");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { ficha_id } = await req.json();

    if (!ficha_id) {
      console.error("[auto-finalizacao] ❌ ficha_id não fornecido");
      return new Response(
        JSON.stringify({ error: "ficha_id obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[auto-finalizacao] 📋 Processando ficha: ${ficha_id}`);
    const fichaLog = createFichaLogger(supabase, { ficha_id, source: "auto-finalizacao" });
    await fichaLog.info("🚀 Auto-finalização iniciada");
    await logAudit(supabase, ficha_id, "auto_finalizacao", "started");

    // Buscar dados da ficha
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_de_servico")
      .select("id, nome_cliente, nome_ficha, valor_total, telefone_cliente, pagamento_gerar_link, pagamento_link, pagamento_realizado, pagamento_tipo, pagamento_parcelas, descricao, status")
      .eq("id", ficha_id)
      .single();

    if (fichaError || !ficha) {
      console.error(`[auto-finalizacao] ❌ Ficha ${ficha_id} não encontrada:`, fichaError?.message);
      await fichaLog.error("Ficha não encontrada", { detalhes: { error: fichaError?.message } });
      await logAudit(supabase, ficha_id, "auto_finalizacao", "error", "Ficha não encontrada");
      return new Response(
        JSON.stringify({ error: "Ficha não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    fichaLog.setContext({ cliente_telefone: ficha.telefone_cliente });

    // Verificar se status é Finalizado
    if (ficha.status !== "Finalizado") {
      console.log(`[auto-finalizacao] ⏭️ Ficha ${ficha_id} não está em status Finalizado (status: ${ficha.status})`);
      await logAudit(supabase, ficha_id, "auto_finalizacao", "skipped", `Status não permitido: ${ficha.status}`);
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "status_nao_permitido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se pagamento já realizado, pular
    if (ficha.pagamento_realizado) {
      console.log(`[auto-finalizacao] ⏭️ Ficha ${ficha_id} já tem pagamento realizado`);
      await logAudit(supabase, ficha_id, "auto_finalizacao", "skipped", "Já pago");
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "ja_pago" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const valorTotal = Number(ficha.valor_total || 0);
    if (valorTotal <= 0) {
      console.log(`[auto-finalizacao] ⏭️ Ficha ${ficha_id} sem valor total definido`);
      await logAudit(supabase, ficha_id, "auto_finalizacao", "skipped", "Sem valor total");
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "sem_valor" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let paymentUrl = ficha.pagamento_link;
    let asaasLinkCreated = false;

    // ========== ETAPA 1: Criar link de pagamento (se não existe) ==========
    if (!paymentUrl && ficha.pagamento_gerar_link !== false && asaasApiKey) {
      console.log(`[auto-finalizacao] 💳 Criando link de pagamento no Asaas...`);

      const parcelas = ficha.pagamento_parcelas || 1;
      let billingType = "UNDEFINED";
      if (ficha.pagamento_tipo === "pix") billingType = "PIX";
      else if (ficha.pagamento_tipo === "cartao_credito") billingType = "CREDIT_CARD";
      else if (ficha.pagamento_tipo === "boleto") billingType = "BOLETO";
      if (parcelas > 1 && billingType !== "CREDIT_CARD") billingType = "UNDEFINED";

      // Sanitiza nome/descrição: Asaas rejeita Unicode estilizado (𝓟, etc.)
      const nomeClienteSanitizado = sanitizeAsaasName(ficha.nome_cliente, "Cliente");
      const descricaoSanitizada = sanitizeAsaasDescription(ficha.descricao, `Servico ${ficha_id}`);
      const asaasPayload = {
        name: `${ficha_id} - ${nomeClienteSanitizado}`,
        description: descricaoSanitizada || `Servico ${ficha_id}`,
        value: valorTotal,
        billingType,
        chargeType: "DETACHED",
        dueDateLimitDays: 30,
        externalReference: ficha_id,
        maxInstallmentCount: parcelas > 1 ? parcelas : 1,
      };

      try {
        const asaasRes = await fetch(`${ASAAS_API_URL}/paymentLinks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            access_token: asaasApiKey,
          },
          body: JSON.stringify(asaasPayload),
        });

        const asaasData = await asaasRes.json();

        if (asaasRes.ok && asaasData.url) {
          paymentUrl = asaasData.url;
          asaasLinkCreated = true;
          console.log(`[auto-finalizacao] ✅ Link Asaas criado: ${paymentUrl}`);

          await supabase
            .from("fichas_de_servico")
            .update({ pagamento_link: paymentUrl })
            .eq("id", ficha_id);
        } else {
          console.error(`[auto-finalizacao] ⚠️ Erro Asaas:`, JSON.stringify(asaasData));
          await logAudit(supabase, ficha_id, "auto_finalizacao", "error", `Erro Asaas: ${JSON.stringify(asaasData).substring(0, 500)}`);
        }
      } catch (asaasErr) {
        console.error(`[auto-finalizacao] ⚠️ Exceção Asaas:`, asaasErr);
        await logAudit(supabase, ficha_id, "auto_finalizacao", "error", `Exceção Asaas: ${asaasErr}`);
      }
    }

    if (!paymentUrl) {
      console.log(`[auto-finalizacao] ⏭️ Sem link de pagamento para enviar`);
      await logAudit(supabase, ficha_id, "auto_finalizacao", "skipped", "Sem link de pagamento");
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "sem_link_pagamento" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ETAPA 2: Verificar janela de 24h ==========
    const telefone = ficha.telefone_cliente;
    const { data: recentMsgs } = await supabase
      .from("mensagens")
      .select("data_hora, remetente")
      .eq("cliente_id", telefone)
      .not("data_hora", "is", null)
      .order("data_hora", { ascending: false })
      .limit(20);

    const ultimaMsgCliente = recentMsgs?.find(
      (msg: any) => msg.data_hora && (msg.remetente === "cliente" || msg.remetente === telefone)
    );

    const now = new Date();
    const ultimaInteracao = ultimaMsgCliente?.data_hora ? new Date(ultimaMsgCliente.data_hora) : null;
    const diffHoras = ultimaInteracao
      ? (now.getTime() - ultimaInteracao.getTime()) / (1000 * 60 * 60)
      : 25;
    const dentroJanela = diffHoras < 24;

    const nomeCliente = ficha.nome_cliente || "Cliente";
    const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorTotal);
    const auth = btoa(`${twilioSid}:${twilioToken}`);
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const whatsappTo = telefone.startsWith("whatsapp:") ? telefone : `whatsapp:${telefone}`;
    const whatsappFrom = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;

    let messageSid = "";

    // ========== ETAPA 3: Enviar mensagem ==========
    if (dentroJanela) {
      const mensagem = `Segue o link para pagamento do serviço ${ficha.nome_ficha || ficha_id} no valor de ${valorFormatado}:\n\n${paymentUrl}\n\nQualquer dúvida estamos à disposição! 😊`;

      const body = new URLSearchParams();
      body.append("To", whatsappTo);
      body.append("From", whatsappFrom);
      body.append("Body", mensagem);
      body.append("StatusCallback", `${supabaseUrl}/functions/v1/update-message-status`);

      const res = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const resData = await res.json();
      if (!res.ok) {
        console.error("[auto-finalizacao] ❌ Erro Twilio (livre):", resData);
        await logAudit(supabase, ficha_id, "auto_finalizacao", "error", `Erro Twilio: ${resData.message}`);
        throw new Error(resData.message || "Erro Twilio");
      }
      messageSid = resData.sid;

      await supabase.from("mensagens").insert({
        cliente_id: telefone,
        remetente: whatsappFrom,
        texto: mensagem,
        tipo: "texto",
        status: "enviado",
        data_hora: new Date().toISOString(),
        message_sid: messageSid,
        ficha_id: ficha_id,
        tipo_remetente: "sistema",
        operador_nome: "Sistema (Auto)",
      });

      console.log(`[auto-finalizacao] ✅ Link enviado via mensagem livre: ${messageSid}`);
    } else {
      console.log(`[auto-finalizacao] ⏰ Fora da janela 24h (${diffHoras.toFixed(1)}h). Usando template.`);

      const { data: template } = await supabase
        .from("whatsapp_templates")
        .select("content_sid")
        .eq("friendly_name", "aviso_pagamento_3")
        .maybeSingle();

      if (!template?.content_sid) {
        console.warn("[auto-finalizacao] ⚠️ Template 'aviso_pagamento_3' não encontrado");
        const logEntry = `[${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}] ⚠️ Auto-envio de link de pagamento falhou: fora da janela 24h e template não configurado. Link: ${paymentUrl}`;
        const { data: fichaNotas } = await supabase
          .from("fichas_de_servico")
          .select("notas")
          .eq("id", ficha_id)
          .single();
        await supabase
          .from("fichas_de_servico")
          .update({ notas: fichaNotas?.notas ? `${fichaNotas.notas}\n${logEntry}` : logEntry })
          .eq("id", ficha_id);
      } else {
        const contentVars = JSON.stringify({ "1": nomeCliente });

        const body = new URLSearchParams();
        body.append("To", whatsappTo);
        body.append("From", whatsappFrom);
        body.append("ContentSid", template.content_sid);
        body.append("ContentVariables", contentVars);
        body.append("StatusCallback", `${supabaseUrl}/functions/v1/update-message-status`);

        const res = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        const resData = await res.json();
        if (!res.ok) {
          console.error("[auto-finalizacao] ❌ Erro Twilio (template):", resData);
          await logAudit(supabase, ficha_id, "auto_finalizacao", "error", `Erro Twilio template: ${resData.message}`);
          throw new Error(resData.message || "Erro Twilio template");
        }
        messageSid = resData.sid;

        await supabase.from("mensagens").insert({
          cliente_id: telefone,
          remetente: whatsappFrom,
          texto: `[Template] Aviso de pagamento enviado para ${nomeCliente}. Link: ${paymentUrl}`,
          tipo: "texto",
          status: "enviado",
          data_hora: new Date().toISOString(),
          message_sid: messageSid,
          ficha_id: ficha_id,
          tipo_remetente: "sistema",
          operador_nome: "Sistema (Auto)",
        });

        console.log(`[auto-finalizacao] ✅ Template enviado: ${messageSid}`);
      }
    }

    // ========== ETAPA 4: Registrar conta a receber (UPSERT por ficha_id) ==========
    // Check if conta already exists for this ficha
    const { data: contaExistente } = await supabase
      .from("contas_receber")
      .select("id")
      .eq("ficha_id", ficha_id)
      .maybeSingle();

    if (contaExistente) {
      // Update existing
      await supabase
        .from("contas_receber")
        .update({
          valor_total: valorTotal,
          pagamento_link: paymentUrl,
          status: "aguardando",
          requer_template: !dentroJanela,
          link_enviado_em: new Date().toISOString(),
          cliente_nome: nomeCliente,
        })
        .eq("id", contaExistente.id);
      console.log(`[auto-finalizacao] ✅ Conta a receber atualizada (existente): ${contaExistente.id}`);
    } else {
      const { error: contaError } = await supabase.from("contas_receber").insert({
        ficha_id: ficha_id,
        cliente_telefone: telefone,
        cliente_nome: nomeCliente,
        valor_total: valorTotal,
        pagamento_link: paymentUrl,
        status: "aguardando",
        requer_template: !dentroJanela,
        link_enviado_em: new Date().toISOString(),
      });
      if (contaError) {
        console.warn("[auto-finalizacao] ⚠️ Erro ao criar conta a receber:", contaError.message);
      } else {
        console.log(`[auto-finalizacao] ✅ Conta a receber criada`);
      }
    }

    // Log nas notas da ficha + contadores de envio
    const logEntry = `[${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}] 🤖 Link de pagamento enviado automaticamente ao finalizar. ${dentroJanela ? "Via mensagem livre" : "Via template (fora 24h)"}. Link: ${paymentUrl}`;
    const { data: fichaAtual } = await supabase
      .from("fichas_de_servico")
      .select("notas, link_pagamento_envio_count")
      .eq("id", ficha_id)
      .single();
    const novoCount = (fichaAtual?.link_pagamento_envio_count || 0) + 1;
    await supabase
      .from("fichas_de_servico")
      .update({
        notas: fichaAtual?.notas ? `${fichaAtual.notas}\n${logEntry}` : logEntry,
        link_pagamento_envio_count: novoCount,
        link_pagamento_ultimo_envio_em: new Date().toISOString(),
        link_pagamento_ultimo_envio_origem: "automatico",
        link_pagamento_ultimo_envio_por: null,
      })
      .eq("id", ficha_id);

    const duration = Date.now() - startTime;
    await logAudit(supabase, ficha_id, "auto_finalizacao", "success", `Link: ${paymentUrl}, SID: ${messageSid}, Janela: ${dentroJanela}`);
    console.log(`[auto-finalizacao] ✅ Concluído em ${duration}ms — Ficha: ${ficha_id}`);

    return new Response(
      JSON.stringify({
        ok: true,
        ficha_id,
        payment_url: paymentUrl,
        asaas_link_created: asaasLinkCreated,
        dentro_janela: dentroJanela,
        message_sid: messageSid,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[auto-finalizacao] 💥 Erro:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
