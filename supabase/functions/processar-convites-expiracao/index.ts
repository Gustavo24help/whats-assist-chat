// Edge Function: processar-convites-expiracao
// Cron (a cada minuto):
//  - Envia LEMBRETE quando faltam ≤3min para expirar e ainda não foi lembrado.
//  - Marca como 'expirado' os convites pendentes vencidos.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function twilioSend(to: string, from: string, body: string, sid: string, token: string) {
  const form = new URLSearchParams();
  form.append("To", to);
  form.append("From", from);
  form.append("Body", body);
  const auth = btoa(`${sid}:${token}`);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER_2") || "";
  const from = TWILIO_FROM.startsWith("whatsapp:") ? TWILIO_FROM : `whatsapp:${TWILIO_FROM}`;

  const now = new Date();
  const in3min = new Date(now.getTime() + 3 * 60 * 1000).toISOString();

  // 1) Expira vencidos
  const { data: expirados } = await supabase
    .from("convites_prestador")
    .update({ status: "expirado" })
    .eq("status", "pendente")
    .lt("expira_em", now.toISOString())
    .select("id");

  // 2) Lembretes: pendentes que expiram em <=3min e sem lembrete
  const { data: paraLembrar } = await supabase
    .from("convites_prestador")
    .select("id, prestador_telefone, prestador_nome, token, expira_em")
    .eq("status", "pendente")
    .eq("lembrete_enviado", false)
    .lte("expira_em", in3min);

  const lembretesEnviados: string[] = [];
  for (const c of paraLembrar ?? []) {
    const minsRest = Math.max(1, Math.round((new Date(c.expira_em).getTime() - now.getTime()) / 60000));
    const linkBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/responder-convite?t=${c.token}`;
    const txt =
      `⏰ *Lembrete* — faltam ~${minsRest} min para o convite expirar.\n` +
      `Por favor responda:\n` +
      `✅ ACEITAR: ${linkBase}&r=sim\n` +
      `❌ RECUSAR: ${linkBase}&r=nao`;
    if (TWILIO_FROM && c.prestador_telefone) {
      const { ok, data } = await twilioSend(c.prestador_telefone, from, txt, TWILIO_SID, TWILIO_TOKEN);
      if (ok) {
        lembretesEnviados.push(c.id);
        await supabase.from("convites_prestador").update({ lembrete_enviado: true }).eq("id", c.id);
        await supabase.from("mensagens_prestadores").insert({
          prestador_telefone: c.prestador_telefone,
          remetente: from,
          texto: txt,
          tipo: "texto",
          status: "enviado",
          data_hora: new Date().toISOString(),
          numero_twilio: from,
          message_sid: (data as any)?.sid ?? null,
        });
      } else {
        console.error("[processar-convites] lembrete falhou", data);
      }
    }
  }

  return new Response(
    JSON.stringify({ expirados: (expirados ?? []).length, lembretes: lembretesEnviados.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
