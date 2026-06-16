// Edge Function: enviar-boas-vindas-lead
// Envia UMA mensagem de boas-vindas (sistema, não-bot) ao lead do site assim que
// ele iniciar a conversa no WhatsApp. Chamada interna (Service Role) a partir do
// twilio-webhook e do receber-lead-site.
//
// - Lock idempotente via fichas_de_servico.boas_vindas_lead_enviada
// - Em caso de falha na Twilio, reverte a flag pra próxima mensagem tentar de novo

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ===== Proteção: apenas chamada interna =====
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    if (authHeader !== `Bearer ${serviceKey}`) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const telefone: string = String(body?.telefone ?? "").trim();
    const ficha_id: string = String(body?.ficha_id ?? "").trim();
    const numero_origem: string = String(body?.numero_origem ?? "").trim();

    if (!telefone || !ficha_id) {
      return jsonResp({ error: "telefone e ficha_id são obrigatórios" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // ===== Lock idempotente: marca como enviada apenas se ainda não foi =====
    const { data: lockRows, error: lockErr } = await supabase
      .from("fichas_de_servico")
      .update({ boas_vindas_lead_enviada: true })
      .eq("id", ficha_id)
      .eq("boas_vindas_lead_enviada", false)
      .select("id");

    if (lockErr) {
      console.error("[boas-vindas-lead] erro no lock:", lockErr);
      return jsonResp({ error: lockErr.message }, 500);
    }
    if (!lockRows || lockRows.length === 0) {
      console.log(`[boas-vindas-lead] já enviada para ${ficha_id}, skip`);
      return jsonResp({ skipped: true });
    }

    // ===== Carrega dados da pre_qualificacao_bot =====
    const { data: pq } = await supabase
      .from("pre_qualificacao_bot")
      .select("dados")
      .eq("ficha_id", ficha_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const dados: any = (pq as any)?.dados ?? {};
    const nomeCompleto = String(dados?.cliente?.nome ?? "").trim();
    const primeiro_nome = nomeCompleto ? nomeCompleto.split(/\s+/)[0] : "";
    const servico = String(dados?.orcamento?.servico ?? "").trim() || "seu serviço";

    const notas = (
      String(dados?.escopo_cliente?.notas ?? "") +
      " " +
      String(dados?.orcamento?.notas ?? "")
    ).toLowerCase();
    const material_falta = /à parte|a parte|peça|peca|material/.test(notas);

    const saudacao = primeiro_nome ? `Oi ${primeiro_nome}! 👋` : "Oi! 👋";
    let texto =
      `${saudacao} Aqui é da 24help.\n` +
      `Recebemos seu pedido de ${servico} pelo nosso site — já está tudo registrado.\n` +
      `Um especialista da nossa equipe já vai continuar com você por aqui pra confirmar os detalhes e o melhor horário. 🙌`;

    if (material_falta) {
      texto +=
        `\n\nAh: vi que você ainda não tem a peça/material. Sem problema — dá pra combinar do profissional já levar no dia, e se quiser te mando a cotação antes pra você aprovar. 👍`;
    }

    // ===== Envia via Twilio =====
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!twilioAccountSid || !twilioAuthToken) {
      // revert lock
      await supabase
        .from("fichas_de_servico")
        .update({ boas_vindas_lead_enviada: false })
        .eq("id", ficha_id);
      return jsonResp({ error: "Twilio não configurado" }, 500);
    }

    const fromRaw = numero_origem || (twilioPhoneNumber ? `whatsapp:${twilioPhoneNumber}` : "");
    const from = fromRaw.startsWith("whatsapp:") ? fromRaw : `whatsapp:${fromRaw}`;
    const to = telefone.startsWith("whatsapp:") ? telefone : `whatsapp:${telefone}`;

    const form = new URLSearchParams();
    form.append("To", to);
    form.append("From", from);
    form.append("Body", texto);
    form.append("StatusCallback", `${supabaseUrl}/functions/v1/update-message-status`);

    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    const twResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );

    const twData = await twResp.json().catch(() => ({}));

    if (!twResp.ok) {
      console.error("[boas-vindas-lead] Twilio falhou:", twResp.status, twData);
      // revert lock pra próxima mensagem tentar de novo
      await supabase
        .from("fichas_de_servico")
        .update({ boas_vindas_lead_enviada: false })
        .eq("id", ficha_id);
      return jsonResp({ error: "twilio_failed", details: twData }, 500);
    }

    const sid = (twData as any)?.sid ?? null;

    // ===== Grava em mensagens (tipo_remetente = atendente; NÃO é bot) =====
    const { error: msgErr } = await supabase.from("mensagens").insert({
      cliente_id: telefone,
      remetente: from,
      texto,
      tipo: "texto",
      status: "enviado",
      data_hora: new Date().toISOString(),
      ficha_id,
      message_sid: sid,
      tipo_remetente: "atendente",
      operador_nome: "Boas-vindas automática",
    });

    if (msgErr) {
      console.warn("[boas-vindas-lead] aviso ao gravar mensagem:", msgErr.message);
    }

    console.log(`[boas-vindas-lead] enviada para ${ficha_id} (sid=${sid})`);
    return jsonResp({ ok: true, sid });
  } catch (err) {
    console.error("[boas-vindas-lead] erro fatal:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResp({ error: msg }, 500);
  }
});
