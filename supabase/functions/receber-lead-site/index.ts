// Edge Function: receber-lead-site
// Recebe o webhook do plugin WordPress (24help-form-builder) quando o cliente
// finaliza o agendamento no site, GERA o id no padrão FSE{seq}-{YYMMDD},
// cria a ficha em fichas_de_servico, faz upsert do cliente, salva o escopo em
// pre_qualificacao_bot (Otto lê via v_contexto_otto), seta clientes.ficha_ativa_id
// (correlação que o twilio-webhook usa) e DESLIGA o bot do cliente — assim, quando
// a pessoa mandar "vim pelo site da 24help" no WhatsApp, o atendimento já cai
// direto no operador (sem precisar mexer no Twilio Studio).
//
// Substitui a numeração que ficava no plugin (gen_ficha dormante desde a v1.7.2).
// Fonte única da sequência FSE: aqui. Várias LPs podem apontar o webhook pra cá.
//
// Segurança: público (verify_jwt=false) mas exige o secret LEAD_SITE_SECRET
// (header x-lead-secret / x-api-key, body.secret, OU query ?secret=).
// NÃO grava valor_total → não dispara o auto-finalizacao/Asaas (cobrança só em 'Finalizado').

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lead-secret, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// YYMMDD no horário do Brasil (UTC-3) — mesmo sufixo que o plugin usava.
function sufixoDataBrasil(): string {
  const agora = new Date();
  const brasil = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  const yy = String(brasil.getUTCFullYear()).slice(-2);
  const mm = String(brasil.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(brasil.getUTCDate()).padStart(2, "0");
  return `-${yy}${mm}${dd}`;
}

// Gera o próximo id FSE{n}-{YYMMDD} pegando o maior número do dia + 1.
async function gerarProximoFSE(
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  const sufixo = sufixoDataBrasil(); // ex.: "-260615"
  const { data, error } = await supabase
    .from("fichas_de_servico")
    .select("id")
    .like("id", `FSE%${sufixo}`);

  if (error) throw new Error(`Erro ao buscar IDs FSE do dia: ${error.message}`);

  let maxN = 0;
  for (const row of data ?? []) {
    const m = /^FSE(\d+)-\d{6}$/.exec(String((row as any).id));
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxN) maxN = n;
    }
  }
  return `FSE${maxN + 1}${sufixo}`;
}

// Telefone cru do site -> canônico "whatsapp:+55DDDNÚMERO" (igual ao From da Twilio).
function normalizeTelefoneSite(raw: unknown): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  d = d.replace(/^0+/, ""); // tira zeros de operadora/DDD
  // Tira o código do país só quando é claramente país+nacional (>= 12 díg.).
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  // d = DDD(2) + assinante. Se assinante tem 8 díg. e é celular (começa 6-9),
  // insere o 9º dígito → 13 díg. no total. (Fixo começa 2-5: NÃO insere.)
  if (d.length === 10 && /^[6-9]/.test(d.slice(2))) {
    d = d.slice(0, 2) + "9" + d.slice(2);
  }
  return "whatsapp:+55" + d;
}

function nonEmpty(v: unknown): string {
  const s = String(v ?? "").trim();
  return s && s.toLowerCase() !== "não informado" ? s : "";
}

