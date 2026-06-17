// Edge Function: responder-convite
// Endpoint público (sem JWT) que recebe cliques nos links SIM/NÃO do convite ao prestador.
// GET /responder-convite?t=TOKEN&r=sim|nao

import { createClient } from "npm:@supabase/supabase-js@2";

function html(body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>24help</title>
<style>
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#f7f7f8;color:#111;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.06);padding:32px;max-width:420px;width:100%;text-align:center}
h1{font-size:22px;margin:8px 0 4px}
p{margin:8px 0;color:#555;font-size:15px;line-height:1.5}
.brand{color:#e84a3f;font-weight:700;letter-spacing:.5px;font-size:13px;text-transform:uppercase}
.ico{font-size:48px;margin-bottom:8px}
.ok{color:#16a34a}.no{color:#dc2626}.warn{color:#d97706}
</style></head><body><div class="card">${body}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") || "";
  const r = (url.searchParams.get("r") || "").toLowerCase();

  if (!token || !["sim", "nao"].includes(r)) {
    return html(`<div class="ico warn">⚠️</div><div class="brand">24help</div><h1>Link inválido</h1><p>Pode ser que esse link esteja incompleto.</p>`, 400);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: convite } = await supabase
    .from("convites_prestador")
    .select("id, status, expira_em, prestador_nome, ficha_id")
    .eq("token", token)
    .maybeSingle();

  if (!convite) {
    return html(`<div class="ico warn">⚠️</div><div class="brand">24help</div><h1>Convite não encontrado</h1>`, 404);
  }

  if (convite.status === "aceito") {
    return html(`<div class="ico ok">✅</div><div class="brand">24help</div><h1>Convite já aceito</h1><p>Obrigado, ${convite.prestador_nome || ""}! Já registramos sua confirmação.</p>`);
  }
  if (convite.status === "recusado") {
    return html(`<div class="ico no">❌</div><div class="brand">24help</div><h1>Convite já recusado</h1><p>Sem problemas. Já registramos a recusa.</p>`);
  }
  if (convite.status === "cancelado") {
    return html(`<div class="ico warn">⚠️</div><div class="brand">24help</div><h1>Convite cancelado</h1><p>Este convite foi cancelado pela equipe.</p>`);
  }
  if (convite.status === "expirado" || new Date(convite.expira_em).getTime() < Date.now()) {
    if (convite.status === "pendente") {
      await supabase.from("convites_prestador").update({ status: "expirado" }).eq("id", convite.id);
    }
    return html(`<div class="ico warn">⏰</div><div class="brand">24help</div><h1>Tempo esgotado</h1><p>Este convite expirou (10 minutos). Aguarde um contato da equipe.</p>`, 410);
  }

  const novoStatus = r === "sim" ? "aceito" : "recusado";
  const { error } = await supabase
    .from("convites_prestador")
    .update({ status: novoStatus, respondido_em: new Date().toISOString() })
    .eq("id", convite.id)
    .eq("status", "pendente");

  if (error) {
    return html(`<div class="ico warn">⚠️</div><div class="brand">24help</div><h1>Erro ao registrar</h1><p>Tente novamente em instantes.</p>`, 500);
  }

  if (novoStatus === "aceito") {
    return html(`<div class="ico ok">✅</div><div class="brand">24help</div><h1>Convite aceito!</h1><p>Obrigado, ${convite.prestador_nome || ""}! A equipe vai te chamar aqui no WhatsApp com os próximos passos.</p>`);
  }
  return html(`<div class="ico no">❌</div><div class="brand">24help</div><h1>Convite recusado</h1><p>Tudo bem, ${convite.prestador_nome || ""}. Já registramos a recusa.</p>`);
});
