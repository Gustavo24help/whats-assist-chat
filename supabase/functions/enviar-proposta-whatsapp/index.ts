// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { proposta_id, telefone_cliente } = await req.json();
    if (!proposta_id || !telefone_cliente) {
      return new Response(JSON.stringify({ error: "proposta_id e telefone_cliente obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: prop, error: propErr } = await supabase
      .from("propostas_comerciais")
      .select("id, numero, ficha_id, pdf_storage_path, validade_dias, dados_snapshot, aceite_token")
      .eq("id", proposta_id)
      .maybeSingle();

    if (propErr || !prop) {
      return new Response(JSON.stringify({ error: "Proposta não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: pub } = supabase.storage.from("chat-files").getPublicUrl(prop.pdf_storage_path!);
    const pdfUrl = pub.publicUrl;

    const origin = req.headers.get("origin") || "https://chat.24help.com.br";
    const aceiteUrl = `${origin}/proposta-aceite/${prop.aceite_token}`;
    const nomeCliente = (prop.dados_snapshot as any)?.cliente?.nome || "Cliente";

    const texto = `Olá ${nomeCliente}, segue sua proposta *${prop.numero}* da 24help.\n\n📄 PDF anexo\n✅ Aceitar online: ${aceiteUrl}\n\nValidade: ${prop.validade_dias} dias.`;

    // Twilio direto (mesma estratégia de send-recibo) — anexa o PDF
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER")!;
    const auth = btoa(`${twilioSid}:${twilioToken}`);
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;

    const whatsappTo = telefone_cliente.startsWith("whatsapp:") ? telefone_cliente : `whatsapp:${telefone_cliente}`;
    const whatsappFrom = `whatsapp:${twilioPhone}`;

    const body = new URLSearchParams();
    body.append("To", whatsappTo);
    body.append("From", whatsappFrom);
    body.append("Body", texto);
    body.append("MediaUrl", pdfUrl);
    body.append("StatusCallback", `${supabaseUrl}/functions/v1/update-message-status`);

    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const resData = await res.json();
    if (!res.ok) {
      console.error("[enviar-proposta-whatsapp] erro Twilio:", resData);
      return new Response(JSON.stringify({ error: resData.message || "Erro Twilio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const messageSid = resData.sid;
    await supabase.from("mensagens").insert({
      cliente_id: whatsappTo,
      remetente: whatsappFrom,
      texto,
      arquivo_url: pdfUrl,
      tipo: "documento",
      status: "enviado",
      data_hora: new Date().toISOString(),
      message_sid: messageSid,
      ficha_id: prop.ficha_id,
      tipo_remetente: "sistema",
      operador_nome: "Sistema",
    });

    await supabase.from("propostas_comerciais")
      .update({ enviada_whatsapp: true, enviada_em: new Date().toISOString() })
      .eq("id", proposta_id);

    return new Response(JSON.stringify({ ok: true, message_sid: messageSid, pdf_url: pdfUrl, aceite_url: aceiteUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[enviar-proposta-whatsapp] fatal:", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
