import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ficha-secret, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXPECTED_SECRET = Deno.env.get("FICHA_WEBHOOK_SECRET") ?? "";

function getField(obj: Record<string, any>, prefix: string): string {
  if (!obj) return "";
  const key = Object.keys(obj).find(
    (k) => k === prefix || k.startsWith(prefix + " ") || k.startsWith(prefix + ".")
  );
  const val = key ? String(obj[key] ?? "").trim() : "";
  if (val === "Não informado" || val === "Não informado." || val === "não informado") return "";
  return val;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const headerSecret =
      req.headers.get("x-ficha-secret") ??
      req.headers.get("x-api-key") ??
      "";
    const url = new URL(req.url);
    const querySecret =
      url.searchParams.get("apikey") ??
      url.searchParams.get("secret") ??
      "";

    let payload: Record<string, any> = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }
    const bodySecret = typeof payload.secret === "string" ? payload.secret : "";

    const provided = headerSecret || bodySecret || querySecret;
    if (!EXPECTED_SECRET || provided !== EXPECTED_SECRET) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const info       = (payload.InformacoesGerais     ?? {}) as Record<string, any>;
    const detalhes   = (payload.DetalhesTecnicos       ?? {}) as Record<string, any>;
    const adicionais = (payload.InformacoesAdicionais  ?? {}) as Record<string, any>;

    const ficha_id = String(
      payload.ficha_id ?? payload.id ?? payload.nome_ficha ?? payload.FichaDeServicos ?? ""
    ).trim();

    const telefone_cliente =
      (String(
        payload.telefone_cliente ?? payload.telefone ?? payload.from ?? payload.ContactPhone ?? ""
      ).replace(/^whatsapp:/i, "").trim()) || null;

    const nomeCidadeBairro = getField(info, "1.1");
    const partes = nomeCidadeBairro.split(",").map((s) => s.trim());
    const nomeFromInfo   = partes[0] || "";
    const cidadeFromInfo = partes[1] || "";
    const bairroFromInfo = partes[2] || "";

    const nome_cliente = String(payload.nome_cliente ?? payload.nome ?? nomeFromInfo ?? "").trim() || null;
    const cidade = ((payload.cidade as string | null) ?? cidadeFromInfo) || null;
    const bairro = ((payload.bairro as string | null) ?? bairroFromInfo) || null;

    // Mapa de categorias por nome (case-insensitive)
    const CATEGORIAS: Record<string, number> = {
      "elétrica": 1, "eletrica": 1,
      "hidráulica": 2, "hidraulica": 2,
      "fechaduras": 3, "fechadura": 3,
      "marido de aluguel": 4,
      "aquecedores": 5, "aquecedor": 5,
      "ar condicionado": 6,
      "coifas": 7, "coifa": 7,
      "pintura": 8,
      "pisos e laminados": 9, "piso": 9, "laminado": 9,
      "montagem de móveis": 10, "montagem de moveis": 10, "montagem": 10,
      "drywall": 11,
      "limpeza e conservação": 12, "limpeza e conservacao": 12, "limpeza": 12,
    };

    const categoriaRaw: any = payload.categoria_id ?? getField(info, "1.2") ?? null;
    let categoria_id: number | null = null;
    if (typeof categoriaRaw === "number") {
      categoria_id = categoriaRaw;
    } else if (typeof categoriaRaw === "string") {
      // Tenta número no início: "4 - Marido de aluguel"
      const m = categoriaRaw.match(/^\s*(\d+)/);
      if (m) {
        categoria_id = parseInt(m[1], 10);
      } else {
        // Tenta match por nome
        const nome = categoriaRaw.toLowerCase().trim();
        const match = Object.keys(CATEGORIAS).find(k => nome.includes(k));
        if (match) categoria_id = CATEGORIAS[match];
      }
    }

    const descricaoMontada = [
      getField(info, "1.3"),
      getField(info, "1.4"),
      getField(detalhes, "2.1"),
      getField(detalhes, "2.2"),
      getField(detalhes, "2.3"),
      getField(detalhes, "2.4"),
      getField(adicionais, "3.3"),
      getField(adicionais, "3.4"),
    ].filter((v) => v.length > 0).join(" | ");

    const descricao = (payload.descricao as string | null) ?? (descricaoMontada || null);
    const preferencia_horario_cliente =
      ((payload.preferencia_horario_cliente as string | null) ?? getField(adicionais, "3.2")) || null;
    const id_zoho = (payload.id_zoho as string | null) ?? null;

    if (!ficha_id) {
      return new Response(
        JSON.stringify({ error: "ficha_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existing, error: selErr } = await supabase
      .from("fichas_de_servico").select("id").eq("id", ficha_id).maybeSingle();

    if (selErr) {
      return new Response(JSON.stringify({ error: selErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, ficha_id, status: "already_exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (telefone_cliente) {
      const { data: cli } = await supabase.from("clientes").select("telefone").eq("telefone", telefone_cliente).maybeSingle();
      if (!cli) {
        const { error: cliErr } = await supabase.from("clientes").insert({ telefone: telefone_cliente, nome: nome_cliente ?? "Cliente" });
        if (cliErr) {
          return new Response(JSON.stringify({ error: `cliente: ${cliErr.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    const insertPayload: Record<string, unknown> = {
      id: ficha_id, nome_ficha: ficha_id, telefone_cliente, nome_cliente,
      cidade, bairro, descricao, id_zoho, categoria_id, preferencia_horario_cliente,
    };
    Object.keys(insertPayload).forEach((k) => {
      if (insertPayload[k] === null || insertPayload[k] === undefined) delete insertPayload[k];
    });
    insertPayload.id = ficha_id;

    const { data: inserted, error: insErr } = await supabase
      .from("fichas_de_servico").insert(insertPayload).select().single();

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const dadosCompletos = {
      informacoes_gerais: payload.InformacoesGerais ?? {},
      detalhes_tecnicos: payload.DetalhesTecnicos ?? {},
      informacoes_adicionais: payload.InformacoesAdicionais ?? {},
    };
    const { error: pqErr } = await supabase.from("pre_qualificacao_bot").insert({
      ficha_id: ficha_id,
      dados: dadosCompletos,
      sku_sugerido: getField(info, "1.2") || null,
    });
    if (pqErr) {
      console.warn("[receber-ficha] aviso pre_qualificacao_bot:", pqErr.message);
    }

    const conversaTexto = payload.ConversaTexto as string | null;
    if (conversaTexto && telefone_cliente) {
      await supabase.from("mensagens").insert({
        cliente_telefone: telefone_cliente,
        origem: "sistema",
        tipo: "historico",
        conteudo: conversaTexto,
        created_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({ success: true, ficha_id, ficha: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
