import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Função central de controle do bot.
 *
 * REGRAS (fase simplificada):
 *  1. A IA/bot só responde quando bot_habilitado=true. Esta checagem fica no send-whatsapp.
 *  2. atendente_id NÃO é usado para bloquear ligar/desligar bot nesta fase.
 *  3. A origem só é tratada como "manual" quando:
 *       requested_origin === "manual"
 *     E trigger_source ∈ { "manual_button", "manual_template_button" }.
 *     Apenas presença de JWT NÃO transforma a ação em manual — o JWT só
 *     identifica executed_by_user_id.
 *  4. disable_bot manual:
 *       bot_habilitado=false, bot_desligado_manualmente=true.
 *  5. disable_bot automático/sistema/template/pre_qualificacao:
 *       bot_habilitado=false. NÃO altera bot_desligado_manualmente.
 *  6. enable_bot manual:
 *       bot_habilitado=true, bot_desligado_manualmente=false.
 *       Mantém a confirmação "LIGAR" já existente.
 *  7. enable_bot automático/cron:
 *       bot_habilitado=true. NÃO altera bot_desligado_manualmente.
 *       Se isso resultar em estado incoerente
 *       (bot_habilitado=true E bot_desligado_manualmente=true),
 *       gera log de incoerência (warning), sem bloquear a operação.
 */

type RequestedAction = "enable_bot" | "disable_bot";
type RequestedOrigin =
  | "manual"
  | "automatico"
  | "sistema"
  | "pre_qualificacao"
  | "template"
  | "cron";
type TriggerSource =
  | "manual_button"
  | "manual_template_button"
  | "system_template"
  | "automatic_template"
  | "pre_qualificacao_finalizada"
  | "cron"
  | "webhook"
  | "unspecified";

interface RequestBody {
  telefone: string;
  // Novos parâmetros
  requested_action?: RequestedAction;
  requested_origin?: RequestedOrigin;
  trigger_source?: TriggerSource;
  executed_by_user_id?: string;
  request_id?: string;
  template_name?: string;

  // Compatibilidade com clientes antigos
  bot_status?: "enabled" | "disabled";
  origem?: "manual" | "automatico" | "sistema";
  executado_por_id?: string;

  confirmacao?: string;
  force_reactivate_manual?: boolean;
  force_disable_after_reactivation?: boolean;
}

