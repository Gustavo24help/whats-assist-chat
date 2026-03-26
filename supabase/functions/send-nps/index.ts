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
    console.log(`[send-nps] Iniciando para ficha: ${ficha_id}, tel: ${telefone_cliente}`);

    if (!ficha_id || !telefone_cliente) {
      return new Response(JSON.stringify({ error: "ficha_id e telefone_cliente obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Idempotência: não envia NPS duas vezes para a mesma ficha
    const { data: existing } = await supabase
      .from("nps_respostas")
      .select("id")
      .eq("ficha_id", ficha_id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`[send-nps] NPS já enviado para ficha ${ficha_id}`);
      return new Response(JSON.stringify({ ok: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Buscar dados da ficha
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_de_servico")
      .select("nome_cliente, nome_ficha, prestador_id")
      .eq("id", ficha_id)
      .single();

    if (fichaError || !ficha) {
      console.error("[send-nps] Ficha não encontrada:", ficha_id);
      return new Response(JSON.stringify({ error: "Ficha não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Criar registro NPS
    await supabase.from("nps_respostas").insert({
      ficha_id,
      telefone_cliente,
      prestador_id: ficha.prestador_id || null,
      enviado_em: new Date().toISOString(),
    });

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
      const mensagem = `Como foi seu serviço com a 24Help? 😊\n\n📋 Serviço: ${nomeFicha}\n\nResponda com uma nota de *0 a 10*. Sua opinião é muito importante para nós!`;

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
        console.error("[send-nps] Erro Twilio (livre):", resData);
        throw new Error(resData.message || "Erro Twilio");
      }
      messageSid = resData.sid;

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

      console.log(`[send-nps] ✅ Mensagem livre enviada: ${messageSid}`);
    } else {
      // Template
      const { data: template } = await supabase
        .from("whatsapp_templates")
        .select("content_sid")
        .eq("friendly_name", "nps_avaliacao")
        .maybeSingle();

      if (!template?.content_sid) {
        console.warn("[send-nps] ⚠️ Template 'nps_avaliacao' não encontrado. NPS não enviado fora da janela 24h.");
      } else {
        const contentVars = JSON.stringify({
          "1": nomeCliente,
          "2": nomeFicha,
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
          console.error("[send-nps] Erro Twilio (template):", resData);
          throw new Error(resData.message || "Erro Twilio template");
        }
        messageSid = resData.sid;

        await supabase.from("mensagens").insert({
          cliente_id: whatsappTo,
          remetente: whatsappFrom,
          texto: `Como foi seu serviço com a 24Help? Serviço: ${nomeFicha} — Responda com uma nota de 0 a 10.`,
          tipo: "texto",
          status: "enviado",
          data_hora: new Date().toISOString(),
          message_sid: messageSid,
          ficha_id,
          tipo_remetente: "sistema",
          operador_nome: "Sistema",
        });

        console.log(`[send-nps] ✅ Template enviado: ${messageSid}`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, message_sid: messageSid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-nps] 💥 Erro:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
