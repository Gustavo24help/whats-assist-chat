// supabase/functions/receber-lead-site/index.ts
// Recebe o webhook do plugin WordPress 24help-form-builder (chat + formulário),
// cria a ficha na MESMA sequência FGM<n>@<YYMMDD> do bot e guarda o escopo exibido
// ao cliente em pre_qualificacao_bot (Otto lê via v_contexto_otto).
// Correlação por telefone no formato canônico "whatsapp:+55DDDNUMERO".
// Segurança: verify_jwt=false + secret em ?secret= / header x-ficha-secret / body.secret.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ficha-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const EXPECTED_SECRET = Deno.env.get("LEAD_SITE_SECRET") ?? "";
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// "41999998888" -> "whatsapp:+5541999998888" (igual ao clientes.telefone do twilio-webhook)
function toWhatsapp(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 11 && !d.startsWith("55")) d = "55" + d; // BR sem código do país
  return "whatsapp:+" + d;
}
// Próximo id FGM<n>@<YYMMDD> — MESMA lógica do criar-ficha-do-bot => mesma sequência
async function gerarProximoId(supabase: any): Promise<string> {
  const brasil = new Date(Date.now() - 3 * 60 * 60 * 1000); // UTC-3
  const sufixo = `@${String(brasil.getUTCFullYear()).slice(-2)}${String(brasil.getUTCMonth() + 1).padStart(2, "0")}${String(brasil.getUTCDate()).padStart(2, "0")}`;
  const { data, error } = await supabase.from("fichas_de_servico").select("id").like("id", `FGM%${sufixo}`);
  if (error) throw new Error(`buscar IDs do dia: ${error.message}`);
  let maxN = 0;
  for (const row of data ?? []) { const m = /^FGM(\d+)@\d{6}$/.exec(row.id); if (m) { const n = +m[1]; if (n > maxN) maxN = n; } }
  return `FGM${maxN + 1}${sufixo}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let body: Record<string, any> = {};
    try { body = await req.json(); } catch { body = {}; }
    const url = new URL(req.url);
    const provided = url.searchParams.get("secret") || req.headers.get("x-ficha-secret") || body.secret || "";
    if (!EXPECTED_SECRET || provided !== EXPECTED_SECRET) return json({ error: "unauthorized" }, 401);

    const cliente = body.cliente ?? {}, selecao = body.selecao ?? {}, escopo = body.escopo_cliente ?? {}, agend = body.agendamento ?? null;
    const telefone = toWhatsapp(String(cliente.whatsapp ?? cliente.telefone ?? ""));
    if (!telefone || telefone.length < 14) return json({ error: "cliente.whatsapp inválido" }, 400);
    let nome = String(cliente.nome ?? "").trim() || "Cliente";
    if (!nome.includes(" ")) nome = `${nome} (site)`;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) Garante o cliente (FK fichas.telefone_cliente -> clientes.telefone)
    const { data: cli } = await supabase.from("clientes").select("telefone").eq("telefone", telefone).maybeSingle();
    if (!cli) {
      const { error: e } = await supabase.from("clientes").insert({ telefone, nome });
      if (e) return json({ error: `cliente: ${e.message}` }, 500);
    }

    // 2) Cria a ficha na sequência FGM (única, igual ao bot)
    const fichaId = await gerarProximoId(supabase);
    const descricao = [
      selecao.cat && `Tipo: ${selecao.cat}`, selecao.sub && `Local: ${selecao.sub}`,
      escopo.estimativa && `Valor: ${escopo.estimativa}`, escopo.inclui && `Inclui: ${escopo.inclui}`,
      escopo.nao_inclui && `Não inclui: ${escopo.nao_inclui}`, escopo.notas && `Notas: ${escopo.notas}`,
    ].filter(Boolean).join(" | ");
    const insert: Record<string, unknown> = {
      id: fichaId, telefone_cliente: telefone, nome_cliente: nome,
      descricao: descricao || null,
      cidade: cliente.cidade || cliente.regiao || null,
      preferencia_horario_cliente: agend?.data_pretty ? `${agend.data_pretty} ${agend.janela ?? ""}`.trim() : null,
      // status default 'Ficha Criada'; categoria_id fica nulo (mapeie depois se quiser)
    };
    const { data: inserted, error: insErr } = await supabase.from("fichas_de_servico").insert(insert).select("id").maybeSingle();
    if (insErr) return json({ error: `ficha: ${insErr.message}` }, 500);
    const ficha_id = inserted?.id ?? fichaId;

    // 3) Marca a ficha como ativa do cliente (o twilio-webhook usa pra correlacionar)
    await supabase.from("clientes").update({ ficha_ativa_id: ficha_id }).eq("telefone", telefone);

    // 4) Escopo exibido ao cliente -> Otto reforça (v_contexto_otto lê pre_qualificacao_bot)
    await supabase.from("pre_qualificacao_bot").insert({
      ficha_id, sku_sugerido: selecao.sku ?? null,
      dados: { origem: "site", selecao, escopo_cliente: escopo, perguntas: body.perguntas ?? {}, agendamento: agend, mensagem_whatsapp: body.mensagem_whatsapp ?? "" },
    });

    return json({ ok: true, ficha_id });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