const MANUAL_TRIGGER_SOURCES: TriggerSource[] = [
  "manual_button",
  "manual_template_button",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const rawBody = await req.text();
    let body: RequestBody;
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = {} as RequestBody;
    }

    const inboundRequestId = body.request_id || crypto.randomUUID();
    const inboundUserAgent = req.headers.get("user-agent") || "desconhecido";
    const inboundIp =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "desconhecido";
    const inboundOrigin = req.headers.get("origin") || req.headers.get("referer") || "desconhecido";
    const inboundHasAuth = !!(req.headers.get("authorization") || req.headers.get("Authorization"));

    // 🔍 LOG DE ENTRADA (toda chamada vira linha em system_logs)
    // Isso permite rastrear chamadas que "somem" antes do bot_historico ser inserido.
    try {
      await supabase.from("system_logs").insert({
        nivel: "info",
        categoria: "bot",
        mensagem: `toggle-bot-status INBOUND: ${body.requested_action ?? body.bot_status ?? "?"} ${body.telefone ?? "?"}`,
        cliente_telefone: body.telefone ?? null,
        detalhes: {
          event: "toggle_bot_inbound",
          request_id: inboundRequestId,
          raw_body: rawBody.slice(0, 4000),
          parsed_body: body,
          headers: {
            origin: inboundOrigin,
            user_agent: inboundUserAgent,
            ip: inboundIp,
            has_auth: inboundHasAuth,
          },
          received_at: new Date().toISOString(),
        },
        url: "edge://toggle-bot-status",
        user_agent: inboundUserAgent,
      });
    } catch (logErr) {
      console.warn("[toggle-bot-status] falha ao gravar inbound log:", logErr);
    }

    const telefone = body.telefone;
    if (!telefone) {
      return new Response(JSON.stringify({ error: "Telefone é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Normalizar requested_action (com retrocompatibilidade) =====
    let requestedAction: RequestedAction | null = body.requested_action ?? null;
    if (!requestedAction && body.bot_status) {
      requestedAction = body.bot_status === "enabled" ? "enable_bot" : "disable_bot";
    }
    if (!requestedAction) {
      return new Response(
        JSON.stringify({
          error:
            "requested_action é obrigatório (use 'enable_bot' ou 'disable_bot'). Compatível: bot_status='enabled'|'disabled'.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== Normalizar origem =====
    // - Se cliente já mandou requested_origin novo → usar.
    // - Senão, mapear do 'origem' antigo (manual/automatico/sistema), default 'sistema'.
    let requestedOrigin: RequestedOrigin =
      body.requested_origin ?? (body.origem as RequestedOrigin) ?? "sistema";

    // ===== Normalizar trigger_source =====
    // Sem trigger_source explícito, NUNCA assume manual_button.
    // Para preservar UX antiga onde origem='manual' vinha de botão real,
    // mapeamos origem='manual' antiga para 'manual_button' SOMENTE quando
    // o caller também enviar JWT válido (uso clássico do front).
    let triggerSource: TriggerSource = body.trigger_source ?? "unspecified";

    // ===== Identificar usuário (sem virar manual automaticamente) =====
    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization");
    let executedByUserId: string | null =
      body.executed_by_user_id ?? body.executado_por_id ?? null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length);
      const { data: authData, error: userError } = await supabase.auth.getUser(token);
      if (!userError && authData?.user) {
        // JWT válido → preencher executed_by_user_id, mas NÃO virar manual sozinho.
        executedByUserId = authData.user.id;
      } else {
        console.warn("[toggle-bot-status] JWT inválido recebido — ignorando.");
      }
    }

    // ===== Compatibilidade: se chamada veio com 'origem=manual' E temos JWT,
    //       e o trigger_source não foi informado, assumir manual_button.
    //       Isso preserva o comportamento dos botões reais existentes (ChatWindow)
    //       sem precisar atualizar o frontend de uma vez.
    if (
      triggerSource === "unspecified" &&
      requestedOrigin === "manual" &&
      executedByUserId
    ) {
      triggerSource = "manual_button";
    }

    // Resolução final de origem:
    // só é "manual" se requested_origin=manual E trigger_source ∈ MANUAL_TRIGGER_SOURCES
    const isManual =
      requestedOrigin === "manual" &&
      MANUAL_TRIGGER_SOURCES.includes(triggerSource);

    const resolvedOrigin: RequestedOrigin = isManual
      ? "manual"
      : requestedOrigin === "manual"
        ? "automatico" // veio "manual" sem trigger válido → trata como automático
        : requestedOrigin;

    // ===== Estado anterior (auditoria) =====
    const { data: clienteAntes } = await supabase
      .from("clientes")
      .select(
        "bot_habilitado, data_bot_desabilitado, bot_desligado_manualmente, atendente_id, status_conversa",
      )
      .eq("telefone", telefone)
      .maybeSingle();

    const previousBotEnabled = clienteAntes?.bot_habilitado !== false;
    const previousManualLock = clienteAntes?.bot_desligado_manualmente === true;

    // Proteção contra estado stale/duplo clique: se o bot acabou de ser
    // reativado manualmente, não aceitar um novo desligamento manual imediato
    // sem override explícito. Isso evita o caso em que a UI antiga ainda acha
    // que o bot está desligado e reenvia uma ação de "assumir/desligar".
    if (
      requestedAction === "disable_bot" &&
      isManual &&
      previousBotEnabled &&
      body.force_disable_after_reactivation !== true
    ) {
      const sinceIso = new Date(Date.now() - 60_000).toISOString();
      const { data: recentEnable } = await supabase
        .from("bot_historico")
        .select("created_at, executado_por_id")
        .eq("telefone_cliente", telefone)
        .eq("acao", "ligado")
        .eq("origem", "manual")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const sameOperatorOrUnknown =
        !recentEnable?.executado_por_id ||
        !executedByUserId ||
        recentEnable.executado_por_id === executedByUserId;

      if (recentEnable && sameOperatorOrUnknown) {
        await supabase.from("system_logs").insert({
          nivel: "warn",
          categoria: "bot",
          mensagem: `Desligamento manual bloqueado logo após reativação: ${telefone}`,
          cliente_telefone: telefone,
          detalhes: {
            event: "bot_disable_blocked_recent_reactivation",
            telefone_cliente: telefone,
            recent_enable_at: recentEnable.created_at,
            requested_action: requestedAction,
            requested_origin: requestedOrigin,
            resolved_origin: resolvedOrigin,
            trigger_source: triggerSource,
            executed_by_user_id: executedByUserId,
          },
          url: "edge://toggle-bot-status",
        });

        await supabase.from("bot_historico").insert({
          telefone_cliente: telefone,
          acao: "desligado_bloqueado",
          origem: resolvedOrigin,
          executado_por_id: executedByUserId,
          observacao: `Desligamento manual BLOQUEADO — reativação manual recente [trigger=${triggerSource}, recent_enable_at=${recentEnable.created_at}, request_id=${body.request_id ?? ""}]`,
          request_id: body.request_id ?? crypto.randomUUID(),
        });

        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: "recent_manual_reactivation",
            telefone,
            bot_status: "enabled",
            previous_state: {
              bot_habilitado: previousBotEnabled,
              bot_desligado_manualmente: previousManualLock,
            },
            new_state: {
              bot_habilitado: true,
              bot_desligado_manualmente: false,
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ===== Confirmação manual para LIGAR =====
    // Mantemos a confirmação "LIGAR" para ativações manuais via botão.
    // Não checamos atendente_id como bloqueio.
    if (requestedAction === "enable_bot" && isManual) {
      const okConfirmacao =
        body.confirmacao === "LIGAR" || body.force_reactivate_manual === true;
      if (!okConfirmacao) {
        return new Response(
          JSON.stringify({
            error:
              "Reativação manual exige confirmação. Envie confirmacao='LIGAR' ou force_reactivate_manual=true.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ===== BLOQUEIO: enable_bot automático com trava manual ativa =====
    // Qualquer reativação NÃO-manual deve ser recusada se o cliente está com
    // bot_desligado_manualmente=true. Isso evita que o cron religue o bot
    // que um operador desligou de propósito.
    if (requestedAction === "enable_bot" && !isManual && previousManualLock) {
      console.warn(
        `[toggle-bot-status] 🛑 Reativação automática BLOQUEADA para ${telefone} (origem=${resolvedOrigin}, trigger=${triggerSource}) — trava manual ativa`,
      );

      try {
        await supabase.from("bot_historico").insert({
          telefone_cliente: telefone,
          acao: "ligado_bloqueado",
          origem: resolvedOrigin,
          executado_por_id: executedByUserId,
          observacao: `Reativação automática BLOQUEADA — bot_desligado_manualmente=true [trigger=${triggerSource}, request_id=${body.request_id ?? ""}]`,
          request_id: body.request_id ?? crypto.randomUUID(),
        });
      } catch (e) {
        console.warn("[toggle-bot-status] Falha ao logar bloqueio:", e);
      }

      // Cancelar agendamentos pendentes deste cliente para parar de tentar
      await supabase
        .from("bot_reactivation_schedule")
        .update({ executed: true })
        .eq("telefone_cliente", telefone)
        .eq("executed", false);

      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "manual_lock",
          telefone,
          bot_status: "disabled",
          previous_state: {
            bot_habilitado: previousBotEnabled,
            bot_desligado_manualmente: previousManualLock,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== Decisão de estado =====
    const newBotEnabled = requestedAction === "enable_bot";

    // bot_desligado_manualmente:
    // - disable manual → true
    // - enable manual → false
    // - qualquer outra origem → preserva valor anterior (não toca)
    let newManualLock: boolean;
    if (isManual && requestedAction === "disable_bot") {
      newManualLock = true;
    } else if (isManual && requestedAction === "enable_bot") {
      newManualLock = false;
    } else {
      newManualLock = previousManualLock;
    }

    const newDataDesabilitado =
      requestedAction === "disable_bot" ? new Date().toISOString() : null;

    // ===== Aplicar update =====
    const updatePayload: Record<string, unknown> = {
      bot_habilitado: newBotEnabled,
      data_bot_desabilitado: newDataDesabilitado,
      bot_desligado_manualmente: newManualLock,
    };

    // bot_ja_desligado_alguma_vez fica como flag histórica
    if (requestedAction === "disable_bot") {
      updatePayload.bot_ja_desligado_alguma_vez = true;
    }

    // bot_desativado_notificacao_vista: só faz sentido em desligamento manual
    if (requestedAction === "disable_bot") {
      updatePayload.bot_desativado_notificacao_vista = isManual ? true : false;
    }

    const { error: updateError } = await supabase
      .from("clientes")
      .update(updatePayload)
      .eq("telefone", telefone);

    if (updateError) {
      console.error("[toggle-bot-status] Erro ao atualizar cliente:", updateError);
      throw updateError;
    }

    // Cancelar reativações pendentes apenas em desligamento manual
    if (requestedAction === "disable_bot" && isManual) {
      await supabase
        .from("bot_reactivation_schedule")
        .update({ executed: true })
        .eq("telefone_cliente", telefone)
        .eq("executed", false);
    }

    // ===== Detecção de incoerência =====
    // Estado final incoerente: bot_habilitado=true E bot_desligado_manualmente=true
    const incoherentState = newBotEnabled === true && newManualLock === true;

    // ===== Auditoria =====
    const userAgent = req.headers.get("user-agent") || "desconhecido";
    const ipAddress =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "desconhecido";
    const requestId = body.request_id || crypto.randomUUID();

    const acaoLegacy = requestedAction === "enable_bot" ? "ligado" : "desligado";

    const observacaoBase =
      `Bot ${acaoLegacy} via toggle-bot-status ` +
      `[origem_resolvida=${resolvedOrigin}, trigger=${triggerSource}, ` +
      `prev_enabled=${previousBotEnabled}, prev_manual_lock=${previousManualLock}, ` +
      `new_enabled=${newBotEnabled}, new_manual_lock=${newManualLock}` +
      (body.template_name ? `, template=${body.template_name}` : "") +
      `]`;

    const observacaoFinal = incoherentState
      ? `${observacaoBase} | INCOERENCIA: bot religado por ${triggerSource} sem limpar trava manual antiga`
      : observacaoBase;

    await supabase.from("bot_historico").insert({
      telefone_cliente: telefone,
      acao: acaoLegacy,
      origem: resolvedOrigin,
      executado_por_id: executedByUserId,
      observacao: observacaoFinal,
      user_agent: userAgent,
      ip_address: ipAddress,
      request_id: requestId,
    });

    if (incoherentState) {
      await supabase.from("system_logs").insert({
        nivel: "warn",
        categoria: "bot",
        mensagem: `Estado incoerente após reativação automática: ${telefone} ficou bot_habilitado=true mas bot_desligado_manualmente=true`,
        detalhes: {
          event: "bot_state_incoherent",
          telefone_cliente: telefone,
          requested_action: requestedAction,
          requested_origin: requestedOrigin,
          resolved_origin: resolvedOrigin,
          trigger_source: triggerSource,
          executed_by_user_id: executedByUserId,
          previous_state: {
            bot_habilitado: previousBotEnabled,
            bot_desligado_manualmente: previousManualLock,
          },
          new_state: {
            bot_habilitado: newBotEnabled,
            bot_desligado_manualmente: newManualLock,
          },
          template_name: body.template_name ?? null,
          request_id: requestId,
        },
        url: "edge://toggle-bot-status",
      });
      console.warn(
        `[toggle-bot-status] ⚠️ INCOERENCIA registrada para ${telefone}: enabled=true & manual_lock=true (trigger=${triggerSource})`,
      );
    }

    console.log(
      `[toggle-bot-status] ✅ ${telefone} ${acaoLegacy} | origem=${resolvedOrigin} trigger=${triggerSource} prev=(${previousBotEnabled},${previousManualLock}) new=(${newBotEnabled},${newManualLock})${incoherentState ? " [INCOERENTE]" : ""}`,
    );

    // 🔍 LOG DE SAÍDA (resultado final aplicado)
    try {
      await supabase.from("system_logs").insert({
        nivel: incoherentState ? "warn" : "info",
        categoria: "bot",
        mensagem: `toggle-bot-status APLICADO: ${acaoLegacy} ${telefone} (origem=${resolvedOrigin})`,
        cliente_telefone: telefone,
        user_id: executedByUserId,
        detalhes: {
          event: "toggle_bot_applied",
          request_id: requestId,
          requested_action: requestedAction,
          resolved_origin: resolvedOrigin,
          trigger_source: triggerSource,
          previous_state: { bot_habilitado: previousBotEnabled, bot_desligado_manualmente: previousManualLock },
          new_state: { bot_habilitado: newBotEnabled, bot_desligado_manualmente: newManualLock },
          incoherent_state: incoherentState,
          applied_at: new Date().toISOString(),
        },
        url: "edge://toggle-bot-status",
      });
    } catch (logErr) {
      console.warn("[toggle-bot-status] falha ao gravar applied log:", logErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        telefone,
        bot_status: newBotEnabled ? "enabled" : "disabled",
        resolved_origin: resolvedOrigin,
        trigger_source: triggerSource,
        previous_state: {
          bot_habilitado: previousBotEnabled,
          bot_desligado_manualmente: previousManualLock,
        },
        new_state: {
          bot_habilitado: newBotEnabled,
          bot_desligado_manualmente: newManualLock,
        },
        incoherent_state: incoherentState,
        request_id: requestId,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[toggle-bot-status] Erro:", error);
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      await supabase.from("system_logs").insert({
        nivel: "error",
        categoria: "bot",
        mensagem: `toggle-bot-status ERRO: ${error instanceof Error ? error.message : "desconhecido"}`,
        detalhes: {
          event: "toggle_bot_error",
          error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
          received_at: new Date().toISOString(),
        },
        url: "edge://toggle-bot-status",
      });
    } catch (logErr) {
      console.warn("[toggle-bot-status] falha ao gravar error log:", logErr);
    }
    return new Response(
      JSON.stringify({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
