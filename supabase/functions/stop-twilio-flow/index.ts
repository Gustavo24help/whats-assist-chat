import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // 3. Buscar execuções ativas no Twilio Studio
    const auth = btoa(`${accountSid}:${authToken}`);
    const executionsUrl = `https://studio.twilio.com/v2/Flows/${flowSid}/Executions`;

    const executionsResponse = await fetch(executionsUrl, {
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

    const executionsData = await executionsResponse.json();
    console.log(`[stop-twilio-flow] Execuções encontradas: ${executionsData.executions?.length || 0}`);

    // 4. Encontrar execução ativa para o telefone
    const activeExecution = executionsData.executions?.find(
      (exec: any) => 
        exec.contact_channel_address === telefone && 
        exec.status === 'active'
    );

    if (!activeExecution) {
      console.log(`[stop-twilio-flow] Nenhuma execução ativa para ${telefone}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Nenhuma execução ativa encontrada'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[stop-twilio-flow] Execução ativa encontrada: ${activeExecution.sid}`);

    // 5. Encerrar a execução
    const stopUrl = `https://studio.twilio.com/v2/Flows/${flowSid}/Executions/${activeExecution.sid}`;
    
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
      console.error('[stop-twilio-flow] Erro ao encerrar execução:', error);
      throw new Error('Erro ao encerrar execução no Twilio');
    }

    console.log(`[stop-twilio-flow] ✅ Execução ${activeExecution.sid} encerrada`);

    // 6. Desabilitar bot no banco de dados
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: updateError } = await supabase
      .from('clientes')
      .update({
        bot_habilitado: false,
        data_bot_desabilitado: new Date().toISOString(),
        bot_desativado_notificacao_vista: true, // NÃO mostrar exclamação (desligou manualmente)
        bot_desligado_manualmente: true, // Marcar como manual
        bot_ja_desligado_alguma_vez: true // Marcar que já desligou (para ativar som de notificação)
      })
      .eq('telefone', telefone);

    if (updateError) {
      console.error('[stop-twilio-flow] Erro ao desabilitar bot:', updateError);
      throw updateError;
    }

    // Registrar no histórico
    const { error: historicoError } = await supabase
      .from('bot_historico')
      .insert({
        telefone_cliente: telefone,
        acao: 'desligado',
        origem: 'manual',
        executado_por_id: executado_por_id || null,
        observacao: 'Bot desligado via stop-twilio-flow (encerramento de fluxo Twilio)'
      });

    if (historicoError) {
      console.error('[stop-twilio-flow] Erro ao registrar histórico:', historicoError);
    }

    console.log(`[stop-twilio-flow] ✅ Bot desabilitado para ${telefone}`);

    return new Response(
      JSON.stringify({
        success: true,
        executionSid: activeExecution.sid,
        message: 'Bot encerrado com sucesso',
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
