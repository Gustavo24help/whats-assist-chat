// Edge Function: upsert-cliente
// Substitui o INSERT/UPDATE direto do Make em `clientes`.
// Idempotente por telefone (chave natural).
//
// Segurança: público (verify_jwt=false) com header X-Bot-Secret == BOT_CRIAR_FICHA_SECRET.

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

function normalizeTelefone(raw: string): string {
  if (!raw) return raw;
  let t = raw.trim();
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
    const providedSecret =
      req.headers.get("x-bot-secret") || req.headers.get("X-Bot-Secret");
    if (!expectedSecret) {
      return jsonResp({ error: "Secret não configurado no servidor" }, 500);
    }
    if (providedSecret !== expectedSecret) {
      return jsonResp({ error: "Não autorizado" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    console.log("[upsert-cliente] payload:", JSON.stringify(body).substring(0, 500));

    const telefone_raw = body.telefone || body.telefone_cliente || body.From;
    if (!telefone_raw) {
      return jsonResp({ error: "telefone é obrigatório" }, 400);
    }
    const telefone = normalizeTelefone(String(telefone_raw));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar cliente existente
    const { data: existente, error: findErr } = await supabase
      .from("clientes")
      .select("telefone, nome, email, endereco, cidade, estado, cep")
      .eq("telefone", telefone)
      .maybeSingle();

    if (findErr) {
      console.error("[upsert-cliente] Erro busca:", findErr);
      return jsonResp({ error: findErr.message }, 500);
    }

    // Política: NUNCA sobrescrever campo já preenchido (preserva dados operacionais).
    const novo: Record<string, unknown> = { telefone };
    const setIfEmpty = (col: string, valor: unknown) => {
      if (valor === undefined || valor === null || valor === "") return;
      const atual = existente ? (existente as any)[col] : null;
      if (!atual || String(atual).trim() === "") {
        novo[col] = valor;
      }
    };

    setIfEmpty("nome", body.nome ?? body.nome_cliente);
    setIfEmpty("email", body.email);
    setIfEmpty("endereco", body.endereco);
    setIfEmpty("cidade", body.cidade);
    setIfEmpty("estado", body.estado);
    setIfEmpty("cep", body.cep);

    if (existente) {
      const colsParaUpdate = Object.keys(novo).filter((k) => k !== "telefone");
      if (colsParaUpdate.length === 0) {
        console.log(`[upsert-cliente] Cliente ${telefone} já completo, skip`);
        return jsonResp({ ok: true, telefone, action: "skipped", reason: "ja_preenchido" });
      }
      const { error: updErr } = await supabase
        .from("clientes")
        .update(novo)
        .eq("telefone", telefone);
      if (updErr) {
        console.error("[upsert-cliente] Erro update:", updErr);
        return jsonResp({ error: updErr.message }, 500);
      }
      console.log(`[upsert-cliente] ✅ Atualizado ${telefone}: campos=${colsParaUpdate.join(",")}`);
      return jsonResp({ ok: true, telefone, action: "updated", campos: colsParaUpdate });
    }

    // Insert novo cliente
    const { error: insErr } = await supabase.from("clientes").insert(novo);
    if (insErr) {
      console.error("[upsert-cliente] Erro insert:", insErr);
      return jsonResp({ error: insErr.message }, 500);
    }
    console.log(`[upsert-cliente] ✅ Criado ${telefone}`);
    return jsonResp({ ok: true, telefone, action: "created" });
  } catch (err) {
    console.error("[upsert-cliente] Erro fatal:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResp({ error: msg }, 500);
  }
});
