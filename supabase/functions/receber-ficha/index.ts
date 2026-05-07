import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ficha-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXPECTED_SECRET = Deno.env.get("FICHA_WEBHOOK_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth via header x-ficha-secret OU body.secret
    const headerSecret = req.headers.get("x-ficha-secret") ?? "";
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret") ?? "";

    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }
    const bodySecret = typeof payload.secret === "string" ? payload.secret : "";

    const provided = headerSecret || bodySecret || querySecret;
    if (!EXPECTED_SECRET || provided !== EXPECTED_SECRET) {
      console.warn("[receber-ficha] unauthorized", {
        hasHeader: !!headerSecret,
        hasBody: !!bodySecret,
        hasQuery: !!querySecret,
      });
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[receber-ficha] payload recebido:", JSON.stringify(payload).slice(0, 1000));

    // Extrai campos comuns (aceita várias chaves usadas pelo Make/Twilio Studio)
    const ficha_id = String(
      payload.ficha_id ?? payload.id ?? payload.nome_ficha ?? ""
    ).trim();
    const telefone_cliente = String(
      payload.telefone_cliente ?? payload.telefone ?? payload.from ?? ""
    ).trim() || null;
    const nome_cliente = String(
      payload.nome_cliente ?? payload.nome ?? ""
    ).trim() || null;
    const descricao = (payload.descricao as string | null) ?? null;
    const id_zoho = (payload.id_zoho as string | null) ?? null;
    const categoria_id = payload.categoria_id ?? null;
    const preferencia_horario_cliente =
      (payload.preferencia_horario_cliente as string | null) ?? null;

    if (!ficha_id) {
      return new Response(
        JSON.stringify({ error: "ficha_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotente: se já existe, faz merge no-overwrite (igual handle_ficha_duplicate_insert)
    const { data: existing, error: selErr } = await supabase
      .from("fichas_de_servico")
      .select("id")
      .eq("id", ficha_id)
      .maybeSingle();

    if (selErr) {
      console.error("[receber-ficha] erro select:", selErr);
      return new Response(
        JSON.stringify({ error: selErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existing) {
      console.log(`[receber-ficha] ficha ${ficha_id} já existe — ignorando (trigger faz merge)`);
      return new Response(
        JSON.stringify({ success: true, ficha_id, status: "already_exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const insertPayload: Record<string, unknown> = {
      id: ficha_id,
      telefone_cliente,
      nome_cliente,
      descricao,
      id_zoho,
      categoria_id,
      preferencia_horario_cliente,
    };

    // Remove undefined/null para não sobrescrever defaults
    Object.keys(insertPayload).forEach((k) => {
      if (insertPayload[k] === null || insertPayload[k] === undefined) {
        delete insertPayload[k];
      }
    });
    insertPayload.id = ficha_id; // garante id

    const { data: inserted, error: insErr } = await supabase
      .from("fichas_de_servico")
      .insert(insertPayload)
      .select()
      .single();

    if (insErr) {
      console.error("[receber-ficha] erro insert:", insErr);
      return new Response(
        JSON.stringify({ error: insErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[receber-ficha] ficha ${ficha_id} criada com sucesso`);
    return new Response(
      JSON.stringify({ success: true, ficha_id, ficha: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[receber-ficha] erro:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
