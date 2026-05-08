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

    console.log("[reactivate-bots-24h] Processando agendamentos pendentes");

    const { data: schedules, error: fetchError } = await supabase
      .from("bot_reactivation_schedule")
      .select("*")
      .eq("executed", false)
      .lte("scheduled_at", new Date().toISOString());

    if (fetchError) {
      console.error("[reactivate-bots-24h] Erro ao buscar agendamentos:", fetchError);
      throw fetchError;
    }

    if (!schedules || schedules.length === 0) {
      console.log("[reactivate-bots-24h] Nenhum agendamento pendente");
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[reactivate-bots-24h] ${schedules.length} agendamento(s)`);

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
            `[reactivate-bots-24h] ⏭️ Ignorado ${schedule.telefone_cliente} — manual_lock=${cli?.bot_desligado_manualmente} atendente=${cli?.atendente_id ?? "null"}`,
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
            observacao: `Reativação ignorada por trava manual/atendente (cron 24h) | manual_lock=${cli?.bot_desligado_manualmente} atendente=${cli?.atendente_id ?? "null"}`,
          });
          continue;
        }

        // Chamar a função central.
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
            `[reactivate-bots-24h] Falha ao reativar ${schedule.telefone_cliente}:`,
            data,
          );
          errorCount++;
          continue;
        }

        // Histórico extra associando à ficha (a central já loga genérico)
        await supabase.from("bot_historico").insert({
          telefone_cliente: schedule.telefone_cliente,
          acao: "ligado",
          origem: "automatico",
          ficha_id: schedule.ficha_id,
          observacao: `Reativação automática (cron 24h) | scheduled_at=${schedule.scheduled_at} | ficha=${schedule.ficha_id} | request_id=${requestId}${data?.incoherent_state ? " | INCOERENCIA: trava manual antiga preservada" : ""}`,
          request_id: requestId,
        });

        const { error: markError } = await supabase
          .from("bot_reactivation_schedule")
          .update({ executed: true })
          .eq("id", schedule.id);

        if (markError) {
          console.error(
            `[reactivate-bots-24h] Erro ao marcar agendamento como executado:`,
            markError,
          );
          errorCount++;
          continue;
        }

        console.log(
          `[reactivate-bots-24h] ✅ Reativado ${schedule.telefone_cliente} (ficha ${schedule.ficha_id})${data?.incoherent_state ? " [INCOERENTE]" : ""}`,
        );
        processedCount++;
      } catch (error) {
        console.error(
          `[reactivate-bots-24h] Erro ao processar ${schedule.id}:`,
          error,
        );
        errorCount++;
      }
    }

    console.log(
      `[reactivate-bots-24h] Concluído. Sucesso: ${processedCount}, Erros: ${errorCount}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        errors: errorCount,
        total: schedules.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[reactivate-bots-24h] Erro crítico:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
