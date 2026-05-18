// Edge Function: vincular-conversa-ficha
// Substitui o INSERT/UPDATE direto do Make em `conversa_ficha_vinculo`.
// Cria ou reativa o vínculo entre uma conversa (telefone do cliente e/ou prestador) e uma ficha.
//
// Segurança: público (verify_jwt=false) com header X-Bot-Secret == BOT_CRIAR_FICHA_SECRET.
// Idempotência: se já existir vínculo ativo (ficha_id + cliente_telefone), retorna sem duplicar.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bot-secret",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeTelefone(raw?: string | null): string | null {
  if (!raw) return null;
  let t = String(raw).trim();
  if (!t) return null;
  if (!t.startsWith("whatsapp:")) {
    if (!t.startsWith("+")) t = "+" + t.replace(/\D/g, "");
    t = "whatsapp:" + t;
  }
  return t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const expectedSecret = Deno.env.get("BOT_CRIAR_FICHA_SECRET");
    if (!expectedSecret) {
      return jsonResp({ error: "Secret não configurado no servidor" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    console.log("[vincular-conversa-ficha] payload:", JSON.stringify(body).substring(0, 500));

    const url = new URL(req.url);
    const headerSecret = req.headers.get("x-bot-secret") || req.headers.get("X-Bot-Secret");
    const querySecret = url.searchParams.get("apikey") || url.searchParams.get("secret");
    const bodySecret = typeof body?.secret === "string" ? body.secret : "";
    const providedSecret = headerSecret || querySecret || bodySecret;
    if (providedSecret !== expectedSecret) {
      return jsonResp({ error: "Não autorizado" }, 401);
    }

    const ficha_id: string | undefined = body.ficha_id || body.id;
    const cliente_telefone = normalizeTelefone(body.cliente_telefone || body.telefone_cliente);
    const prestador_telefone = normalizeTelefone(body.prestador_telefone || body.telefone_prestador);
    const vinculado_por: string = (body.vinculado_por || "make").toString();

    if (!ficha_id) return jsonResp({ error: "ficha_id é obrigatório" }, 400);
    if (!cliente_telefone && !prestador_telefone) {
      return jsonResp({ error: "cliente_telefone ou prestador_telefone é obrigatório" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validar que a ficha existe
    const { data: ficha, error: fichaErr } = await supabase
      .from("fichas_de_servico")
      .select("id")
      .eq("id", ficha_id)
      .maybeSingle();
    if (fichaErr) return jsonResp({ error: fichaErr.message }, 500);
    if (!ficha) return jsonResp({ error: "Ficha não encontrada", ficha_id }, 404);

    // Buscar vínculo existente (mesma ficha + mesmo telefone do cliente OU prestador)
    let q = supabase.from("conversa_ficha_vinculo").select("id, ativo").eq("ficha_id", ficha_id);
    if (cliente_telefone) q = q.eq("cliente_telefone", cliente_telefone);
    else if (prestador_telefone) q = q.eq("prestador_telefone", prestador_telefone);

    const { data: existente, error: findErr } = await q.limit(1).maybeSingle();
    if (findErr) {
      console.error("[vincular-conversa-ficha] Erro busca:", findErr);
      return jsonResp({ error: findErr.message }, 500);
    }

    if (existente) {
      if (existente.ativo) {
        console.log(`[vincular-conversa-ficha] Vínculo já ativo: ${existente.id}`);
        return jsonResp({ ok: true, vinculo_id: existente.id, action: "skipped" });
      }
      // Reativar
      const { error: updErr } = await supabase
        .from("conversa_ficha_vinculo")
        .update({ ativo: true, vinculado_em: new Date().toISOString(), vinculado_por })
        .eq("id", existente.id);
      if (updErr) return jsonResp({ error: updErr.message }, 500);
      console.log(`[vincular-conversa-ficha] ✅ Vínculo reativado: ${existente.id}`);
      return jsonResp({ ok: true, vinculo_id: existente.id, action: "reactivated" });
    }

    const { data: inserted, error: insErr } = await supabase
      .from("conversa_ficha_vinculo")
      .insert({
        ficha_id,
        cliente_telefone,
        prestador_telefone,
        vinculado_por,
        ativo: true,
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      console.error("[vincular-conversa-ficha] Erro insert:", insErr);
      return jsonResp({ error: insErr.message }, 500);
    }

    console.log(`[vincular-conversa-ficha] ✅ Vínculo criado: ${inserted?.id}`);
    return jsonResp({ ok: true, vinculo_id: inserted?.id, action: "created" });
  } catch (err) {
    console.error("[vincular-conversa-ficha] Erro fatal:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResp({ error: msg }, 500);
  }
});
