import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildPhoneVariants(input: string): string[] {
  const v = new Set<string>();
  if (!input) return [];
  const raw = input.trim();
  v.add(raw);
  const noWhats = raw.replace(/^whatsapp:/i, "").trim();
  v.add(noWhats);
  const digits = noWhats.replace(/\D/g, "");
  if (!digits) return [...v];
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  v.add(digits);
  v.add(withCountry);
  v.add(withCountry.slice(2));
  v.add(`+${withCountry}`);
  v.add(`+${digits}`);
  v.add(`whatsapp:+${withCountry}`);
  v.add(`whatsapp:+${digits}`);
  v.add(`whatsapp:${withCountry}`);
  // Pegadinha do 9 (celular BR): gera a forma alternativa (com/sem o nono digito)
  // para casar linhas duplicadas que diferem so pelo 9.
  const ddd = withCountry.slice(2, 4);
  const sub = withCountry.slice(4);
  let alt = "";
  if (sub.length === 9 && sub.startsWith("9")) alt = `55${ddd}${sub.slice(1)}`;
  else if (sub.length === 8 && /[6-9]/.test(sub[0])) alt = `55${ddd}9${sub}`;
  if (alt) {
    v.add(alt);
    v.add(alt.slice(2));
    v.add(`+${alt}`);
    v.add(`whatsapp:+${alt}`);
    v.add(`whatsapp:${alt}`);
  }
  return [...v].filter(Boolean);
}

function isSnoozed(val: unknown): boolean {
  if (val == null) return false;
  if (val === "infinity") return true;
  const t = Date.parse(String(val));
  return !isNaN(t) && t > Date.now();
}

/**
 * Controle do bot, modelo soneca.
 *  - disable_bot (handoff): recomputa a soneca pelo status da ficha (force).
 *  - enable_bot  (religar):  limpa a soneca (bot volta agora).
 * Escreve em TODAS as variacoes do telefone. Mantem a interface antiga
 * (requested_action / bot_status) para Studio e stop-twilio-flow nao mudarem.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), {
      status: s,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const body = await req.json().catch(() => ({}) as any);
    const telefone: string | undefined = body.telefone;
    if (!telefone) return json({ error: "Telefone é obrigatório" }, 400);

    let action: "enable_bot" | "disable_bot" | undefined = body.requested_action;
    if (!action && body.bot_status) action = body.bot_status === "enabled" ? "enable_bot" : "disable_bot";
    if (!action) return json({ error: "requested_action é obrigatório (enable_bot|disable_bot)" }, 400);

    const variants = buildPhoneVariants(telefone);
    const origem = body.requested_origin ?? body.origem ?? "sistema";
    const trigger = body.trigger_source ?? "unspecified";
    const userId = body.executed_by_user_id ?? body.executado_por_id ?? null;

    let snooze: string | null = null;
    let acao: string;

    if (action === "enable_bot") {
      // Religar agora: limpa a soneca em todas as variacoes.
      await supabase
        .from("clientes")
        .update({ bot_snoozed_until: null, bot_habilitado: true })
        .in("telefone", variants);
      acao = "ligado";
      snooze = null;
    } else {
      // Desligar (handoff): a funcao central recomputa a soneca pelo status da ficha.
      const { error: rpcErr } = await supabase.rpc("recompute_bot_snooze", {
        p_telefone: telefone,
        p_force: true,
      });
      if (rpcErr) throw rpcErr;

      const { data: rows } = await supabase.from("clientes").select("bot_snoozed_until").in("telefone", variants);
      snooze =
        (rows ?? [])
          .map((r: any) => r.bot_snoozed_until)
          .filter(Boolean)
          .sort() // ISO ordena cronologicamente; 'infinity' fica por ultimo
          .pop() ?? null; // mais restritiva
      acao = "desligado";
    }

    // Auditoria enxuta (origem correta: cron/manual/sistema).
    await supabase.from("bot_historico").insert({
      telefone_cliente: telefone,
      acao,
      origem,
      executado_por_id: userId,
      observacao: `bot ${acao} (snooze=${snooze ?? "null"}) [trigger=${trigger}, origem=${origem}]`,
      request_id: body.request_id ?? crypto.randomUUID(),
    });

    return json({
      success: true,
      telefone,
      bot_status: isSnoozed(snooze) ? "disabled" : "enabled",
      bot_snoozed_until: snooze,
    });
  } catch (error) {
    return json(
      { error: "Erro interno do servidor", details: error instanceof Error ? error.message : "Erro desconhecido" },
      500,
    );
  }
});
