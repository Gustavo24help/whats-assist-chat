import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NUMERO_24HELP_PRODUCAO = "whatsapp:+554138911555";
const NUMERO_24HELP_SANDBOX = "whatsapp:+14155238886";

async function fetchTwilioMessageDate(messageSid: string, requestId: string): Promise<string | null> {
  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!accountSid || !authToken || !messageSid) return null;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}.json`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}` },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.date_sent) {
        const dateSent = new Date(data.date_sent).toISOString();
        console.log(`[${requestId}] 📅 DateSent real da Twilio: ${dateSent}`);
        return dateSent;
      }
    } else {
      console.log(`[${requestId}] ⚠️ Erro ao buscar DateSent: ${response.status}`);
    }
  } catch (e) {
    console.log(`[${requestId}] ⚠️ Falha ao buscar DateSent: ${e}`);
  }
  return null;
}

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📤 [${requestId}] STATUS CALLBACK INICIADO - ${new Date().toISOString()}`);
  console.log(`${"=".repeat(80)}\n`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const rawBody = await req.text();

    let formData: FormData;
    const reqClone = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: rawBody,
    });

    try {
      formData = await reqClone.formData();
    } catch (e) {
      console.log(`[${requestId}] ⚠️ Não foi FormData, tentando JSON...`);
      const jsonData = JSON.parse(rawBody);
      formData = new FormData();
      for (const [key, value] of Object.entries(jsonData)) {
        formData.append(key, String(value));
      }
    }

    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const body = (formData.get("Body") as string) || "";
    const messageSid = formData.get("MessageSid") as string;
    const numMedia = parseInt(formData.get("NumMedia") as string || "0", 10);

    console.log(`[${requestId}] 📤 From: ${from}`);
    console.log(`[${requestId}] 📤 To: ${to}`);
    console.log(`[${requestId}] 📤 MessageSid: ${messageSid}`);
    console.log(`[${requestId}] 💬 Body: ${body?.substring(0, 100)}`);
    console.log(`[${requestId}] 📎 NumMedia: ${numMedia}`);

    // Log debug
    await supabase.from("webhook_debug_logs").insert({
      timestamp: new Date().toISOString(),
      source: "twilio_status_callback",
      event_type: "callback_received",
      message_sid: messageSid,
      client_phone: to,
      success: true,
      error_message: null,
      step: "RECEIVED",
      processed_data: { from, to, body: body?.substring(0, 200), messageSid, numMedia },
    });

    // Ignorar mensagens de teste (from = to)
    if (from === to) {
      console.log(`[${requestId}] ⚠️ Mensagem de teste ou loop, ignorando`);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    // Verificar duplicidade por message_sid
    if (messageSid) {
      const { data: existing } = await supabase
        .from("mensagens")
        .select("id")
        .eq("message_sid", messageSid)
        .maybeSingle();

      if (existing) {
        console.log(`[${requestId}] ⚠️ Mensagem já existe (SID: ${messageSid}), ignorando`);
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
        });
      }
    }

    // Detectar direção da mensagem
    let cliente_id: string;
    let remetente: string;
    let isMensagemDoBot = false;

    if (from === NUMERO_24HELP_PRODUCAO || from === NUMERO_24HELP_SANDBOX) {
      console.log(`[${requestId}] 🤖 Mensagem DO BOT para cliente`);
      cliente_id = to;
      remetente = from;
      isMensagemDoBot = true;
    } else if (to === NUMERO_24HELP_PRODUCAO || to === NUMERO_24HELP_SANDBOX) {
      console.log(`[${requestId}] 👤 Mensagem DO CLIENTE para bot`);
      cliente_id = from;
      remetente = from;
      isMensagemDoBot = false;
    } else {
      console.log(`[${requestId}] ⚠️ Mensagem não é do fluxo bot↔cliente, ignorando`);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    // Buscar cliente
    const { data: cliente } = await supabase
      .from("clientes")
      .select("telefone")
      .eq("telefone", cliente_id)
      .maybeSingle();

    if (!cliente) {
      console.log(`[${requestId}] ⚠️ Cliente não encontrado: ${cliente_id}`);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    // Buscar ficha ativa
    const { data: ficha } = await supabase
      .from("fichas_de_servico")
      .select("id")
      .eq("telefone_cliente", cliente.telefone)
      .eq("status", "Agendado")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Buscar timestamp real da Twilio (quando a mensagem foi enviada de fato)
    const realDateSent = await fetchTwilioMessageDate(messageSid, requestId);
    const dataHora = realDateSent || new Date().toISOString();

    // Determinar tipo de mídia
    let tipo = "texto";
    let arquivoUrl: string | null = null;

    if (numMedia > 0) {
      const mediaContentType = formData.get("MediaContentType0") as string || "";
      const mediaUrl = formData.get("MediaUrl0") as string || "";

      if (mediaContentType.startsWith("image/")) tipo = "imagem";
      else if (mediaContentType.startsWith("video/")) tipo = "video";
      else if (mediaContentType.startsWith("audio/")) tipo = "audio";
      else tipo = "arquivo";

      arquivoUrl = mediaUrl || null;
      console.log(`[${requestId}] 📎 Mídia: tipo=${tipo}, url=${arquivoUrl?.substring(0, 50)}...`);
    }

    // Salvar mensagem
    const mensagem = {
      cliente_id: cliente_id,
      remetente: remetente,
      texto: body || (numMedia > 0 ? `Arquivo ${numMedia}` : ""),
      tipo,
      arquivo_url: arquivoUrl,
      status: "enviado",
      data_hora: dataHora,
      ficha_id: ficha?.id || null,
      message_sid: messageSid,
      reply_to_message_id: null,
    };

    console.log(`[${requestId}] 💾 Salvando com data_hora: ${dataHora} (${realDateSent ? 'REAL da Twilio' : 'fallback now()'})`);

    const { error: saveError } = await supabase.from("mensagens").insert(mensagem);

    if (saveError) {
      console.error(`[${requestId}] ❌ Erro ao salvar:`, saveError);

      await supabase.from("webhook_debug_logs").insert({
        timestamp: new Date().toISOString(),
        source: "twilio_status_callback",
        event_type: "save_error",
        message_sid: messageSid,
        client_phone: cliente_id,
        success: false,
        error_message: saveError.message,
        step: "SAVE_ERROR",
      });
    } else {
      const tipoMensagem = isMensagemDoBot ? "bot" : "cliente";
      console.log(`[${requestId}] ✅ Mensagem do ${tipoMensagem} salva com sucesso!`);

      await supabase.from("webhook_debug_logs").insert({
        timestamp: new Date().toISOString(),
        source: "twilio_status_callback",
        event_type: isMensagemDoBot ? "bot_message_saved" : "client_message_saved",
        message_sid: messageSid,
        client_phone: cliente_id,
        success: true,
        error_message: null,
        step: "SAVED",
      });
    }

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error(`[${requestId}] ❌ ERRO:`, error);

    try {
      await supabase.from("webhook_debug_logs").insert({
        timestamp: new Date().toISOString(),
        source: "twilio_status_callback",
        event_type: "fatal_error",
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
        step: "ERROR",
      });
    } catch (e) {
      console.error("Erro ao salvar log:", e);
    }

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  }
});
