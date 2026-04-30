import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  telefone: string;
  bot_status: "enabled" | "disabled";
  origem?: "manual" | "automatico" | "sistema";
  executado_por_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const {
      telefone,
      bot_status,
      origem: origemBody,
      executado_por_id: executadoPorBody,
    }: RequestBody = await req.json();

    // Validar inputs
    if (!telefone) {
      return new Response(JSON.stringify({ error: "Telefone é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!bot_status || !["enabled", "disabled"].includes(bot_status)) {
      return new Response(JSON.stringify({ error: 'bot_status deve ser "enabled" ou "disabled"' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== AUTENTICAÇÃO CONDICIONAL =====
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    let executado_por_id: string | null = null;
    let origem: "manual" | "automatico" | "sistema" = "sistema";

    // Se veio origem=automatico no body (Twilio), permitir sem auth
    if (origemBody === "automatico") {
      origem = "automatico";
      executado_por_id = null;
      console.log(`[toggle-bot-status] Chamada AUTOMÁTICA do Twilio (sem auth necessária)`);
    }
    // Se tem header de auth, validar usuário
    else if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length);
      const { data: authData, error: userError } = await supabase.auth.getUser(token);

      if (userError || !authData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      origem = "manual";
      executado_por_id = authData.user.id;
      console.log(`[toggle-bot-status] Chamada MANUAL do usuário: ${executado_por_id}`);
    }
    // Se não tem auth e não é automatico, rejeitar
    else {
      return new Response(JSON.stringify({ error: "Unauthorized - token ou origem=automatico requerido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(
      `[toggle-bot-status] Alterando status do bot para ${telefone}: ${bot_status}, origem: ${origem}, executado_por: ${executado_por_id || "sistema"}`,
    );

    const botHabilitado = bot_status === "enabled";
    const dataDesabilitado = bot_status === "disabled" ? new Date().toISOString() : null;

    // Lógica da exclamação amarela:
    const isManual = origem === "manual";
    const desligadoManualmente = bot_status === "disabled" ? isManual : false;
    const notificacaoVista = bot_status === "disabled" ? isManual : null;

    // 📋 Capturar estado ANTERIOR para auditoria
    const { data: clienteAntes } = await supabase
      .from("clientes")
      .select("bot_habilitado, data_bot_desabilitado, bot_desligado_manualmente, atendente_id, status_conversa")
      .eq("telefone", telefone)
      .maybeSingle();

    const estadoAnterior = clienteAntes?.bot_habilitado === false ? "desabilitado" : "habilitado";
    const desligadoManualmenteAntes = clienteAntes?.bot_desligado_manualmente === true;

    const temAtendimentoHumanoAtivo = Boolean(clienteAntes?.atendente_id) && clienteAntes?.status_conversa !== "fechada";
    const deveBloquearAtivacao = bot_status === "enabled" && (
      temAtendimentoHumanoAtivo || (origem !== "manual" && desligadoManualmenteAntes)
    );

    if (deveBloquearAtivacao) {
      console.log(
        `[toggle-bot-status] 🛡️ Ativação do bot bloqueada para ${telefone}: ` +
        `origem=${origem}, manual=${desligadoManualmenteAntes}, atendimento_humano=${temAtendimentoHumanoAtivo}`,
      );

      await supabase.from("system_logs").insert({
        nivel: "warn",
        categoria: "bot",
        mensagem: `Ativação do bot bloqueada durante atendimento humano: ${telefone}`,
        detalhes: {
          telefone_cliente: telefone,
          origem,
          estado_anterior: estadoAnterior,
          bot_desligado_manualmente: desligadoManualmenteAntes,
          atendente_id: clienteAntes?.atendente_id ?? null,
          status_conversa: clienteAntes?.status_conversa ?? null,
          bloqueado_por: temAtendimentoHumanoAtivo ? "atendimento_humano_ativo" : "desligamento_manual",
        },
        url: "edge://toggle-bot-status",
      });

      await supabase.from("bot_historico").insert({
        telefone_cliente: telefone,
        acao: "bloqueado",
        origem,
        executado_por_id,
        observacao: `Ativação do bot bloqueada: ${temAtendimentoHumanoAtivo ? "há operador ativo na conversa" : "bot desligado manualmente"}`,
      });

      return new Response(
        JSON.stringify({
          success: true,
          blocked: true,
          telefone,
          bot_status: "disabled",
          reason: "human_attendance_active",
          atendente_id: clienteAntes?.atendente_id ?? null,
          status_conversa: clienteAntes?.status_conversa ?? null,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Atualizar status do bot no cliente
    const { error: updateError } = await supabase
      .from("clientes")
      .update({
        bot_habilitado: botHabilitado,
        data_bot_desabilitado: dataDesabilitado,
        bot_desativado_notificacao_vista: notificacaoVista,
        bot_desligado_manualmente: desligadoManualmente,
        ...(bot_status === "disabled" && { bot_ja_desligado_alguma_vez: true }),
      })
      .eq("telefone", telefone);

    if (updateError) {
      console.error("[toggle-bot-status] Erro ao atualizar cliente:", updateError);
      throw updateError;
    }

    // Capturar dados de auditoria
    const userAgent = req.headers.get("user-agent") || "desconhecido";
    const ipAddress =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "desconhecido";
    const requestId = crypto.randomUUID();

    console.log(
      `[toggle-bot-status] Auditoria: UA=${userAgent.substring(0, 50)}..., IP=${ipAddress}, RequestID=${requestId}`,
    );

    // Registrar no histórico (com estado anterior para diagnóstico)
    const observacaoDetalhada =
      `Bot ${bot_status === "enabled" ? "ativado" : "desativado"} via toggle-bot-status ` +
      `[anterior: ${estadoAnterior}${desligadoManualmenteAntes ? "/manual" : ""}]`;

    const { error: historicoError } = await supabase.from("bot_historico").insert({
      telefone_cliente: telefone,
      acao: bot_status === "enabled" ? "ligado" : "desligado",
      origem: origem,
      executado_por_id,
      observacao: observacaoDetalhada,
      user_agent: userAgent,
      ip_address: ipAddress,
      request_id: requestId,
    });

    if (historicoError) {
      console.error("[toggle-bot-status] Erro ao registrar histórico:", historicoError);
    }

    console.log(`[toggle-bot-status] ✅ Status do bot atualizado para ${telefone}: ${bot_status}`);

    return new Response(
      JSON.stringify({
        success: true,
        telefone: telefone,
        bot_status: bot_status,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[toggle-bot-status] Erro:", error);
    return new Response(
      JSON.stringify({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
