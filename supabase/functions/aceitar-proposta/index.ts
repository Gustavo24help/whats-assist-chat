// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response(JSON.stringify({ error: "token obrigatório" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: prop, error } = await supabase
    .from("propostas_comerciais")
    .select("id, numero, versao, ficha_id, valor_total, validade_dias, dados_snapshot, aceita_em, aceita_por_nome, created_at, pdf_storage_path")
    .eq("aceite_token", token)
    .maybeSingle();

  if (error || !prop) {
    return new Response(JSON.stringify({ error: "Proposta não encontrada" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // validade
  const created = new Date(prop.created_at).getTime();
  const expira = created + (prop.validade_dias || 7) * 24 * 60 * 60 * 1000;
  const expirada = Date.now() > expira;

  const { data: pub } = supabase.storage.from("chat-files").getPublicUrl(prop.pdf_storage_path!);

  if (req.method === "GET") {
    return new Response(JSON.stringify({
      proposta: {
        numero: prop.numero,
        versao: prop.versao,
        valor_total: prop.valor_total,
        validade_dias: prop.validade_dias,
        dados_snapshot: prop.dados_snapshot,
        aceita_em: prop.aceita_em,
        aceita_por_nome: prop.aceita_por_nome,
        created_at: prop.created_at,
        pdf_url: pub.publicUrl,
        expirada,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (req.method === "POST") {
    if (prop.aceita_em) {
      return new Response(JSON.stringify({ ok: true, ja_aceita: true, aceita_em: prop.aceita_em, aceita_por_nome: prop.aceita_por_nome }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (expirada) {
      return new Response(JSON.stringify({ error: "Proposta expirada" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = await req.json().catch(() => ({}));
    const nome = (body?.nome || "").toString().trim().slice(0, 200);
    if (!nome) {
      return new Response(JSON.stringify({ error: "nome obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || null;

    const agora = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("propostas_comerciais")
      .update({ aceita_em: agora, aceita_por_nome: nome, aceita_ip: ip })
      .eq("id", prop.id)
      .is("aceita_em", null); // idempotência

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Registra mensagem de sistema no chat (best-effort)
    try {
      const { data: ficha } = await supabase
        .from("fichas_de_servico")
        .select("telefone_cliente")
        .eq("id", prop.ficha_id)
        .maybeSingle();
      const tel = (ficha as any)?.telefone_cliente;
      if (tel) {
        const to = tel.startsWith("whatsapp:") ? tel : `whatsapp:${tel}`;
        await supabase.from("mensagens").insert({
          cliente_id: to,
          remetente: "sistema",
          texto: `✅ Proposta ${prop.numero} aceita por ${nome} em ${new Date(agora).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
          tipo: "texto",
          status: "recebido",
          data_hora: agora,
          ficha_id: prop.ficha_id,
          tipo_remetente: "sistema",
          operador_nome: "Sistema",
        });
      }
    } catch (e) {
      console.warn("[aceitar-proposta] falha ao logar mensagem:", e);
    }

    return new Response(JSON.stringify({ ok: true, aceita_em: agora, aceita_por_nome: nome }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Método não permitido" }),
    { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
