// Edge Function: criar-ficha-do-bot
// Substitui o hop Twilio Studio -> Make -> Supabase para criação de fichas.
// Recebe payload do Studio Flow (ou do próprio Make em paralelo) e cria a ficha
// diretamente no Supabase, gerando o ID no padrão FGM<seq>@<YYMMDD>.
//
// Segurança: público (verify_jwt=false) mas exige header X-Bot-Secret == BOT_CRIAR_FICHA_SECRET.
// Idempotência: se vier `id_zoho`, reusa ficha existente com mesmo id_zoho.

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

// Gera próximo ID FGM<n>@<YYMMDD> usando a data de hoje (UTC-3 Brasil)
async function gerarProximoId(supabase: ReturnType<typeof createClient>): Promise<string> {
  // YYMMDD em horário Brasil
  const agora = new Date();
  const offsetMs = -3 * 60 * 60 * 1000; // UTC-3
  const brasil = new Date(agora.getTime() + offsetMs);
  const yy = String(brasil.getUTCFullYear()).slice(-2);
  const mm = String(brasil.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(brasil.getUTCDate()).padStart(2, "0");
  const sufixo = `@${yy}${mm}${dd}`;

  // Busca fichas do dia, pega o maior número
  const { data, error } = await supabase
    .from("fichas_de_servico")
    .select("id")
    .like("id", `FGM%${sufixo}`);

  if (error) throw new Error(`Erro ao buscar IDs do dia: ${error.message}`);

  let maxN = 0;
  for (const row of data ?? []) {
    const m = /^FGM(\d+)@\d{6}$/.exec((row as any).id);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxN) maxN = n;
    }
  }
  return `FGM${maxN + 1}${sufixo}`;
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
    // Auth por shared secret
    const expectedSecret = Deno.env.get("BOT_CRIAR_FICHA_SECRET");
    const providedSecret =
      req.headers.get("x-bot-secret") || req.headers.get("X-Bot-Secret");
    if (!expectedSecret) {
      console.error("[criar-ficha-do-bot] BOT_CRIAR_FICHA_SECRET não configurado");
      return jsonResp({ error: "Secret não configurado no servidor" }, 500);
    }
    if (providedSecret !== expectedSecret) {
      console.warn("[criar-ficha-do-bot] Secret inválido");
      return jsonResp({ error: "Não autorizado" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    console.log("[criar-ficha-do-bot] payload:", JSON.stringify(body).substring(0, 500));

    const telefone_cliente_raw = body.telefone_cliente || body.telefone || body.From;
    if (!telefone_cliente_raw) {
      return jsonResp({ error: "telefone_cliente é obrigatório" }, 400);
    }
    const telefone_cliente = normalizeTelefone(String(telefone_cliente_raw));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Idempotência por id_zoho
    const id_zoho: string | undefined = body.id_zoho || body.zoho_id;
    if (id_zoho) {
      const { data: existente } = await supabase
        .from("fichas_de_servico")
        .select("id")
        .eq("id_zoho", id_zoho)
        .maybeSingle();
      if (existente?.id) {
        console.log(`[criar-ficha-do-bot] Ficha já existe (id_zoho=${id_zoho}): ${existente.id}`);
        return jsonResp({ ok: true, ficha_id: existente.id, reused: true });
      }
    }

    // Buscar nome do cliente se não veio no payload
    let nome_cliente: string =
      (body.nome_cliente || body.nome || "").toString().trim();
    if (!nome_cliente) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("nome")
        .eq("telefone", telefone_cliente)
        .maybeSingle();
      nome_cliente = (cli?.nome || "").toString().trim();
    }
    // Trigger ensure_nome_cliente_preenchido também garante fallback "Cliente"
    if (!nome_cliente) nome_cliente = "Cliente";
    // Garantir 2+ palavras (Zoho exige First_Name e Last_Name após split por espaço no Make)
    if (!nome_cliente.includes(" ")) nome_cliente = `${nome_cliente} (sem sobrenome)`;

    // Gerar ID novo
    const novoId = await gerarProximoId(supabase);

    const insertPayload: Record<string, unknown> = {
      id: novoId,
      telefone_cliente,
      nome_cliente,
      // Campos opcionais vindos do bot
      descricao: body.descricao ?? null,
      categoria_id: body.categoria_id ?? null,
      preferencia_horario_cliente: body.preferencia_horario_cliente ?? null,
      id_zoho: id_zoho ?? null,
      nome_ficha: body.nome_ficha ?? null,
      // status default 'Ficha Criada' do schema
    };

    // Remover undefined
    for (const k of Object.keys(insertPayload)) {
      if (insertPayload[k] === undefined) delete insertPayload[k];
    }

    const { data: inserted, error: insErr } = await supabase
      .from("fichas_de_servico")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (insErr) {
      console.error("[criar-ficha-do-bot] Erro insert:", insErr);
      return jsonResp({ error: insErr.message }, 500);
    }

    // Se trigger handle_ficha_duplicate_insert engoliu (RETURN NULL), inserted vem null
    const ficha_id = inserted?.id ?? novoId;
    console.log(`[criar-ficha-do-bot] Ficha criada: ${ficha_id}`);

    return jsonResp({ ok: true, ficha_id });
  } catch (err) {
    console.error("[criar-ficha-do-bot] Erro fatal:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResp({ error: msg }, 500);
  }
});
