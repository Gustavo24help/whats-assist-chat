import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ReactivationSchedule {
  id: string;
  telefone_cliente: string;
  ficha_id: string;
  scheduled_at: string;
}

const postponeSchedule = async (supabase: any, scheduleId: string, minutes = 30) => {
  await supabase
    .from('bot_reactivation_schedule')
    .update({ scheduled_at: new Date(Date.now() + minutes * 60 * 1000).toISOString() })
    .eq('id', scheduleId);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[reactivate-bots-24h] Processando agendamentos de reativação pendentes');

    const { data: schedules, error: fetchError } = await supabase
      .from('bot_reactivation_schedule')
      .select('*')
      .eq('executed', false)
      .lte('scheduled_at', new Date().toISOString());

    if (fetchError) {
      console.error('[reactivate-bots-24h] Erro ao buscar agendamentos:', fetchError);
      throw fetchError;
    }

    if (!schedules || schedules.length === 0) {
      console.log('[reactivate-bots-24h] Nenhum agendamento pendente');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum agendamento pendente', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[reactivate-bots-24h] ${schedules.length} agendamento(s) para processar`);

    let processedCount = 0;
    let errorCount = 0;

    for (const schedule of schedules as ReactivationSchedule[]) {
      try {
        console.log(`[reactivate-bots-24h] Reativando bot para ${schedule.telefone_cliente}`);

        // 🛡️ COOLDOWN: se o bot foi desligado MANUALMENTE há menos de 60 segundos,
        // não reativar agora — evita corrida com toggle manual recente.
        const { data: clienteAtual } = await supabase
          .from('clientes')
          .select('bot_habilitado, data_bot_desabilitado, bot_desligado_manualmente, atendente_id, status_conversa')
          .eq('telefone', schedule.telefone_cliente)
          .maybeSingle();

        const temAtendimentoHumanoAtivo = Boolean(clienteAtual?.atendente_id) && clienteAtual?.status_conversa !== 'fechada';
        if (clienteAtual?.bot_desligado_manualmente || temAtendimentoHumanoAtivo) {
          console.log(
            `[reactivate-bots-24h] 🛡️ Reativação bloqueada para ${schedule.telefone_cliente}: ` +
            `manual=${clienteAtual?.bot_desligado_manualmente === true}, atendimento_humano=${temAtendimentoHumanoAtivo}. Adiando 30min.`
          );
          await postponeSchedule(supabase, schedule.id, 30);

          await supabase.from('system_logs').insert({
            nivel: 'warn',
            categoria: 'bot',
            mensagem: `Reativação automática do bot bloqueada durante atendimento humano: ${schedule.telefone_cliente}`,
            detalhes: {
              telefone_cliente: schedule.telefone_cliente,
              ficha_id: schedule.ficha_id,
              schedule_id: schedule.id,
              bot_desligado_manualmente: clienteAtual?.bot_desligado_manualmente === true,
              atendente_id: clienteAtual?.atendente_id ?? null,
              status_conversa: clienteAtual?.status_conversa ?? null,
              acao: 'adiado_30_minutos'
            },
            url: 'edge://reactivate-bots-24h'
          });
          continue;
        }

        const { error: updateError } = await supabase
          .from('clientes')
          .update({
            bot_habilitado: true,
            data_bot_desabilitado: null
          })
          .eq('telefone', schedule.telefone_cliente);

        if (updateError) {
          console.error(`[reactivate-bots-24h] Erro ao reativar bot para ${schedule.telefone_cliente}:`, updateError);
          errorCount++;
          continue;
        }

        const { error: historicoError } = await supabase
          .from('bot_historico')
          .insert({
            telefone_cliente: schedule.telefone_cliente,
            acao: 'ligado',
            origem: 'automatico',
            ficha_id: schedule.ficha_id,
            observacao: `Bot reativado automaticamente após agendamento (ficha ${schedule.ficha_id}, scheduled_at: ${schedule.scheduled_at})`
          });

        if (historicoError) {
          console.error(`[reactivate-bots-24h] Erro ao registrar histórico:`, historicoError);
        }

        const { error: markError } = await supabase
          .from('bot_reactivation_schedule')
          .update({ executed: true })
          .eq('id', schedule.id);

        if (markError) {
          console.error(`[reactivate-bots-24h] Erro ao marcar agendamento como executado:`, markError);
          errorCount++;
          continue;
        }

        console.log(`[reactivate-bots-24h] ✅ Bot reativado para ${schedule.telefone_cliente} (ficha: ${schedule.ficha_id})`);
        processedCount++;
      } catch (error) {
        console.error(`[reactivate-bots-24h] Erro ao processar ${schedule.id}:`, error);
        errorCount++;
      }
    }

    console.log(`[reactivate-bots-24h] Concluído. Sucesso: ${processedCount}, Erros: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Processamento concluído',
        processed: processedCount,
        errors: errorCount,
        total: schedules.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[reactivate-bots-24h] Erro crítico:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
