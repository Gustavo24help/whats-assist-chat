// Edge Function: enviar-convite-prestador
// Envia convite de serviço ao prestador via WhatsApp (canal prestador, TWILIO_PHONE_NUMBER_2)
// com resumo do serviço e links SIM/NÃO. Expira em 10 minutos.
//
// Requer JWT (operador autenticado).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function fmtMoeda(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n));
}

function fmtData(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = String(d).split("-");
  return `${day}/${m}/${y}`;
}

function fmtHora(h: string | null | undefined) {
  if (!h) return "";
  return String(h).slice(0, 5);
}

function gerarToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizaTelefone(raw: string): string {
  let d = String(raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length < 10) return "";
  const ddd = d.slice(0, 2);
  let sub = d.slice(2);
  if (sub.length === 9 && sub[0] === "9") sub = sub.slice(1); // remove 9
  return `whatsapp:+55${ddd}${sub}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return j({ error: "missing auth" }, 401);

    // Verifica usuário
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return j({ error: "invalid auth" }, 401);

    const operadorId = userData.user.id;
    const operadorNome =
      (userData.user.user_metadata as any)?.full_name ||
      (userData.user.user_metadata as any)?.name ||
      userData.user.email ||
      "Operador";

    const body = await req.json().catch(() => ({}));
    const ficha_id = String(body?.ficha_id ?? "").trim();
    const prestador_cpf = String(body?.prestador_cpf ?? "").trim();
    if (!ficha_id || !prestador_cpf) return j({ error: "ficha_id e prestador_cpf são obrigatórios" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Carrega ficha
    const { data: ficha, error: fErr } = await supabase
      .from("fichas_de_servico")
      .select(
        "id, nome_cliente, endereco, bairro, cidade, descricao, valor_total, valor_mao_obra, valor_pecas, data_agendamento, hora_inicio_agendamento, hora_fim_agendamento, categoria_id",
      )
      .eq("id", ficha_id)
      .maybeSingle();
    if (fErr || !ficha) return j({ error: "ficha não encontrada" }, 404);

    // 2) Carrega prestador
    const { data: prestador, error: pErr } = await supabase
      .from("prestadores")
      .select("cpf, nome, telefone, categoria")
      .eq("cpf", prestador_cpf)
      .maybeSingle();
    if (pErr || !prestador) return j({ error: "prestador não encontrado" }, 404);

    const prestadorTel = normalizaTelefone(prestador.telefone || "");
    if (!prestadorTel) return j({ error: "telefone do prestador inválido" }, 400);

    // 3) Cancela convites pendentes anteriores para esta ficha
    await supabase
      .from("convites_prestador")
      .update({ status: "cancelado" })
      .eq("ficha_id", ficha_id)
      .eq("status", "pendente");

    // 4) Dados do site (escopo) — opcional
    const { data: pq } = await supabase
      .from("pre_qualificacao_bot")
      .select("dados")
      .eq("ficha_id", ficha_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const dados: any = (pq as any)?.dados ?? {};
    const escopo = dados?.escopo_cliente ?? {};
    const inclui: string[] = Array.isArray(escopo?.inclui) ? escopo.inclui : [];
    const naoInclui: string[] = Array.isArray(escopo?.nao_inclui) ? escopo.nao_inclui : [];

    // 5) Monta resumo
    const token = gerarToken();
    const expira_em = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const dataStr = fmtData(ficha.data_agendamento);
    const horaIni = fmtHora(ficha.hora_inicio_agendamento);
    const horaFim = fmtHora(ficha.hora_fim_agendamento);
    const janela = horaIni ? (horaFim ? `${horaIni} às ${horaFim}` : horaIni) : "";
    const agendamentoStr = dataStr !== "—" ? `${dataStr}${janela ? ` (${janela})` : ""}` : "—";

    const enderecoLinha = [ficha.endereco, ficha.bairro, ficha.cidade].filter(Boolean).join(" - ") || "—";

    const linkBase = `${SUPABASE_URL}/functions/v1/responder-convite?t=${token}`;
    const linkSim = `${linkBase}&r=sim`;
    const linkNao = `${linkBase}&r=nao`;

    const partes: string[] = [];
    partes.push(`*📋 Novo serviço — 24help*`);
    partes.push(`Olá ${(prestador.nome || "").split(/\s+/)[0]}! Temos um serviço pra você:`);
    partes.push("");
    if (ficha.descricao) {
      partes.push(`*🔧 Serviço:* ${ficha.descricao}`);
    }
    partes.push(`*📍 Bairro:* ${ficha.bairro || "—"}`);
    partes.push(`*🏠 Endereço:* ${enderecoLinha}`);
    partes.push(`*📅 Data/Hora:* ${agendamentoStr}`);
    if (ficha.valor_total) {
      partes.push(`*💰 Valor:* ${fmtMoeda(ficha.valor_total)}`);
    } else if (ficha.valor_mao_obra) {
      partes.push(`*💰 Mão de obra:* ${fmtMoeda(ficha.valor_mao_obra)}`);
    }
    if (inclui.length) {
      partes.push("");
      partes.push(`*✅ O que inclui:*`);
      inclui.forEach((x) => partes.push(`• ${x}`));
    }
    if (naoInclui.length) {
      partes.push("");
      partes.push(`*❌ O que NÃO inclui:*`);
      naoInclui.forEach((x) => partes.push(`• ${x}`));
    }
    partes.push("");
    partes.push(`⏱ *Você tem 10 minutos para responder.*`);
    partes.push("");
    partes.push(`✅ ACEITAR: ${linkSim}`);
    partes.push(`❌ RECUSAR: ${linkNao}`);

    const resumo = partes.join("\n");

    // 6) Insere convite (status pendente)
    const { data: convite, error: cErr } = await supabase
      .from("convites_prestador")
      .insert({
        ficha_id,
        prestador_cpf: prestador.cpf,
        prestador_nome: prestador.nome,
        prestador_telefone: prestadorTel,
        token,
        status: "pendente",
        resumo_texto: resumo,
        expira_em,
        enviado_por_id: operadorId,
        enviado_por_nome: operadorNome,
      })
      .select("id")
      .single();
    if (cErr) return j({ error: cErr.message }, 500);

    // 7) Envia Twilio (canal prestador = TWILIO_PHONE_NUMBER_2)
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM_PRESTADOR = Deno.env.get("TWILIO_PHONE_NUMBER_2");
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM_PRESTADOR) {
      await supabase.from("convites_prestador").update({ status: "cancelado" }).eq("id", convite.id);
      return j({ error: "Twilio prestador não configurado" }, 500);
    }
    const from = TWILIO_FROM_PRESTADOR.startsWith("whatsapp:") ? TWILIO_FROM_PRESTADOR : `whatsapp:${TWILIO_FROM_PRESTADOR}`;

    const form = new URLSearchParams();
    form.append("To", prestadorTel);
    form.append("From", from);
    form.append("Body", resumo);

    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    const tw = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const twData = await tw.json().catch(() => ({}));
    if (!tw.ok) {
      console.error("[enviar-convite-prestador] Twilio:", tw.status, twData);
      await supabase.from("convites_prestador").update({ status: "cancelado" }).eq("id", convite.id);
      return j({ error: "twilio_failed", details: twData }, 500);
    }
    const sid = (twData as any)?.sid ?? null;
    if (sid) {
      await supabase.from("convites_prestador").update({ message_sid: sid }).eq("id", convite.id);
    }

    // 8) Grava em mensagens_prestadores para aparecer no chat
    await supabase.from("mensagens_prestadores").insert({
      prestador_telefone: prestadorTel,
      ficha_id,
      remetente: from,
      texto: resumo,
      tipo: "texto",
      status: "enviado",
      data_hora: new Date().toISOString(),
      numero_twilio: from,
      message_sid: sid,
      enviado_por_id: operadorId,
    });

    return j({ ok: true, convite_id: convite.id, expira_em, token });
  } catch (err) {
    console.error("[enviar-convite-prestador] fatal:", err);
    const m = err instanceof Error ? err.message : String(err);
    return j({ error: m }, 500);
  }
});
