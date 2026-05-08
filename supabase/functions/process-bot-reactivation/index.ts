import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReactivationSchedule {
  id: string;
  telefone_cliente: string;
  ficha_id: string;
  scheduled_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[process-bot-reactivation] Iniciando processamento de reativações");

    const { data: schedules, error: fetchError } = await supabase
      .from("bot_reactivation_schedule")
      .select("*")
      .eq("executed", false)
      .lte("scheduled_at", new Date().toISOString());

    if (fetchError) {
      console.error("[process-bot-reactivation] Erro ao buscar agendamentos:", fetchError);
      throw fetchError;
    }

    if (!schedules || schedules.length === 0) {
      console.log("[process-bot-reactivation] Nenhum agendamento pendente");
      return new Response(
        JSON.stringify({ message: "Nenhum agendamento pendente", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[process-bot-reactivation] ${schedules.length} agendamento(s)`);

    let processedCount = 0;
    let errorCount = 0;
    const toggleUrl = `${supabaseUrl}/functions/v1/toggle-bot-status`;

    for (const schedule of schedules as ReactivationSchedule[]) {
      try {
        // Pré-checagem: nunca religar se houver trava manual ou atendente humano
        const { data: cli } = await supabase
          .from("clientes")
          .select("bot_desligado_manualmente, atendente_id")
          .eq("telefone", schedule.telefone_cliente)
          .maybeSingle();

        if (cli?.bot_desligado_manualmente === true || cli?.atendente_id) {
          console.log(
            `[process-bot-reactivation] ⏭️ Ignorado ${schedule.telefone_cliente} — manual_lock=${cli?.bot_desligado_manualmente} atendente=${cli?.atendente_id ?? "null"}`,
          );
          await supabase
            .from("bot_reactivation_schedule")
            .update({ executed: true })
            .eq("id", schedule.id);
          await supabase.from("bot_historico").insert({
            telefone_cliente: schedule.telefone_cliente,
            acao: "ligado_bloqueado",
            origem: "automatico",
            ficha_id: schedule.ficha_id,
            observacao: `Reativação ignorada por trava manual/atendente (cron) | manual_lock=${cli?.bot_desligado_manualmente} atendente=${cli?.atendente_id ?? "null"}`,
          });
          continue;
        }

        // Delegar à função central.
        const requestId = crypto.randomUUID();
        const resp = await fetch(toggleUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
          },
          body: JSON.stringify({
            telefone: schedule.telefone_cliente,
            requested_action: "enable_bot",
            requested_origin: "automatico",
            trigger_source: "cron",
            request_id: requestId,
          }),
        });

        let data: any = null;
        try {
          data = await resp.json();
        } catch {
          // ignore
        }

        if (!resp.ok || !data?.success) {
          console.error(
            `[process-bot-reactivation] Falha ao reativar ${schedule.telefone_cliente}:`,
            data,
          );
          errorCount++;
          continue;
        }

        await supabase.from("bot_historico").insert({
          telefone_cliente: schedule.telefone_cliente,
          acao: "ligado",
          origem: "automatico",
          ficha_id: schedule.ficha_id,
          observacao: `Reativação automática (cron 10d/finalização) | scheduled_at=${schedule.scheduled_at} | ficha=${schedule.ficha_id} | request_id=${requestId}${data?.incoherent_state ? " | INCOERENCIA: trava manual antiga preservada" : ""}`,
          request_id: requestId,
        });

        const { error: markError } = await supabase
          .from("bot_reactivation_schedule")
          .update({ executed: true })
          .eq("id", schedule.id);

        if (markError) {
          console.error(
            `[process-bot-reactivation] Erro ao marcar agendamento como executado:`,
            markError,
          );
          errorCount++;
          continue;
        }

        console.log(
          `[process-bot-reactivation] ✅ Reativado ${schedule.telefone_cliente} (ficha ${schedule.ficha_id})${data?.incoherent_state ? " [INCOERENTE]" : ""}`,
        );
        processedCount++;
      } catch (error) {
        console.error(
          `[process-bot-reactivation] Erro ao processar ${schedule.id}:`,
          error,
        );
        errorCount++;
      }
    }

    console.log(
      `[process-bot-reactivation] Concluído. Sucesso: ${processedCount}, Erros: ${errorCount}`,
    );

    return new Response(
      JSON.stringify({
        message: "Processamento de reativações concluído",
        processed: processedCount,
        errors: errorCount,
        total: schedules.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[process-bot-reactivation] Erro crítico:", error);
    return new Response(
      JSON.stringify({
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
