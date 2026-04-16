import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const ASAAS_TIMEOUT_MS = 5000;
const FALLBACK_FICHA_LIMIT = 100;
const VALOR_TOLERANCIA = 0.5;

async function logAudit(
  supabase: any,
  fichaId: string,
  etapa: string,
  status: string,
  detalhe?: string,
  paymentId?: string,
) {
  try {
    await supabase.from("automation_audit").insert({
      ficha_id: fichaId,
      etapa,
      status,
      detalhe: detalhe?.substring(0, 1000),
      payment_id: paymentId,
    });
  } catch (e) {
    console.warn("[asaas-webhook] ⚠️ Erro ao registrar audit:", e);
  }
}

/** fetch com timeout — evita travar a function se a API do Asaas estiver lenta. */
async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = ASAAS_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function extractPaymentLinkCode(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.at(-1) ?? trimmed;
  } catch {
    return trimmed;
  }
}

async function findFichaIdByStoredPaymentLink(supabase: any, paymentLinkValue?: string | null) {
  const paymentLinkCode = extractPaymentLinkCode(paymentLinkValue);
  if (!paymentLinkCode) return null;

  const suffixPattern = `%/${paymentLinkCode}`;

  const { data: contaByLink, error: contaByLinkError } = await supabase
    .from("contas_receber")
    .select("ficha_id, pagamento_link, created_at")
    .ilike("pagamento_link", suffixPattern)
    .order("created_at", { ascending: false })
    .limit(1);

  if (contaByLinkError) {
    console.warn("[asaas-webhook] ⚠️ Erro buscando conta por paymentLink:", contaByLinkError.message);
  }

  if (contaByLink?.length) {
    console.log(`[asaas-webhook] 🔍 Ficha via contas_receber.payment_link: ${contaByLink[0].ficha_id}`);
    return contaByLink[0].ficha_id as string;
  }

  const { data: fichaByLink, error: fichaByLinkError } = await supabase
    .from("fichas_de_servico")
    .select("id, pagamento_link, created_at")
    .ilike("pagamento_link", suffixPattern)
    .order("created_at", { ascending: false })
    .limit(1);

  if (fichaByLinkError) {
    console.warn("[asaas-webhook] ⚠️ Erro buscando ficha por paymentLink:", fichaByLinkError.message);
  }

  if (fichaByLink?.length) {
    console.log(`[asaas-webhook] 🔍 Ficha via fichas_de_servico.payment_link: ${fichaByLink[0].id}`);
    return fichaByLink[0].id as string;
  }

  return null;
}

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(-11);
}