// Acha o telefone no payload mesmo que o campo do admin não se chame "whatsapp".
function findTelefoneRaw(
  cliente: Record<string, any>,
  payload: Record<string, any>,
): string {
  const named =
    cliente.whatsapp ??
    cliente.telefone ??
    cliente.celular ??
    cliente.tel ??
    cliente.phone ??
    payload.telefone;
  if (nonEmpty(named)) return String(named);
  // Fallback: primeiro valor do cliente com cara de telefone (10–13 dígitos).
  for (const v of Object.values(cliente ?? {})) {
    const d = String(v ?? "").replace(/\D/g, "");
    if (d.length >= 10 && d.length <= 13) return String(v);
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ===== Auth por shared secret =====
    const expected = Deno.env.get("LEAD_SITE_SECRET") ?? "";
    if (!expected) {
      console.error("[receber-lead-site] LEAD_SITE_SECRET não configurado");
      return jsonResp({ error: "Secret não configurado no servidor" }, 500);
    }
    const url = new URL(req.url);
    let payload: Record<string, any> = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }
    // O secret pode vir no header, no body OU na query (?secret=). O plugin manda
    // pela query, então use || (string vazia cai pro próximo) — não ??.
    const headerSecret =
      req.headers.get("x-lead-secret") || req.headers.get("x-api-key") || "";
    const bodySecret =
      typeof payload.secret === "string" ? payload.secret : "";
    const querySecret = url.searchParams.get("secret") || "";
    const provided = headerSecret || bodySecret || querySecret;
    if (provided !== expected) {
      console.warn("[receber-lead-site] secret inválido");
      return jsonResp({ error: "Não autorizado" }, 401);
    }

    console.log(
      "[receber-lead-site] payload:",
      JSON.stringify(payload).substring(0, 800),
    );

    // ===== Extrai campos do payload do plugin =====
    const cliente = (payload.cliente ?? {}) as Record<string, any>;
    const orc = (payload.orcamento ?? {}) as Record<string, any>;
    const esc = (payload.escopo_cliente ?? {}) as Record<string, any>;
    const agend = (payload.agendamento ?? null) as Record<string, any> | null;

    const telefone_cliente = normalizeTelefoneSite(
      findTelefoneRaw(cliente, payload),
    );
    console.log("[receber-lead-site] telefone normalizado:", telefone_cliente);
    if (!telefone_cliente) {
      return jsonResp({ error: "telefone do cliente é obrigatório" }, 400);
    }
    const nome_cliente = nonEmpty(cliente.nome) || "Cliente";
    const lead_id = nonEmpty(payload.lead_id) || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ===== Idempotência: não duplica em reenvio/duplo-clique =====
    // Se já existe uma ficha FSE pra esse telefone criada nos últimos 2 min, reusa.
    const doisMinAtras = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: recente } = await supabase
      .from("fichas_de_servico")
      .select("id")
      .eq("telefone_cliente", telefone_cliente)
      .like("id", "FSE%")
      .gte("created_at", doisMinAtras)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recente?.id) {
      console.log(`[receber-lead-site] ficha recente reusada: ${recente.id}`);
      return jsonResp({ ok: true, ficha_id: recente.id, reused: true });
    }

    // ===== Gera o id FSE =====
    const ficha_id = await gerarProximoFSE(supabase);

    // ===== Upsert do cliente (não sobrescreve nome se já existir) =====
    const { data: cliExistente } = await supabase
      .from("clientes")
      .select("telefone")
      .eq("telefone", telefone_cliente)
      .maybeSingle();

    if (cliExistente) {
      await supabase
        .from("clientes")
        .update({
          ficha_ativa_id: ficha_id,
          ultima_interacao: new Date().toISOString(),
        })
        .eq("telefone", telefone_cliente);
    } else {
      const { error: cliErr } = await supabase.from("clientes").insert({
        telefone: telefone_cliente,
        nome: nome_cliente,
        status_conversa: "aberta",
        ficha_ativa_id: ficha_id,
        ultima_interacao: new Date().toISOString(),
        tags: [],
      });
      if (cliErr) {
        console.error("[receber-lead-site] erro criar cliente:", cliErr);
        return jsonResp({ error: `cliente: ${cliErr.message}` }, 500);
      }
    }

    // ===== Monta a descrição legível pro operador =====
    const descricao =
      [
        nonEmpty(orc.servico),
        nonEmpty(orc.problema) ? `Problema: ${nonEmpty(orc.problema)}` : "",
        nonEmpty(orc.tipo) ? `Tipo: ${nonEmpty(orc.tipo)}` : "",
        nonEmpty(orc.solucao) ? `Solução provável: ${nonEmpty(orc.solucao)}` : "",
        nonEmpty(esc.estimativa) ? `Estimativa: ${nonEmpty(esc.estimativa)}` : "",
        nonEmpty(orc.adicionais) ? `Adicionais: ${nonEmpty(orc.adicionais)}` : "",
        nonEmpty(orc.notas) ? `Obs: ${nonEmpty(orc.notas)}` : "",
      ]
        .filter(Boolean)
        .join("\n") || null;

    // Preferência de horário a partir do agendamento provisório do site.
    let preferencia_horario_cliente: string | null = null;
    let horario_agendamento: string | null = null;
    let hora_inicio_agendamento: string | null = null;
    let hora_fim_agendamento: string | null = null;
    let agendamento_provisorio = false;

    if (agend) {
      const partes = [nonEmpty(agend.data_pretty), nonEmpty(agend.janela)]
        .filter(Boolean)
        .join(" ");
      preferencia_horario_cliente = partes || null;

      const janelaRaw = nonEmpty(agend.janela);
      const dataRaw = nonEmpty(agend.data);
      if (janelaRaw && dataRaw) {
        const m = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(janelaRaw);
        if (m) {
          const inicio = m[1];
          const fim = m[2];
          horario_agendamento = `${dataRaw}T${inicio}:00-03:00`;
          hora_inicio_agendamento = inicio;
          hora_fim_agendamento = fim;
          agendamento_provisorio = true;
        }
      }
    }

    // ===== Insere a ficha (status default 'Ficha Criada'; SEM valor) =====
    const insertFicha: Record<string, unknown> = {
      id: ficha_id,
      nome_ficha: ficha_id,
      telefone_cliente,
      nome_cliente,
      descricao,
      preferencia_horario_cliente,
      horario_agendamento,
      hora_inicio_agendamento,
      hora_fim_agendamento,
      agendamento_provisorio,
    };
    Object.keys(insertFicha).forEach((k) => {
      if (insertFicha[k] === null || insertFicha[k] === undefined) {
        delete insertFicha[k];
      }
    });
    insertFicha.id = ficha_id; // garante o id mesmo após limpeza

    const { error: fichaErr } = await supabase
      .from("fichas_de_servico")
      .insert(insertFicha);

    if (fichaErr) {
      console.error("[receber-lead-site] erro insert ficha:", fichaErr);
      return jsonResp({ error: fichaErr.message }, 500);
    }
    console.log(`[receber-lead-site] ficha ${ficha_id} criada`);

    // ===== Salva o escopo/contexto completo em pre_qualificacao_bot (Otto) =====
    const dados = {
      origem: "site",
      lead_id,
      submission_id: payload.submission_id ?? null,
      form_id: payload.form_id ?? null,
      cliente: payload.cliente ?? {},
      orcamento: payload.orcamento ?? {},
      escopo_cliente: payload.escopo_cliente ?? {},
      perguntas: payload.perguntas ?? [],
      agendamento: payload.agendamento ?? null,
      mensagem_whatsapp: payload.mensagem_whatsapp ?? null,
      atribuicao: payload.origem ?? {},
    };
    const { error: pqErr } = await supabase.from("pre_qualificacao_bot").insert({
      ficha_id,
      dados,
      sku_sugerido: nonEmpty(orc.sku) || null,
    });
    if (pqErr) {
      // Não falha o request — a ficha já foi criada; pré-qualificação é complementar.
      console.warn(
        "[receber-lead-site] aviso pre_qualificacao_bot:",
        pqErr.message,
      );
    }

    // ===== Desliga o bot do cliente (origem automática — não trava reativação) =====
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const r = await fetch(`${supabaseUrl}/functions/v1/toggle-bot-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: telefone_cliente,
          requested_action: "disable_bot",
          requested_origin: "automatico",
          trigger_source: "webhook",
          request_id: `lead-site-${ficha_id}`,
        }),
      });
      if (!r.ok) {
        console.warn(
          "[receber-lead-site] toggle-bot-status falhou:",
          r.status,
          (await r.text()).slice(0, 300),
        );
      }
    } catch (e) {
      console.warn("[receber-lead-site] erro toggle-bot-status:", String(e));
    }

    return jsonResp({ ok: true, ficha_id });
  } catch (err) {
    console.error("[receber-lead-site] erro fatal:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResp({ error: msg }, 500);
  }
});
