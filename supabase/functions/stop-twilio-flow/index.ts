import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  telefone: string;
  executado_por_id?: string; // legado
  executed_by_user_id?: string;
  // Novos campos opcionais. Sem eles, é tratado como automático.
  requested_origin?:
    | "manual"
    | "automatico"
    | "sistema"
    | "pre_qualificacao"
    | "template"
    | "cron";
  trigger_source?:
    | "manual_button"
    | "manual_template_button"
    | "system_template"
    | "automatic_template"
    | "pre_qualificacao_finalizada"
    | "cron"
    | "webhook"
    | "unspecified";
  request_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    // Suportar múltiplos Flow SIDs: TWILIO_FLOW_SIDS (csv) tem prioridade,
    // fallback para TWILIO_FLOW_SID (single).
    const flowSidsRaw =
      Deno.env.get("TWILIO_FLOW_SIDS") ?? Deno.env.get("TWILIO_FLOW_SID") ?? "";
    const flowSids = flowSidsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!accountSid || !authToken || flowSids.length === 0) {
      throw new Error("Credenciais Twilio não configuradas");
    }

    const body: RequestBody = await req.json();
    const telefone = body.telefone;

    if (!telefone) {
      return new Response(JSON.stringify({ error: "Telefone é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(
      `[stop-twilio-flow] Iniciando encerramento para: ${telefone} (flows=${flowSids.length})`,
    );

    // Normalizadores de telefone para comparação resiliente
    // (ex.: "whatsapp:+5541...", "+5541...", "5541...")
    const normalizePhone = (raw: string | null | undefined): string => {
      if (!raw) return "";
      return raw.replace(/^whatsapp:/i, "").replace(/[^0-9+]/g, "");
    };
    const targetNorm = normalizePhone(telefone);

    // 1) Encerrar TODAS execuções ativas em TODOS os flows configurados
    const auth = btoa(`${accountSid}:${authToken}`);

    const activeExecutions: Array<{ sid: string; flowSid: string }> = [];

    for (const flowSid of flowSids) {
      const baseUrl = `https://studio.twilio.com/v2/Flows/${flowSid}/Executions?PageSize=100`;
      let nextUrl: string | null = baseUrl;
      let pages = 0;

      while (nextUrl && pages < 10) {
        pages++;
        const executionsResponse: Response = await fetch(nextUrl, {
          method: "GET",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
        });

        if (!executionsResponse.ok) {
          const error = await executionsResponse.text();
          console.error(
            `[stop-twilio-flow] Erro ao buscar execuções (flow=${flowSid}):`,
            error,
          );
          // Não abortar todos os flows; seguir para o próximo
          break;
        }

        const executionsData: any = await executionsResponse.json();
        const matched = (executionsData.executions || []).filter(
          (exec: any) =>
            exec.status === "active" &&
            normalizePhone(exec.contact_channel_address) === targetNorm,
        );
        for (const m of matched) {
          activeExecutions.push({ sid: m.sid, flowSid });
        }
        nextUrl = executionsData?.meta?.next_page_url || null;
      }
    }

    console.log(
      `[stop-twilio-flow] Execuções ativas encontradas para ${telefone}: ${activeExecutions.length}`,
    );

    const stopResults = await Promise.allSettled(
      activeExecutions.map(async (exec) => {
        const stopUrl = `https://studio.twilio.com/v2/Flows/${exec.flowSid}/Executions/${exec.sid}`;
        const stopResponse = await fetch(stopUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ Status: "ended" }),
        });

        if (!stopResponse.ok) {
          const error = await stopResponse.text();
          throw new Error(`Falha ao encerrar ${exec.sid}: ${error}`);
        }

        console.log(`[stop-twilio-flow] ✅ Execução ${exec.sid} encerrada`);
        return exec.sid;
      }),
    );

    const stoppedSids = stopResults
      .filter((r) => r.status === "fulfilled")
      .map((r: any) => r.value);
    const failedStops = stopResults
      .filter((r) => r.status === "rejected")
      .map((r: any) => r.reason?.message || "erro desconhecido");

    if (failedStops.length > 0) {
      console.error("[stop-twilio-flow] Algumas execuções falharam:", failedStops);
    }

    const activeExecution = activeExecutions[0] || null;

    // 2) Delegar a alteração de estado do bot à função central.
    //    NÃO inferimos manual a partir de JWT. O caller decide a origem.
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Default: automático/webhook (Twilio chamando após finalização do flow).
    const requestedOrigin = body.requested_origin ?? "automatico";
    const triggerSource = body.trigger_source ?? "webhook";

    const executedByUserId =
      body.executed_by_user_id ?? body.executado_por_id ?? null;

    const togglePayload: Record<string, unknown> = {
      telefone,
      requested_action: "disable_bot",
      requested_origin: requestedOrigin,
      trigger_source: triggerSource,
      request_id: body.request_id ?? crypto.randomUUID(),
    };

    if (executedByUserId) {
      togglePayload.executed_by_user_id = executedByUserId;
    }

    // Encaminhar Authorization se vier — toggle-bot-status usa só para identificar o user.
    const forwardHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader) {
      forwardHeaders["Authorization"] = authHeader;
    }

    const toggleUrl = `${supabaseUrl}/functions/v1/toggle-bot-status`;
    const toggleResp = await fetch(toggleUrl, {
      method: "POST",
      headers: {
        ...forwardHeaders,
        // Service role como apikey para garantir entrada no Edge function
        apikey: supabaseKey,
      },
      body: JSON.stringify(togglePayload),
    });

    let toggleData: any = null;
    try {
      toggleData = await toggleResp.json();
    } catch {
      // ignore
    }

    if (!toggleResp.ok) {
      console.error(
        `[stop-twilio-flow] toggle-bot-status falhou (${toggleResp.status}):`,
        toggleData,
      );
    } else {
      console.log(
        `[stop-twilio-flow] toggle-bot-status OK: origem=${toggleData?.resolved_origin}, new=${JSON.stringify(toggleData?.new_state)}`,
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        executionSid: activeExecution?.sid ?? null,
        stoppedSids,
        stoppedCount: stoppedSids.length,
        failedCount: failedStops.length,
        bot_toggle: toggleData,
        message:
          stoppedSids.length > 0
            ? `Bot encerrado: ${stoppedSids.length} execução(ões) finalizada(s)`
            : "Bot desabilitado (nenhuma execução ativa encontrada)",
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[stop-twilio-flow] Erro:", error);
    return new Response(
      JSON.stringify({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
