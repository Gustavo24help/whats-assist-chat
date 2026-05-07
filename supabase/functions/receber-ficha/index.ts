import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ficha-secret, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXPECTED_SECRET = Deno.env.get("FICHA_WEBHOOK_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth via header x-ficha-secret, x-api-key, OU body.secret, OU query ?secret=
    const headerSecret =
      req.headers.get("x-ficha-secret") ??
      req.headers.get("x-api-key") ??
      "";
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret") ?? "";

    let payload: Record<string, any> = {};
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
        expectedLen: EXPECTED_SECRET.length,
        providedLen: provided.length,
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

    console.log("[receber-ficha] payload recebido:", JSON.stringify(payload).slice(0, 1500));

    // Aceita formato Make/Zoho (FichaDeServicos, ContactPhone, InformacoesGerais.*)
    const info = (payload.InformacoesGerais ?? {}) as Record<string, any>;
    const adicionais = (payload.InformacoesAdicionais ?? {}) as Record<string, any>;

    const nomeCidadeBairro: string =
      info["1.1. Nome do cliente, cidade e bairro"] ?? "";
    const nomeFromInfo = nomeCidadeBairro
      ? String(nomeCidadeBairro).split(",")[0].trim()
      : "";

    const ficha_id = String(
      payload.ficha_id ?? payload.id ?? payload.nome_ficha ?? payload.FichaDeServicos ?? ""
    ).trim();
    const telefone_cliente = (String(
      payload.telefone_cliente ?? payload.telefone ?? payload.from ?? payload.ContactPhone ?? ""
    ).replace(/^whatsapp:/i, "").trim()) || null;
    const nome_cliente = String(
      payload.nome_cliente ?? payload.nome ?? nomeFromInfo ?? ""
    ).trim() || null;
    const descricaoMontada = [
      info["1.3. Tipo de serviço"],
      info["1.4. Descrição detalhada"],
      adicionais["3.4. Demais informações obtidas durante a conversa com o cliente"],
    ]
      .filter((v) => v && String(v).trim())
      .join(" | ");
    const descricao =
      (payload.descricao as string | null) ?? (descricaoMontada || null);
    const id_zoho = (payload.id_zoho as string | null) ?? null;
    const categoriaRaw: any =
      payload.categoria_id ?? info["1.2. Categoria do serviço"] ?? null;
    let categoria_id: number | null = null;
    if (typeof categoriaRaw === "number") {
      categoria_id = categoriaRaw;
    } else if (typeof categoriaRaw === "string") {
      const m = categoriaRaw.match(/^\s*(\d+)/);
      if (m) categoria_id = parseInt(m[1], 10);
    }
    const preferencia_horario_cliente =
      (payload.preferencia_horario_cliente as string | null) ??
      (adicionais["3.2. Horário de preferência para o serviço"] as string | null) ??
      null;

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

    // Garante que o cliente existe (FK fichas_de_servico.telefone_cliente -> clientes.telefone)
    if (telefone_cliente) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("telefone")
        .eq("telefone", telefone_cliente)
        .maybeSingle();
      if (!cli) {
        const { error: cliErr } = await supabase
          .from("clientes")
          .insert({ telefone: telefone_cliente, nome: nome_cliente ?? "Cliente" });
        if (cliErr) {
          console.error("[receber-ficha] erro upsert cliente:", cliErr);
          return new Response(
            JSON.stringify({ error: `cliente: ${cliErr.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
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