function normalizeCpfCnpj(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

type FichaCandidate = {
  id: string;
  telefone_cliente: string | null;
  cpf: string | null;
  valor_total: number | null;
  status: string | null;
  pagamento_realizado: boolean | null;
  created_at: string | null;
};

/**
 * Filtra fichas casando o valor pago contra valor_total (à vista) ou parcelas (2..12).
 * Retorna apenas matches ÚNICOS — se houver ambiguidade, devolve null para evitar
 * marcar a ficha errada como paga.
 */
function pickUniqueByValue(
  fichas: FichaCandidate[],
  paymentValue: number | null | undefined,
): { match: FichaCandidate | null; ambiguous: FichaCandidate[] } {
  if (!fichas.length) return { match: null, ambiguous: [] };

  // Se uma única ficha existe e não temos valor, ainda é seguro retornar
  if (!paymentValue || paymentValue <= 0) {
    return fichas.length === 1
      ? { match: fichas[0], ambiguous: [] }
      : { match: null, ambiguous: fichas };
  }

  const matches = fichas.filter((f) => {
    const total = Number(f.valor_total) || 0;
    if (Math.abs(total - paymentValue) <= VALOR_TOLERANCIA) return true;
    for (let n = 2; n <= 12; n++) {
      if (Math.abs(total / n - paymentValue) <= VALOR_TOLERANCIA) return true;
    }
    return false;
  });

  if (matches.length === 1) return { match: matches[0], ambiguous: [] };
  if (matches.length > 1) return { match: null, ambiguous: matches };
  return { match: null, ambiguous: [] };
}

async function fetchAsaasCustomer(customerId: string): Promise<any | null> {
  const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
  if (!asaasApiKey) {
    console.warn("[asaas-webhook] ⚠️ ASAAS_API_KEY ausente — não é possível buscar customer");
    return null;
  }
  try {
    const res = await fetchWithTimeout(`https://api.asaas.com/v3/customers/${customerId}`, {
      headers: { access_token: asaasApiKey },
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[asaas-webhook] ⚠️ Asaas customers lookup falhou (${res.status}): ${body.substring(0, 300)}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    const isAbort = (e as any)?.name === "AbortError";
    console.warn(`[asaas-webhook] ⚠️ ${isAbort ? "Timeout" : "Erro"} ao buscar customer no Asaas:`, e);
    return null;
  }
}

/**
 * Estratégia 5: identificação por dados do cliente Asaas + valor.
 * Busca por CPF (mais confiável) E por telefone, combina os candidatos
 * e desambigua pelo valor. Não filtra por pagamento_realizado=false:
 * se a ficha já está paga, o caller (linha mais abaixo) trata como already_paid.
 */
async function findFichaByCustomerSignals(
  supabase: any,
  customerId: string,
  paymentValue?: number | null,
): Promise<{ fichaId: string | null; reason: string }> {
  const customer = await fetchAsaasCustomer(customerId);
  if (!customer) return { fichaId: null, reason: "customer_lookup_falhou" };

  const cpfCnpj = normalizeCpfCnpj(customer.cpfCnpj);
  const phones = [customer.mobilePhone, customer.phone]
    .map(normalizePhone)
    .filter((p): p is string => Boolean(p));

  if (!cpfCnpj && !phones.length) {
    return { fichaId: null, reason: "customer_sem_cpf_nem_telefone" };
  }

  const candidatesMap = new Map<string, FichaCandidate>();

  // Busca por CPF (mais confiável)
  if (cpfCnpj) {
    const { data, error } = await supabase
      .from("fichas_de_servico")
      .select("id, telefone_cliente, cpf, valor_total, status, pagamento_realizado, created_at")
      .eq("cpf", cpfCnpj)
      .order("created_at", { ascending: false })
      .limit(FALLBACK_FICHA_LIMIT);

    if (error) {
      console.warn("[asaas-webhook] ⚠️ Erro buscando fichas por CPF:", error.message);
    } else {
      for (const f of data ?? []) candidatesMap.set(f.id, f as FichaCandidate);
    }
  }

  // Busca por telefone (sufixo, tolera variações com/sem 55)
  if (phones.length) {
    const orFilter = phones.map((p) => `telefone_cliente.ilike.%${p}`).join(",");
    const { data, error } = await supabase
      .from("fichas_de_servico")
      .select("id, telefone_cliente, cpf, valor_total, status, pagamento_realizado, created_at")
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(FALLBACK_FICHA_LIMIT);

    if (error) {
      console.warn("[asaas-webhook] ⚠️ Erro buscando fichas por telefone:", error.message);
    } else {
      for (const f of data ?? []) {
        if (!candidatesMap.has(f.id)) candidatesMap.set(f.id, f as FichaCandidate);
      }
    }
  }

  const candidates = Array.from(candidatesMap.values());

  if (!candidates.length) {
    return { fichaId: null, reason: `nenhuma_ficha_para_cpf=${cpfCnpj ?? "-"}_phones=${phones.join("|") || "-"}` };
  }

  // Prioriza fichas pendentes para a desambiguação por valor
  const pendentes = candidates.filter((c) => !c.pagamento_realizado);
  const pool = pendentes.length ? pendentes : candidates;

  const { match, ambiguous } = pickUniqueByValue(pool, paymentValue);

  if (match) {
    console.log(`[asaas-webhook] 🔍 Ficha via cliente+valor: ${match.id} (cpf=${cpfCnpj ?? "-"})`);
    return { fichaId: match.id, reason: "match_unico_por_valor" };
  }

  if (ambiguous.length > 1) {
    return {
      fichaId: null,
      reason: `ambiguo_${ambiguous.length}_fichas:${ambiguous.map((a) => a.id).join(",")}`,
    };
  }

  return {
    fichaId: null,
    reason: `cliente_tem_${candidates.length}_fichas_mas_nenhuma_casa_valor=${paymentValue}`,
  };
}

/** Resposta padrão para "não conseguimos vincular" — sempre 200 + flag para Asaas não penalizar. */
function unidentifiedResponse(paymentId: string, message: string) {
  return new Response(
    JSON.stringify({
      success: false,
      unidentified: true,
      message,
      payment_id: paymentId,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[asaas-webhook] Nova requisição recebida");

  try {
    // ========== AUTH ==========
    const asaasToken = req.headers.get("asaas-access-token");
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

    if (expectedToken && asaasToken !== expectedToken) {
      console.error(`[asaas-webhook] ❌ Token inválido`);
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { event, payment } = body;

    console.log(`[asaas-webhook] 📩 Evento: ${event}, Payment ID: ${payment?.id}`);

    const paymentEvents = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];
    if (!paymentEvents.includes(event)) {
      console.log(`[asaas-webhook] ⏭️ Evento ${event} ignorado`);
      return new Response(
        JSON.stringify({ success: true, ignored: true, event }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!payment) {
      console.error("[asaas-webhook] ❌ Payload sem objeto payment");
      return new Response(
        JSON.stringify({ error: "Payload inválido - sem payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========== IDEMPOTÊNCIA (cobre success E unidentified) ==========
    const { data: auditExistente, error: auditQueryError } = await supabase
      .from("automation_audit")
      .select("id, status, ficha_id")
      .eq("etapa", "webhook_pagamento")
      .in("status", ["success", "unidentified"])
      .eq("payment_id", payment.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (auditQueryError) {
      // Não falhar o webhook por erro de leitura na auditoria — apenas logar
      console.warn(`[asaas-webhook] ⚠️ Erro consultando idempotência: ${auditQueryError.message}`);
    }

    if (auditExistente) {
      console.log(`[asaas-webhook] ⏭️ Payment ${payment.id} já processado (${auditExistente.status})`);
      return new Response(
        JSON.stringify({
          success: true,
          already_processed: true,
          previous_status: auditExistente.status,
          payment_id: payment.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ========== IDENTIFICAR FICHA ==========
    let fichaId: string | null = null;
    const trail: string[] = [];

    // Estratégia 1: externalReference
    if (payment.externalReference) {
      fichaId = payment.externalReference;
      trail.push(`externalReference=${fichaId}`);
    }

    // Estratégia 2: description regex
    if (!fichaId && payment.description) {
      const match = payment.description.match(/^(F[A-Z0-9@\\-]+)\s*-/);
      if (match) {
        fichaId = match[1];
        trail.push(`description=${fichaId}`);
      }
    }

    // Estratégia 3: paymentLink salvo localmente
    if (!fichaId && payment.paymentLink) {
      fichaId = await findFichaIdByStoredPaymentLink(supabase, payment.paymentLink);
      if (fichaId) trail.push(`stored_paymentLink=${fichaId}`);
    }

    // Estratégia 4: paymentLink lookup na API do Asaas
    if (!fichaId && payment.paymentLink) {
      const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
      if (asaasApiKey) {
        try {
          const linkRes = await fetchWithTimeout(
            `https://api.asaas.com/v3/paymentLinks/${payment.paymentLink}`,
            { headers: { access_token: asaasApiKey } },
          );

          if (!linkRes.ok) {
            const errorBody = await linkRes.text();
            console.warn(`[asaas-webhook] ⚠️ Asaas paymentLinks lookup falhou (${linkRes.status}): ${errorBody.substring(0, 300)}`);
          } else {
            const linkData = await linkRes.json();
            if (linkData.externalReference) {
              fichaId = linkData.externalReference;
              trail.push(`link.externalReference=${fichaId}`);
            }
            if (!fichaId && linkData.url) {
              fichaId = await findFichaIdByStoredPaymentLink(supabase, linkData.url);
              if (fichaId) trail.push(`link.url=${fichaId}`);
            }
            if (!fichaId && linkData.name) {
              const m = linkData.name.match(/^(F[A-Z0-9@\\-]+)\s*-/);
              if (m) {
                fichaId = m[1];
                trail.push(`link.name=${fichaId}`);
              }
            }
          }
        } catch (e) {
          const isAbort = (e as any)?.name === "AbortError";
          console.warn(`[asaas-webhook] ⚠️ ${isAbort ? "Timeout" : "Erro"} no lookup de paymentLink:`, e);
        }
      }
    }

    // Estratégia 5: cliente Asaas (CPF + telefone) + valor
    if (!fichaId && payment.customer) {
      const result = await findFichaByCustomerSignals(supabase, payment.customer, payment.value);
      if (result.fichaId) {
        fichaId = result.fichaId;
        trail.push(`customer_signals=${fichaId}`);
      } else {
        trail.push(`customer_signals_falhou:${result.reason}`);
      }
    }

    // ========== NÃO IDENTIFICADO — sempre 200 + audit ==========
    if (!fichaId) {
      const detalhe = `Payment ${payment.id} sem ficha. Trail: ${trail.join(" | ")} | customer=${payment.customer} link=${payment.paymentLink} value=${payment.value}`;
      console.error(`[asaas-webhook] ❌ Não identificado: ${detalhe}`);
      await logAudit(supabase, "DESCONHECIDA", "webhook_pagamento", "unidentified", detalhe, payment.id);
      return unidentifiedResponse(payment.id, "Pagamento recebido mas não vinculado a nenhuma ficha. Registrado para revisão manual.");
    }

    await logAudit(supabase, fichaId, "webhook_pagamento", "started", `Event: ${event} | Trail: ${trail.join(" | ")}`, payment.id);

    // ========== VERIFICAR FICHA ==========
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_de_servico")
      .select("id, pagamento_realizado, notas, nome_cliente, valor_total, telefone_cliente, status")
      .eq("id", fichaId)
      .maybeSingle();

    if (fichaError) {
      // Erro real de banco — devolve 500 para Asaas retentar
      console.error(`[asaas-webhook] ❌ Erro consultando ficha: ${fichaError.message}`);
      await logAudit(supabase, fichaId, "webhook_pagamento", "error", `DB error: ${fichaError.message}`, payment.id);
      return new Response(
        JSON.stringify({ error: "Erro consultando ficha", details: fichaError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ficha) {
      // Ficha indicada mas não existe → trata como órfão (200), não 404
      const detalhe = `Ficha ${fichaId} indicada por trail mas não existe no banco. Trail: ${trail.join(" | ")}`;
      console.error(`[asaas-webhook] ❌ ${detalhe}`);
      await logAudit(supabase, fichaId, "webhook_pagamento", "unidentified", detalhe, payment.id);
      return unidentifiedResponse(payment.id, `Ficha ${fichaId} não localizada. Registrado para revisão manual.`);
    }

    if (ficha.pagamento_realizado) {
      console.log(`[asaas-webhook] ⏭️ Ficha ${fichaId} já paga`);
      await logAudit(supabase, fichaId, "webhook_pagamento", "success", `Já estava paga (idempotência tardia)`, payment.id);
      return new Response(
        JSON.stringify({ success: true, already_paid: true, ficha_id: fichaId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ========== ATUALIZAR FICHA (com guarda anti-race) ==========
    const agora = new Date().toISOString();
    const valorPago = payment.value || ficha.valor_total || 0;
    const logEntry = `[${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}] ✅ Pagamento confirmado automaticamente via Asaas (${event}) — Valor: R$ ${valorPago.toFixed(2)} — Payment ID: ${payment.id}`;
    const notasAtualizadas = ficha.notas ? `${ficha.notas}\n${logEntry}` : logEntry;

    const updatePayload: Record<string, unknown> = {
      pagamento_realizado: true,
      notas: notasAtualizadas,
    };

    const statusParaGarantia = ["Finalizado", "Em andamento", "Agendado"];
    if (statusParaGarantia.includes(ficha.status as string)) {
      updatePayload.status = "Garantia";
      console.log(`[asaas-webhook] 🔄 Status mudado para Garantia (era: ${ficha.status})`);
    }

    // Guarda: só atualiza se ainda estiver pagamento_realizado=false.
    // Se outro evento (PAYMENT_CONFIRMED vs PAYMENT_RECEIVED) já marcou, não duplicamos recibo/NPS.
    const { data: updated, error: updateError } = await supabase
      .from("fichas_de_servico")
      .update(updatePayload)
      .eq("id", fichaId)
      .eq("pagamento_realizado", false)
      .select("id");

    if (updateError) {
      console.error(`[asaas-webhook] ❌ Erro ao atualizar ficha: ${updateError.message}`);
      await logAudit(supabase, fichaId, "webhook_pagamento", "error", `Erro update ficha: ${updateError.message}`, payment.id);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar ficha", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!updated || updated.length === 0) {
      // Outro evento concorrente venceu o race — abortamos os side effects para não duplicar
      console.log(`[asaas-webhook] ⏭️ Ficha ${fichaId} foi marcada paga concorrentemente — abortando side effects`);
      await logAudit(supabase, fichaId, "webhook_pagamento", "success", `Race detectado: outro evento já marcou pago`, payment.id);
      return new Response(
        JSON.stringify({ success: true, race_aborted: true, ficha_id: fichaId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[asaas-webhook] ✅ Ficha ${fichaId} marcada como paga`);

    // ========== CONTAS A RECEBER ==========
    const { data: contaReceber } = await supabase
      .from("contas_receber")
      .select("id")
      .eq("ficha_id", fichaId)
      .maybeSingle();

    if (contaReceber) {
      const { error: contaError } = await supabase
        .from("contas_receber")
        .update({
          status: "pago",
          data_pagamento: agora.split("T")[0],
          asaas_id: payment.id,
          asaas_status: event,
        })
        .eq("id", contaReceber.id);

      if (contaError) {
        console.warn(`[asaas-webhook] ⚠️ Erro ao atualizar conta a receber: ${contaError.message}`);
        await logAudit(supabase, fichaId, "contas_receber", "error", contaError.message, payment.id);
      } else {
        console.log(`[asaas-webhook] ✅ Conta a receber atualizada`);
      }
    }

    // ========== TRANSAÇÃO FINANCEIRA ==========
    const { error: transError } = await supabase
      .from("transacoes_financeiras")
      .update({
        status_pagamento_cliente: "pago",
        data_pagamento_realizada: agora,
      })
      .eq("ficha_id", fichaId);

    if (transError) {
      console.warn(`[asaas-webhook] ⚠️ Erro ao atualizar transação: ${transError.message}`);
      await logAudit(supabase, fichaId, "transacao", "error", transError.message, payment.id);
    }

    // ========== RECIBO ==========
    try {
      const reciboRes = await fetchWithTimeout(
        `${supabaseUrl}/functions/v1/send-recibo`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            ficha_id: fichaId,
            telefone_cliente: ficha.telefone_cliente,
          }),
        },
        15000,
      );
      const reciboBody = await reciboRes.text();
      await logAudit(
        supabase,
        fichaId,
        "recibo",
        reciboRes.status < 300 ? "success" : "error",
        `Status: ${reciboRes.status}, Body: ${reciboBody.substring(0, 300)}`,
        payment.id,
      );
    } catch (reciboErr) {
      console.warn("[asaas-webhook] ⚠️ Erro ao disparar send-recibo:", reciboErr);
      await logAudit(supabase, fichaId, "recibo", "error", `Exceção: ${reciboErr}`, payment.id);
    }

    // ========== NPS ==========
    try {
      const npsRes = await fetchWithTimeout(
        `${supabaseUrl}/functions/v1/send-nps`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            ficha_id: fichaId,
            telefone_cliente: ficha.telefone_cliente,
          }),
        },
        15000,
      );
      const npsBody = await npsRes.text();
      await logAudit(
        supabase,
        fichaId,
        "nps",
        npsRes.status < 300 ? "success" : "error",
        `Status: ${npsRes.status}, Body: ${npsBody.substring(0, 300)}`,
        payment.id,
      );
    } catch (npsErr) {
      console.warn("[asaas-webhook] ⚠️ Erro ao disparar send-nps:", npsErr);
      await logAudit(supabase, fichaId, "nps", "error", `Exceção: ${npsErr}`, payment.id);
    }

    // ========== WEBHOOK PLANILHA ==========
    try {
      const webhookUrl = Deno.env.get("MAKE_WEBHOOK_UPDATE_PLANILHA");
      if (webhookUrl) {
        await fetchWithTimeout(
          webhookUrl,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo: "pagamento_cliente_confirmado",
              ficha_id: fichaId,
              valor_pago: valorPago,
              data_pagamento: agora,
              origem: "asaas_webhook",
              payment_id: payment.id,
              event,
            }),
          },
          10000,
        );
        console.log(`[asaas-webhook] ✅ Webhook planilha disparado`);
      }
    } catch (e) {
      console.warn("[asaas-webhook] ⚠️ Erro ao disparar webhook planilha:", e);
      await logAudit(supabase, fichaId, "webhook_planilha", "error", `${e}`, payment.id);
    }

    const duration = Date.now() - startTime;
    await logAudit(supabase, fichaId, "webhook_pagamento", "success", `Valor: ${valorPago}, Event: ${event}, Duration: ${duration}ms`, payment.id);
    console.log(`[asaas-webhook] ✅ Concluído em ${duration}ms — Ficha: ${fichaId}`);

    return new Response(
      JSON.stringify({
        success: true,
        ficha_id: fichaId,
        event,
        valor_pago: valorPago,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[asaas-webhook] 💥 Erro interno:", err);
    return new Response(
      JSON.stringify({
        error: "Erro interno",
        details: err instanceof Error ? err.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
