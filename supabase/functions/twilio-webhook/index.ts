import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { getManagedWhatsappNumbers, isManagedWhatsappNumber, normalizeWhatsappNumber } from "../_shared/twilioNumbers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MANAGED_WHATSAPP_NUMBERS = getManagedWhatsappNumbers();

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
    }
  } catch (e) {
    console.log(`[${requestId}] ⚠️ Falha ao buscar DateSent: ${e}`);
  }
  return null;
}

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📤 [${requestId}] TWILIO WEBHOOK - ${new Date().toISOString()}`);
  console.log(`${"=".repeat(80)}\n`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Parsear dados
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

    const from = normalizeWhatsappNumber(formData.get("From") as string);
    const to = normalizeWhatsappNumber(formData.get("To") as string);
    const body = (formData.get("Body") as string) || "";
    const messageSid = formData.get("MessageSid") as string;
    const numMedia = parseInt(formData.get("NumMedia") as string || "0", 10);

    console.log(`[${requestId}] 📤 From: ${from}`);
    console.log(`[${requestId}] 📤 To: ${to}`);
    console.log(`[${requestId}] 📤 MessageSid: ${messageSid}`);
    console.log(`[${requestId}] 💬 Body: ${body?.substring(0, 100)}`);
    console.log(`[${requestId}] 📎 NumMedia: ${numMedia}`);

    // Determinar direção da mensagem
    const isBotMessage = isManagedWhatsappNumber(from, MANAGED_WHATSAPP_NUMBERS);
    const isClientMessage = isManagedWhatsappNumber(to, MANAGED_WHATSAPP_NUMBERS) && !isBotMessage;
    const directionLabel = isBotMessage ? "BOT → CLIENTE" : isClientMessage ? "CLIENTE → BOT" : "DESCONHECIDO";
    const directionKey = isBotMessage ? "bot_to_client" : isClientMessage ? "client_to_bot" : "unknown";

    // O telefone do CLIENTE é sempre o número que NÃO é gerenciado pela 24help
    const clienteTelefone = isBotMessage ? to : from;
    const remetente = from;

    console.log(`[${requestId}] 🔀 Direção: ${directionLabel}`);
    console.log(`[${requestId}] 👤 Cliente telefone: ${clienteTelefone}`);
    console.log(`[${requestId}] ☎️ Números gerenciados: ${MANAGED_WHATSAPP_NUMBERS.join(", ")}`);

    // Log debug
    await supabase.from("webhook_debug_logs").insert({
      timestamp: new Date().toISOString(),
      source: "twilio_webhook",
      event_type: isBotMessage ? "bot_message" : "client_message",
      message_sid: messageSid,
      client_phone: clienteTelefone,
      success: true,
      error_message: null,
      step: "RECEIVED",
      processed_data: { from, to, body: body?.substring(0, 200), messageSid, direction: directionKey },
    });

    // Ignorar mensagens de loop (from === to)
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

    // Buscar ou criar cliente pelo telefone correto
    let { data: cliente } = await supabase
      .from("clientes")
      .select("telefone")
      .eq("telefone", clienteTelefone)
      .maybeSingle();

    if (!cliente && isClientMessage) {
      // Criar cliente automaticamente para mensagens de clientes novos
      const profileName = formData.get("ProfileName") as string;
      const nomeCliente = profileName || clienteTelefone.replace("whatsapp:", "").replace("+", "");
      console.log(`[${requestId}] 🆕 Criando novo cliente: ${clienteTelefone} (nome: ${nomeCliente})`);
      const { data: novoCliente, error: createError } = await supabase
        .from("clientes")
        .insert({
          telefone: clienteTelefone,
          nome: nomeCliente,
          status_conversa: "aberta",
          ultima_interacao: new Date().toISOString(),
          tags: [],
        })
        .select("telefone")
        .single();

      if (createError) {
        console.error(`[${requestId}] ❌ Erro ao criar cliente:`, createError);
      } else {
        cliente = novoCliente;
      }
    }

    if (!cliente) {
      console.log(`[${requestId}] ⚠️ Cliente não encontrado: ${clienteTelefone}`);
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

    // Buscar timestamp real da Twilio
    const realDateSent = messageSid ? await fetchTwilioMessageDate(messageSid, requestId) : null;
    const dataHora = realDateSent || new Date().toISOString();

    // Salvar mensagem
    const mensagem = {
      cliente_id: cliente.telefone,  // ✅ Sempre o telefone do CLIENTE
      remetente: remetente,           // ✅ Quem enviou (bot ou cliente)
      texto: body || (numMedia > 0 ? `Arquivo ${numMedia}` : ""),
      tipo,
      arquivo_url: arquivoUrl,
      status: isClientMessage ? "recebido" : "enviado",
      data_hora: dataHora,
      ficha_id: ficha?.id || null,
      message_sid: messageSid,
      reply_to_message_id: null,
    };

    console.log(`[${requestId}] 💾 Salvando: cliente_id=${mensagem.cliente_id}, remetente=${mensagem.remetente}, status=${mensagem.status}`);

    const { error: saveError } = await supabase.from("mensagens").insert(mensagem);

    if (saveError) {
      console.error(`[${requestId}] ❌ Erro ao salvar:`, saveError);

      await supabase.from("webhook_debug_logs").insert({
        timestamp: new Date().toISOString(),
        source: "twilio_webhook",
        event_type: "save_error",
        message_sid: messageSid,
        client_phone: clienteTelefone,
        success: false,
        error_message: saveError.message,
        step: "SAVE_ERROR",
      });
    } else {
      console.log(`[${requestId}] ✅ Mensagem salva com sucesso! (${isBotMessage ? 'bot' : 'cliente'})`);

      // Atualizar ultima_interacao do cliente quando ele envia mensagem
      if (isClientMessage) {
        await supabase
          .from("clientes")
          .update({ ultima_interacao: new Date().toISOString() })
          .eq("telefone", cliente.telefone);
      }

      await supabase.from("webhook_debug_logs").insert({
        timestamp: new Date().toISOString(),
        source: "twilio_webhook",
        event_type: isBotMessage ? "bot_message_saved" : "client_message_saved",
        message_sid: messageSid,
        client_phone: clienteTelefone,
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
        source: "twilio_webhook",
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
