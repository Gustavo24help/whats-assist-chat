import { createClient } from 'npm:@supabase/supabase-js@2';

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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[process-bot-reactivation] Iniciando processamento de reativações agendadas');

    // Buscar agendamentos que devem ser executados
    const { data: schedules, error: fetchError } = await supabase
      .from('bot_reactivation_schedule')
      .select('*')
      .eq('executed', false)
      .lte('scheduled_at', new Date().toISOString());

    if (fetchError) {
      console.error('[process-bot-reactivation] Erro ao buscar agendamentos:', fetchError);
      throw fetchError;
    }

    if (!schedules || schedules.length === 0) {
      console.log('[process-bot-reactivation] Nenhum agendamento pendente encontrado');
      return new Response(
        JSON.stringify({ 
          message: 'Nenhum agendamento pendente',
          processed: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-bot-reactivation] Encontrados ${schedules.length} agendamento(s) para processar`);

    let processedCount = 0;
    let errorCount = 0;

    // Processar cada agendamento
    for (const schedule of schedules as ReactivationSchedule[]) {
      try {
        console.log(`[process-bot-reactivation] Processando reativação para ${schedule.telefone_cliente}`);

        // 🛡️ COOLDOWN: respeitar desligamento manual recente (< 60s)
        const { data: clienteAtual } = await supabase
          .from('clientes')
          .select('bot_habilitado, data_bot_desabilitado, bot_desligado_manualmente, atendente_id, status_conversa')
          .eq('telefone', schedule.telefone_cliente)
          .maybeSingle();

        const temOperadorAtribuido = Boolean(clienteAtual?.atendente_id);
        const temAtendimentoHumanoAtivo = temOperadorAtribuido;
        if (clienteAtual?.bot_desligado_manualmente === true) {
          console.log(
            `[process-bot-reactivation] 🔒 Reativação cancelada para ${schedule.telefone_cliente}: bot desligado manualmente. Mantendo desligado.`
          );

          await supabase
            .from('bot_reactivation_schedule')
            .update({ executed: true })
            .eq('id', schedule.id);

          await supabase.from('system_logs').insert({
            nivel: 'warn',
            categoria: 'bot',
            mensagem: `Reativação automática cancelada: bot desligado manualmente para ${schedule.telefone_cliente}`,
            detalhes: {
              telefone_cliente: schedule.telefone_cliente,
              ficha_id: schedule.ficha_id,
              schedule_id: schedule.id,
              bot_desligado_manualmente: true,
              atendente_id: clienteAtual?.atendente_id ?? null,
              status_conversa: clienteAtual?.status_conversa ?? null,
              bloqueado_por: 'desligamento_manual',
              acao: 'cancelado_mantido_desligado'
            },
            url: 'edge://process-bot-reactivation'
          });
          continue;
        }

        if (clienteAtual?.bot_desligado_manualmente || temAtendimentoHumanoAtivo) {
          console.log(
            `[process-bot-reactivation] 🛡️ Reativação bloqueada para ${schedule.telefone_cliente}: ` +
            `manual=${clienteAtual?.bot_desligado_manualmente === true}, operador_atribuido=${temOperadorAtribuido}, status_conversa=${clienteAtual?.status_conversa ?? 'null'}. Adiando 30min.`
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
              bloqueado_por: clienteAtual?.bot_desligado_manualmente === true ? 'desligamento_manual' : 'operador_atribuido',
              acao: 'adiado_30_minutos'
            },
            url: 'edge://process-bot-reactivation'
          });
          continue;
        }

        // Reativar bot
        const { error: updateError } = await supabase
          .from('clientes')
          .update({ 
            bot_habilitado: true,
            data_bot_desabilitado: null
          })
          .eq('telefone', schedule.telefone_cliente);

        if (updateError) {
          console.error(`[process-bot-reactivation] Erro ao reativar bot para ${schedule.telefone_cliente}:`, updateError);
          errorCount++;
          continue;
        }

        // Registrar no histórico
        const { error: historicoError } = await supabase
          .from('bot_historico')
          .insert({
            telefone_cliente: schedule.telefone_cliente,
            acao: 'ligado',
            origem: 'automatico',
            ficha_id: schedule.ficha_id,
            observacao: `Bot reativado automaticamente 10 dias após ficha ${schedule.ficha_id} ser finalizada`
          });

        if (historicoError) {
          console.error(`[process-bot-reactivation] Erro ao registrar histórico:`, historicoError);
        }

        // Marcar agendamento como executado
        const { error: markError } = await supabase
          .from('bot_reactivation_schedule')
          .update({ executed: true })
          .eq('id', schedule.id);

        if (markError) {
          console.error(`[process-bot-reactivation] Erro ao marcar agendamento como executado:`, markError);
          errorCount++;
          continue;
        }

        console.log(`[process-bot-reactivation] ✅ Bot reativado para ${schedule.telefone_cliente} (ficha: ${schedule.ficha_id})`);
        processedCount++;

      } catch (error) {
        console.error(`[process-bot-reactivation] Erro ao processar agendamento ${schedule.id}:`, error);
        errorCount++;
      }
    }

    console.log(`[process-bot-reactivation] Processamento concluído. Sucesso: ${processedCount}, Erros: ${errorCount}`);

    return new Response(
      JSON.stringify({
        message: 'Processamento de reativações concluído',
        processed: processedCount,
        errors: errorCount,
        total: schedules.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-bot-reactivation] Erro crítico:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
