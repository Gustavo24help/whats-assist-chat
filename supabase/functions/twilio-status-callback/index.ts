import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    // Parsear dados
    const contentType = req.headers.get("content-type") || "";
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

    console.log(`[${requestId}] 📤 From: ${from}`);
    console.log(`[${requestId}] 📤 To: ${to}`);
    console.log(`[${requestId}] 📤 MessageSid: ${messageSid}`);
    console.log(`[${requestId}] 💬 Body: ${body?.substring(0, 100)}`);

    // Log debug
    await supabase.from("webhook_debug_logs").insert({
      timestamp: new Date().toISOString(),
      source: "twilio_status_callback",
      event_type: "bot_message",
      message_sid: messageSid,
      client_phone: to,
      success: true,
      error_message: null,
      step: "RECEIVED",
      processed_data: { from, to, body: body?.substring(0, 200), messageSid },
    });

    // Verificar se é mensagem do BOT (from = número da 24help)
    const NUMERO_24HELP_PRODUCAO = "whatsapp:+554138911555";
    const NUMERO_24HELP_SANDBOX = "whatsapp:+14155238886";

    if (from !== NUMERO_24HELP_PRODUCAO && from !== NUMERO_24HELP_SANDBOX) {
      console.log(`[${requestId}] ⚠️ Não é mensagem do bot, ignorando`);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    // Verificar duplicidade
    if (messageSid) {
      const { data: existing } = await supabase
        .from("mensagens")
        .select("id")
        .eq("message_sid", messageSid)
        .maybeSingle();

      if (existing) {
        console.log(`[${requestId}] ⚠️ Mensagem já existe, ignorando`);
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
        });
      }
    }

    // Buscar cliente pelo telefone (to = destinatário)
    const { data: cliente } = await supabase.from("clientes").select("telefone").eq("telefone", to).maybeSingle();

    if (!cliente) {
      console.log(`[${requestId}] ⚠️ Cliente não encontrado: ${to}`);
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

    // Salvar mensagem DO BOT
    const mensagem = {
      cliente_id: cliente.telefone,
      remetente: from, // ✅ Número da 24help
      texto: body,
      tipo: "texto",
      arquivo_url: null,
      status: "enviado",
      data_hora: new Date().toISOString(),
      ficha_id: ficha?.id || null,
      message_sid: messageSid,
      reply_to_message_id: null,
    };

    const { error: saveError } = await supabase.from("mensagens").insert(mensagem);

    if (saveError) {
      console.error(`[${requestId}] ❌ Erro ao salvar:`, saveError);

      await supabase.from("webhook_debug_logs").insert({
        timestamp: new Date().toISOString(),
        source: "twilio_status_callback",
        event_type: "save_error",
        message_sid: messageSid,
        client_phone: to,
        success: false,
        error_message: saveError.message,
        step: "SAVE_ERROR",
      });
    } else {
      console.log(`[${requestId}] ✅ Mensagem do bot salva com sucesso!`);

      await supabase.from("webhook_debug_logs").insert({
        timestamp: new Date().toISOString(),
        source: "twilio_status_callback",
        event_type: "bot_message_saved",
        message_sid: messageSid,
        client_phone: to,
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
