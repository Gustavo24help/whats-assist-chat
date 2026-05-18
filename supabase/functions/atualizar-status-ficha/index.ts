// Edge Function: atualizar-status-ficha
// Substitui o UPDATE direto do Make em fichas_de_servico para mudança de status.
// O trigger registrar_mudanca_status já cuida de gravar ficha_status_historico.
//
// Segurança: público (verify_jwt=false) mas exige header X-Bot-Secret == BOT_CRIAR_FICHA_SECRET
// (mesmo secret do criar-ficha-do-bot — Make só precisa configurar uma vez).
//
// Idempotência: se o status atual já for igual ao novo, retorna ok sem update.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bot-secret",
};

// Whitelist de status válidos — espelha o enum/lifecycle do app.
const STATUS_PERMITIDOS = new Set([
  "Ficha Criada",
  "Orçamento Enviado",
  "Orçamento Aprovado / Agendamento",
  "Agendado",
  "Visita Técnica",
  "Em Andamento",
  "Aguardando Peça",
  "Aguardando Cliente",
  "Aguardando Aprovação",
  "Retorno",
  "Finalizado",
  "Garantia",
  "Cancelado",
  "Perdido",
  "Pausado",
  "Reagendado",
]);

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
    const expectedSecret = Deno.env.get("BOT_CRIAR_FICHA_SECRET");
    if (!expectedSecret) {
      console.error("[atualizar-status-ficha] BOT_CRIAR_FICHA_SECRET não configurado");
      return jsonResp({ error: "Secret não configurado no servidor" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    console.log("[atualizar-status-ficha] payload:", JSON.stringify(body).substring(0, 500));

    const url = new URL(req.url);
    const headerSecret = req.headers.get("x-bot-secret") || req.headers.get("X-Bot-Secret");
    const querySecret = url.searchParams.get("apikey") || url.searchParams.get("secret");
    const bodySecret = typeof body?.secret === "string" ? body.secret : "";
    const providedSecret = headerSecret || querySecret || bodySecret;
    if (providedSecret !== expectedSecret) {
      console.warn("[atualizar-status-ficha] Secret inválido");
      return jsonResp({ error: "Não autorizado" }, 401);
    }

    const ficha_id: string | undefined = body.ficha_id || body.id;
    const id_zoho: string | undefined = body.id_zoho || body.zoho_id;
    const novo_status: string | undefined = (body.status || body.novo_status || "").toString().trim();
    const origem: string = (body.origem || "make").toString();

    if (!ficha_id && !id_zoho) {
      return jsonResp({ error: "ficha_id ou id_zoho é obrigatório" }, 400);
    }
    if (!novo_status) {
      return jsonResp({ error: "status é obrigatório" }, 400);
    }
    if (!STATUS_PERMITIDOS.has(novo_status)) {
      return jsonResp(
        { error: `status inválido: '${novo_status}'`, permitidos: [...STATUS_PERMITIDOS] },
        400
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolver ficha por id ou id_zoho
    let query = supabase.from("fichas_de_servico").select("id, status").limit(1);
    query = ficha_id ? query.eq("id", ficha_id) : query.eq("id_zoho", id_zoho!);
    const { data: ficha, error: findErr } = await query.maybeSingle();

    if (findErr) {
      console.error("[atualizar-status-ficha] Erro busca:", findErr);
      return jsonResp({ error: findErr.message }, 500);
    }
    if (!ficha) {
      return jsonResp({ error: "Ficha não encontrada", ficha_id, id_zoho }, 404);
    }

    // Idempotência: status já é o esperado
    if (ficha.status === novo_status) {
      console.log(`[atualizar-status-ficha] Ficha ${ficha.id} já está em '${novo_status}', skip`);
      return jsonResp({ ok: true, ficha_id: ficha.id, status: novo_status, skipped: true });
    }

    const { error: updErr } = await supabase
      .from("fichas_de_servico")
      .update({ status: novo_status })
      .eq("id", ficha.id);

    if (updErr) {
      console.error("[atualizar-status-ficha] Erro update:", updErr);
      return jsonResp({ error: updErr.message }, 500);
    }

    // Log opcional em system_logs (não bloqueia se falhar)
    try {
      await supabase.from("system_logs").insert({
        nivel: "info",
        categoria: "automation",
        mensagem: `Status atualizado via edge: ${ficha.status} → ${novo_status}`,
        detalhes: { ficha_id: ficha.id, status_anterior: ficha.status, status_novo: novo_status, origem },
        url: "edge://atualizar-status-ficha",
      });
    } catch (_e) { /* noop */ }

    console.log(`[atualizar-status-ficha] ✅ ${ficha.id}: ${ficha.status} → ${novo_status}`);
    return jsonResp({
      ok: true,
      ficha_id: ficha.id,
      status_anterior: ficha.status,
      status_novo: novo_status,
    });
  } catch (err) {
    console.error("[atualizar-status-ficha] Erro fatal:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResp({ error: msg }, 500);
  }
});
