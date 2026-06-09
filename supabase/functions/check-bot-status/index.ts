import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mesmas variacoes de telefone usadas no resto do sistema.
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

// A regra unica do bot: esta "em soneca" (desligado) se o campo for infinity
// ou uma data futura. NULL ou passado = bot pode falar.
function isSnoozed(val: unknown): boolean {
  if (val == null) return false;
  if (val === "infinity") return true;
  const t = Date.parse(String(val));
  return !isNaN(t) && t > Date.now();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), {
      status: s,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    const { telefone } = await req.json();
    if (!telefone) return json({ error: "Telefone é obrigatório" }, 400);

    const variants = buildPhoneVariants(telefone);

    const { data: rows, error } = await supabase
      .from("clientes")
      .select("telefone, bot_snoozed_until")
      .in("telefone", variants);

    if (error) {
      // Fail-closed: na duvida, silencia o bot.
      return json({
        bot_status: "disabled",
        telefone,
        message: "Erro ao consultar; bot desabilitado por seguranca (fail-closed)",
        error: error.message,
      });
    }

    // Cliente novo (sem registro) -> primeiro contato -> bot ativo.
    if (!rows || rows.length === 0) {
      return json({ bot_status: "enabled", telefone, message: "Cliente não encontrado, bot habilitado por padrão" });
    }

    // Se QUALQUER variacao do cliente estiver em soneca -> disabled (mais restritivo).
    const anySnoozed = rows.some((r: any) => isSnoozed(r.bot_snoozed_until));
    return json({
      bot_status: anySnoozed ? "disabled" : "enabled",
      telefone,
      matched_records: rows.length,
    });
  } catch (error) {
    return json(
      { error: "Erro interno do servidor", details: error instanceof Error ? error.message : "Erro desconhecido" },
      500,
    );
  }
});
