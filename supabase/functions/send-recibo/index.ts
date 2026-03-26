import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { ficha_id, telefone_cliente } = await req.json();
    console.log(`[send-recibo] Iniciando para ficha: ${ficha_id}, tel: ${telefone_cliente}`);

    if (!ficha_id || !telefone_cliente) {
      return new Response(JSON.stringify({ error: "ficha_id e telefone_cliente obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Idempotência
    const { data: fichaFlag } = await supabase
      .from("fichas_de_servico")
      .select("recibo_enviado")
      .eq("id", ficha_id)
      .single();

    if (fichaFlag?.recibo_enviado) {
      console.log(`[send-recibo] Já enviado para ficha ${ficha_id}`);
      return new Response(JSON.stringify({ ok: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Buscar dados da ficha
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_de_servico")
      .select("nome_cliente, nome_ficha, valor_total")
      .eq("id", ficha_id)
      .single();

    if (fichaError || !ficha) {
      console.error("[send-recibo] Ficha não encontrada:", ficha_id);
      return new Response(JSON.stringify({ error: "Ficha não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Checar janela 24h
    const { data: lastMsg } = await supabase
      .from("mensagens")
      .select("data_hora")
      .eq("cliente_id", telefone_cliente)
      .eq("remetente", "cliente")
      .order("data_hora", { ascending: false })
      .limit(1)
      .maybeSingle();

    const dentroJanela = lastMsg?.data_hora
      ? Date.now() - new Date(lastMsg.data_hora).getTime() < 24 * 60 * 60 * 1000
      : false;

    const nomeCliente = ficha.nome_cliente || "Cliente";
    const nomeFicha = ficha.nome_ficha || ficha_id;
    const valorFormatado = Number(ficha.valor_total || 0).toFixed(2);

    // Credenciais Twilio
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER")!;
    const auth = btoa(`${twilioSid}:${twilioToken}`);
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;

    const whatsappTo = telefone_cliente.startsWith("whatsapp:") ? telefone_cliente : `whatsapp:${telefone_cliente}`;
    const whatsappFrom = `whatsapp:${twilioPhone}`;

    let messageSid = "";

    if (dentroJanela) {
      // Mensagem livre
      const mensagem = `✅ *Pagamento confirmado!*\n\n📋 Serviço: ${nomeFicha}\n💰 Valor: R$ ${valorFormatado}\n\nObrigado pela confiança, ${nomeCliente}! 🙏`;

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
        console.error("[send-recibo] Erro Twilio (livre):", resData);
        throw new Error(resData.message || "Erro Twilio");
      }
      messageSid = resData.sid;

      // Salvar mensagem no banco
      await supabase.from("mensagens").insert({
        cliente_id: whatsappTo,
        remetente: whatsappFrom,
        texto: mensagem,
        tipo: "texto",
        status: "enviado",
        data_hora: new Date().toISOString(),
        message_sid: messageSid,
        ficha_id,
        tipo_remetente: "sistema",
        operador_nome: "Sistema",
      });

      console.log(`[send-recibo] ✅ Mensagem livre enviada: ${messageSid}`);
    } else {
      // Template — buscar content_sid do template cadastrado
      const { data: template } = await supabase
        .from("whatsapp_templates")
        .select("content_sid")
        .eq("friendly_name", "recibo_confirmado")
        .maybeSingle();

      if (!template?.content_sid) {
        console.warn("[send-recibo] ⚠️ Template 'recibo_confirmado' não encontrado. Recibo não enviado fora da janela 24h.");
        // Ainda marca como enviado para não ficar em loop
      } else {
        const contentVars = JSON.stringify({
          "1": nomeCliente,
          "2": nomeFicha,
          "3": `R$ ${valorFormatado}`,
        });

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
          console.error("[send-recibo] Erro Twilio (template):", resData);
          throw new Error(resData.message || "Erro Twilio template");
        }
        messageSid = resData.sid;

        // Salvar no banco
        await supabase.from("mensagens").insert({
          cliente_id: whatsappTo,
          remetente: whatsappFrom,
          texto: `✅ Pagamento confirmado! Serviço: ${nomeFicha} — Valor: R$ ${valorFormatado}`,
          tipo: "texto",
          status: "enviado",
          data_hora: new Date().toISOString(),
          message_sid: messageSid,
          ficha_id,
          tipo_remetente: "sistema",
          operador_nome: "Sistema",
        });

        console.log(`[send-recibo] ✅ Template enviado: ${messageSid}`);
      }
    }

    // Marcar como enviado
    await supabase
      .from("fichas_de_servico")
      .update({ recibo_enviado: true, recibo_enviado_em: new Date().toISOString() })
      .eq("id", ficha_id);

    return new Response(
      JSON.stringify({ ok: true, message_sid: messageSid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-recibo] 💥 Erro:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
