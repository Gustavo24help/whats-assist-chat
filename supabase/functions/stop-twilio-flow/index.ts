import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  telefone: string;
  executado_por_id?: string; // ID do usuário que executou a ação
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Validar credenciais Twilio
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const flowSid = Deno.env.get('TWILIO_FLOW_SID');

    if (!accountSid || !authToken || !flowSid) {
      throw new Error('Credenciais Twilio não configuradas');
    }

    // 2. Parsear body
    const { telefone, executado_por_id }: RequestBody = await req.json();

    if (!telefone) {
      return new Response(
        JSON.stringify({ error: 'Telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[stop-twilio-flow] Iniciando encerramento para: ${telefone}`);

    // 3. Buscar TODAS execuções ativas no Twilio Studio (com paginação)
    const auth = btoa(`${accountSid}:${authToken}`);
    const baseUrl = `https://studio.twilio.com/v2/Flows/${flowSid}/Executions?PageSize=100`;

    const activeExecutions: any[] = [];
    let nextUrl: string | null = baseUrl;
    let pages = 0;

    while (nextUrl && pages < 10) {
      pages++;
      const executionsResponse: Response = await fetch(nextUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!executionsResponse.ok) {
        const error = await executionsResponse.text();
        console.error('[stop-twilio-flow] Erro ao buscar execuções:', error);
        throw new Error('Erro ao consultar Twilio Studio');
      }

      const executionsData: any = await executionsResponse.json();
      const matched = (executionsData.executions || []).filter(
        (exec: any) =>
          exec.contact_channel_address === telefone &&
          exec.status === 'active'
      );
      activeExecutions.push(...matched);

      // Paginação Twilio: meta.next_page_url é absoluto ou null
      nextUrl = executionsData?.meta?.next_page_url || null;

      // Otimização: se já achamos algumas e a página atual veio sem matches recentes,
      // ainda assim continuamos por segurança até o limite de páginas.
    }

    console.log(`[stop-twilio-flow] Execuções ativas encontradas para ${telefone}: ${activeExecutions.length}`);

    if (activeExecutions.length === 0) {
      console.log(`[stop-twilio-flow] Nenhuma execução ativa para ${telefone}`);
      // ainda assim seguimos para desabilitar bot no banco abaixo
    }

    // 5. Encerrar TODAS execuções ativas (em paralelo)
    const stopResults = await Promise.allSettled(
      activeExecutions.map(async (exec: any) => {
        const stopUrl = `https://studio.twilio.com/v2/Flows/${flowSid}/Executions/${exec.sid}`;
        const stopResponse = await fetch(stopUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ 'Status': 'ended' }),
        });

        if (!stopResponse.ok) {
          const error = await stopResponse.text();
          throw new Error(`Falha ao encerrar ${exec.sid}: ${error}`);
        }

        console.log(`[stop-twilio-flow] ✅ Execução ${exec.sid} encerrada`);
        return exec.sid;
      })
    );

    const stoppedSids = stopResults
      .filter((r) => r.status === 'fulfilled')
      .map((r: any) => r.value);
    const failedStops = stopResults
      .filter((r) => r.status === 'rejected')
      .map((r: any) => r.reason?.message || 'erro desconhecido');

    if (failedStops.length > 0) {
      console.error('[stop-twilio-flow] Algumas execuções falharam:', failedStops);
    }

    // Compatibilidade com o caller antigo: usa primeira execução como "executionSid"
    const activeExecution = activeExecutions[0] || null;

    // 6. Desabilitar bot no banco de dados
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ===== Autenticação / auditoria confiável =====
    // Se não houver JWT válido, NÃO registrar como manual nem aceitar executado_por_id do body.
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

    let origem: 'manual' | 'sistema' = 'sistema';
    let executadoPorConfiavel: string | null = null;
    if (token) {
      const { data, error: userError } = await supabase.auth.getUser(token);
      if (!userError && data?.user) {
        origem = 'manual';
        executadoPorConfiavel = data.user.id;

        if (executado_por_id && executado_por_id !== data.user.id) {
          console.warn(
            `[stop-twilio-flow] executado_por_id divergente (body=${executado_por_id}, jwt=${data.user.id}) - usando JWT.`
          );
        }
      } else {
        console.warn('[stop-twilio-flow] JWT ausente/inválido - registrando como sistema');
      }
    }

    const { error: updateError } = await supabase
      .from('clientes')
      .update({
        bot_habilitado: false,
        data_bot_desabilitado: new Date().toISOString(),
        // Se não for manual (sem JWT válido), manter comportamento de notificação como "automático/sistema"
        bot_desativado_notificacao_vista: origem === 'manual' ? true : false,
        bot_desligado_manualmente: origem === 'manual',
        bot_ja_desligado_alguma_vez: true // Marcar que já desligou (para ativar som de notificação)
      })
      .eq('telefone', telefone);

    if (updateError) {
      console.error('[stop-twilio-flow] Erro ao desabilitar bot:', updateError);
      throw updateError;
    }

    if (origem === 'manual') {
      const { error: cancelScheduleError } = await supabase
        .from('bot_reactivation_schedule')
        .update({ executed: true })
        .eq('telefone_cliente', telefone)
        .eq('executed', false);

      if (cancelScheduleError) {
        console.error('[stop-twilio-flow] Erro ao cancelar reativações pendentes:', cancelScheduleError);
      }
    }

    // Capturar dados de auditoria
    const userAgent = req.headers.get('user-agent') || 'desconhecido';
    const ipAddress = req.headers.get('x-forwarded-for') 
      || req.headers.get('cf-connecting-ip') 
      || req.headers.get('x-real-ip') 
      || 'desconhecido';
    const requestId = crypto.randomUUID();

    console.log(`[stop-twilio-flow] Auditoria: UA=${userAgent.substring(0, 50)}..., IP=${ipAddress}, RequestID=${requestId}`);

    // Registrar no histórico
    const { error: historicoError } = await supabase
      .from('bot_historico')
      .insert({
        telefone_cliente: telefone,
        acao: 'desligado',
        origem,
        executado_por_id: executadoPorConfiavel,
        observacao: 'Bot desligado via stop-twilio-flow (encerramento de fluxo Twilio)',
        user_agent: userAgent,
        ip_address: ipAddress,
        request_id: requestId
      });

    if (historicoError) {
      console.error('[stop-twilio-flow] Erro ao registrar histórico:', historicoError);
    }

    console.log(`[stop-twilio-flow] ✅ Bot desabilitado para ${telefone}`);

    return new Response(
      JSON.stringify({
        success: true,
        executionSid: activeExecution?.sid ?? null,
        stoppedSids,
        stoppedCount: stoppedSids.length,
        failedCount: failedStops.length,
        message: stoppedSids.length > 0
          ? `Bot encerrado: ${stoppedSids.length} execução(ões) finalizada(s)`
          : 'Bot desabilitado (nenhuma execução ativa encontrada)',
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[stop-twilio-flow] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
